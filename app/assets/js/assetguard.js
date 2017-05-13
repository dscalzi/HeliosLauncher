/* Requirements */
const fs = require('fs')
const request = require('request')
const path = require('path')
const mkpath = require('mkdirp');
const async = require('async')
const crypto = require('crypto')
const EventEmitter = require('events');
const {remote} = require('electron')

/* Classes */

class Asset{
    constructor(id, hash, size, from, to){
        this.id = id
        this.hash = hash
        this.size = size
        this.from = from
        this.to = to
    }
}

class Library extends Asset{

    static mojangFriendlyOS(){
        const opSys = process.platform
        if (opSys === 'darwin') {
            return 'osx';
        } else if (opSys === 'win32'){
            return 'windows';
        } else if (opSys === 'linux'){
            return 'linux';
        } else {
            return 'unknown_os';
        }
    }

    static validateRules(rules){
        if(rules == null) return true

        let result = true
        rules.forEach(function(rule){
            const action = rule['action']
            const osProp = rule['os']
            if(action != null){
                if(osProp != null){
                    const osName = osProp['name']
                    const osMoj = Library.mojangFriendlyOS()
                    if(action === 'allow'){
                        result = osName === osMoj
                        return
                    } else if(action === 'disallow'){
                        result = osName !== osMoj
                        return
                    }
                }
            }
        })
        return result
    }
}

class DLTracker {
    constructor(dlqueue, dlsize){
        this.dlqueue = dlqueue
        this.dlsize = dlsize
    }
}

class AssetGuard extends EventEmitter{
    constructor(){
        super()
        this.totaldlsize = 0;
        this.progress = 0;
        this.assets = new DLTracker([], 0)
        this.libraries = new DLTracker([], 0)
        this.files = new DLTracker([], 0)
    }
}

//Instance of AssetGuard

const instance = new AssetGuard()

/* Utility Functions */

validateLocal = function(filePath, algo, hash){
    if(fs.existsSync(filePath)){
        let fileName = path.basename(filePath)
        let shasum = crypto.createHash(algo)
        let content = fs.readFileSync(filePath)
        shasum.update(content)
        let calcdhash = shasum.digest('hex')
        return calcdhash === hash
    }
    return false;
}

/* Validation Functions */

/**
 * Load version asset index.
 */
loadVersionData = function(version, basePath, force = false){
    return new Promise(function(fulfill, reject){
        const name = version + '.json'
        const url = 'https://s3.amazonaws.com/Minecraft.Download/versions/' + version + '/' + name
        const versionPath = path.join(basePath, 'versions', version)
        const versionFile = path.join(versionPath, name)
        if(!fs.existsSync(versionFile) || force){
            //This download will never be tracked as it's essential and trivial.
            request.head(url, function(err, res, body){
                console.log('Preparing download of ' + version + ' assets.')
                mkpath.sync(versionPath)
                const stream = request(url).pipe(fs.createWriteStream(versionFile))
                stream.on('finish', function(){
                    fulfill(JSON.parse(fs.readFileSync(versionFile)))
                })
            })
        } else {
            fulfill(JSON.parse(fs.readFileSync(versionFile)))
        }
    })
}

/**
 * Public asset validation method.
 */
validateAssets = function(versionData, basePath, force = false){
    return new Promise(function(fulfill, reject){
        assetChainIndexData(versionData, basePath, force).then(() => {
            fulfill()
        })
    })
}

//Chain the asset tasks to provide full async. The below functions are private.

assetChainIndexData = function(versionData, basePath, force = false){
    return new Promise(function(fulfill, reject){
        //Asset index constants.
        const assetIndex = versionData.assetIndex
        const name = assetIndex.id + '.json'
        const indexPath = path.join(basePath, 'assets', 'indexes')
        const assetIndexLoc = path.join(indexPath, name)

        let data = null
        if(!fs.existsSync(assetIndexLoc) || force){
            console.log('Downloading ' + versionData.id + ' asset index.')
            mkpath.sync(indexPath)
            const stream = request(assetIndex.url).pipe(fs.createWriteStream(assetIndexLoc))
            stream.on('finish', function() {
                data = JSON.parse(fs.readFileSync(assetIndexLoc, 'utf-8'))
                assetChainValidateAssets(versionData, basePath, data).then(() => {
                    fulfill()
                })
            })
        } else {
            data = JSON.parse(fs.readFileSync(assetIndexLoc, 'utf-8'))
            assetChainValidateAssets(versionData, basePath, data).then(() => {
                fulfill()
            })
        }
    })
}

assetChainValidateAssets = function(versionData, basePath, indexData){
    return new Promise(function(fulfill, reject){

        //Asset constants
        const resourceURL = 'http://resources.download.minecraft.net/'
        const localPath = path.join(basePath, 'assets')
        const indexPath = path.join(localPath, 'indexes')
        const objectPath = path.join(localPath, 'objects')

        const assetDlQueue = []
        let dlSize = 0;
        //const objKeys = Object.keys(data.objects)
        async.forEachOfLimit(indexData.objects, 10, function(value, key, cb){
            const hash = value.hash
            const assetName = path.join(hash.substring(0, 2), hash)
            const urlName = hash.substring(0, 2) + "/" + hash
            const ast = new Asset(key, hash, String(value.size), resourceURL + urlName, path.join(objectPath, assetName))
            if(!validateLocal(ast.to, 'sha1', ast.hash)){
                dlSize += (ast.size*1)
                assetDlQueue.push(ast)
            }
            cb()
        }, function(err){
            instance.assets = new DLTracker(assetDlQueue, dlSize)
            instance.totaldlsize += dlSize
            fulfill()
        })
    })
}

/**
 * Public library validation method.
 */
validateLibraries = function(versionData, basePath){
    return new Promise(function(fulfill, reject){

        const libArr = versionData.libraries
        const libPath = path.join(basePath, 'libraries')

        const libDlQueue = []
        let dlSize = 0

        //Check validity of each library. If the hashs don't match, download the library.
        async.eachLimit(libArr, 5, function(lib, cb){
            if(Library.validateRules(lib.rules)){
                let artifact = (lib.natives == null) ? lib.downloads.artifact : lib.downloads.classifiers[lib.natives[Library.mojangFriendlyOS()]]
                const libItm = new Library(lib.name, artifact.sha1, artifact.size, artifact.url, path.join(libPath, artifact.path))
                if(!validateLocal(libItm.to, 'sha1', libItm.hash)){
                    dlSize += (libItm.size*1)
                    libDlQueue.push(libItm)
                }
            }
            cb()
        }, function(err){
            instance.libraries = new DLTracker(libDlQueue, dlSize)
            instance.totaldlsize += dlSize
            fulfill()
        })
    })
}

runQueue = function(){
    this.progress = 0;
    let win = remote.getCurrentWindow()

    //Start asset download
    let assetacc = 0;
    const concurrentAssetDlQueue = instance.assets.dlqueue.slice(0)
    async.eachLimit(concurrentAssetDlQueue, 20, function(asset, cb){
        mkpath.sync(path.join(asset.to, ".."))
        let req = request(asset.from)
        let writeStream = fs.createWriteStream(asset.to)
        req.pipe(writeStream)
        req.on('data', function(chunk){
            instance.progress += chunk.length
            assetacc += chunk.length
            instance.emit('assetdata', assetacc)
            console.log('Asset Progress', assetacc/instance.assets.dlsize)
            win.setProgressBar(instance.progress/instance.totaldlsize)
            //console.log('Total Progress', instance.progress/instance.totaldlsize)
        })
        writeStream.on('close', cb)
    }, function(err){
        if(err){
            instance.emit('asseterr')
            console.log('An asset failed to process');
        } else {
            instance.emit('assetdone')
            console.log('All assets have been processed successfully')
        }
        instance.totaldlsize -= instance.assets.dlsize
        instance.assets = new DLTracker([], 0)
        win.setProgressBar(-1)
    })

    //Start library download
    let libacc = 0
    const concurrentLibraryDlQueue = instance.libraries.dlqueue.slice(0)
    async.eachLimit(concurrentLibraryDlQueue, 1, function(lib, cb){
        mkpath.sync(path.join(lib.to, '..'))
        let req = request(lib.from)
        let writeStream = fs.createWriteStream(lib.to)
        req.pipe(writeStream)

        req.on('data', function(chunk){
            instance.progress += chunk.length
            libacc += chunk.length
            instance.emit('librarydata', libacc)
            console.log('Library Progress', libacc/instance.libraries.dlsize)
            win.setProgressBar(instance.progress/instance.totaldlsize)
        })
        writeStream.on('close', cb)
    }, function(err){
        if(err){
            instance.emit('libraryerr')
            console.log('A library failed to process');
        } else {
            instance.emit('librarydone')
            console.log('All libraries have been processed successfully');
        }
        instance.totaldlsize -= instance.libraries.dlsize
        instance.libraries = new DLTracker([], 0)
        win.setProgressBar(-1)
    })
}

module.exports = {
    loadVersionData,
    validateAssets,
    validateLibraries,
    runQueue,
    instance
}