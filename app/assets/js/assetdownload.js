const fs = require('fs')
const request = require('request')
const path = require('path')
const mkpath = require('mkdirp');
const async = require('async')
const crypto = require('crypto')
const Library = require('./library.js')
const {BrowserWindow} = require('electron')

/**
 * PHASING THIS OUT, WILL BE REMOVED WHEN ASSET GUARD MODULE IS COMPLETE!
 */

function Asset(from, to, size, hash){
    this.from = from
    this.to = to
    this.size = size
    this.hash = hash
}

function AssetIndex(id, sha1, size, url, totalSize){
    this.id = id
    this.sha1 = sha1
    this.size = size
    this.url = url
    this.totalSize = totalSize
}

/**
 * This function will download the version index data and read it into a Javascript
 * Object. This object will then be returned.
 */
parseVersionData = function(version, basePath){
    const name = version + '.json'
    const baseURL = 'https://s3.amazonaws.com/Minecraft.Download/versions/' + version + '/' + name
    const versionPath = path.join(basePath, 'versions', version)
    
    return new Promise(function(fulfill, reject){
        request.head(baseURL, function(err, res, body){
            console.log('Preparing download of ' + version + ' assets.')
            mkpath.sync(versionPath)
            const stream = request(baseURL).pipe(fs.createWriteStream(path.join(versionPath, name)))
            stream.on('finish', function(){
                fulfill(JSON.parse(fs.readFileSync(path.join(versionPath, name))))
            })
        })
    })
}

/**
 * Download the client for version. This file is 'client.jar' although
 * it must be renamed to '{version}'.jar.
 */
downloadClient = function(versionData, basePath){
    const dls = versionData['downloads']
    const clientData = dls['client']
    const url = clientData['url']
    const size = clientData['size']
    const version = versionData['id']
    const sha1 = clientData['sha1']
    const targetPath = path.join(basePath, 'versions', version)
    const targetFile = version + '.jar'

    if(!validateLocalIntegrity(path.join(targetPath, targetFile), 'sha1', sha1)){
        request.head(url, function(err, res, body){
            console.log('Downloading ' + version + ' client..')
            mkpath.sync(targetPath)
            const stream = request(url).pipe(fs.createWriteStream(path.join(targetPath, targetFile)))
            stream.on('finish', function(){
                console.log('Finished downloading ' + version + ' client.')
            })
        })
    }
}

downloadLogConfig = function(versionData, basePath){
    const logging = versionData['logging']
    const client = logging['client']
    const file = client['file']
    const version = versionData['id']
    const sha1 = file['sha1']
    const targetPath = path.join(basePath, 'assets', 'log_configs')
    const name = file['id']
    const url = file['url']

    if(!validateLocalIntegrity(path.join(targetPath, name), 'sha1', sha1)){
        request.head(url, function(err, res, body){
            console.log('Downloading ' + version + ' log config..')
            mkpath.sync(targetPath)
            const stream = request(url).pipe(fs.createWriteStream(path.join(targetPath, name)))
            stream.on('finish', function(){
                console.log('Finished downloading ' + version + ' log config..')
            })
        })
    }
}

downloadLibraries = function(versionData, basePath){
    const libArr = versionData['libraries']
    const libPath = path.join(basePath, 'libraries')

    let win = BrowserWindow.getFocusedWindow()
    const libDlQueue = []
    let dlSize = 0

    //Check validity of each library. If the hashs don't match, download the library.
    libArr.forEach(function(lib, index){
        if(Library.validateRules(lib.rules)){
            let artifact = null
            if(lib.natives == null){
                artifact = lib.downloads.artifact
            } else {
                artifact = lib.downloads.classifiers[lib.natives[Library.mojangFriendlyOS()]]
            }
            const libItm = new Library(lib.name, artifact.sha1, artifact.size, artifact.url, path.join(libPath, artifact.path))
            if(!validateLocalIntegrity(libItm.to, 'sha1', libItm.sha1)){
                dlSize += libItm.size
                libDlQueue.push(libItm)
            }
        }
    })

    let acc = 0;

    //Download all libraries that failed validation.
    async.eachLimit(libDlQueue, 1, function(lib, cb){
        mkpath.sync(path.join(lib.to, '..'))
        let req = request(lib.from)
        let writeStream = fs.createWriteStream(lib.to)
        req.pipe(writeStream)

        req.on('data', function(chunk){
            acc += chunk.length
            //console.log('Progress', acc/dlSize)
            win.setProgressBar(acc/dlSize)
        })
        writeStream.on('close', cb)
    }, function(err){
        if(err){
            console.log('A library failed to process');
        } else {
            console.log('All libraries have been processed successfully');
        }
        win.setProgressBar(-1)
    })
}

/**
 * Given an index url, this function will asynchonously download the
 * assets associated with that version.
 */
downloadAssets = function(versionData, basePath){
    //Asset index constants.
    const assetIndex = versionData.assetIndex
    const indexURL = assetIndex.url
    const gameVersion = versionData.id
    const assetVersion = assetIndex.id
    const name = assetVersion + '.json'

    //Asset constants
    const resourceURL = 'http://resources.download.minecraft.net/'
    const localPath = path.join(basePath, 'assets')
    const indexPath = path.join(localPath, 'indexes')
    const objectPath = path.join(localPath, 'objects')
    
    let win = BrowserWindow.getFocusedWindow()

    const assetIndexLoc = path.join(indexPath, name)
    /*if(!fs.existsSync(assetIndexLoc)){

    }*/
    console.log('Downloading ' + gameVersion + ' asset index.')
    mkpath.sync(indexPath)
    const stream = request(indexURL).pipe(fs.createWriteStream(assetIndexLoc))
    stream.on('finish', function() {
        const data = JSON.parse(fs.readFileSync(assetIndexLoc, 'utf-8'))
        const assetDlQueue = []
        let dlSize = 0;
        Object.keys(data.objects).forEach(function(key, index){
            const ob = data.objects[key]
            const hash = ob.hash
            const assetName = path.join(hash.substring(0, 2), hash)
            const urlName = hash.substring(0, 2) + "/" + hash
            const ast = new Asset(resourceURL + urlName, path.join(objectPath, assetName), ob.size, String(ob.hash))
            if(!validateLocalIntegrity(ast.to, 'sha1', ast.hash)){
                dlSize += ast.size
                assetDlQueue.push(ast)
            }
        })

        let acc = 0;
        async.eachLimit(assetDlQueue, 5, function(asset, cb){
            mkpath.sync(path.join(asset.to, ".."))
            let req = request(asset.from)
            let writeStream = fs.createWriteStream(asset.to)
            req.pipe(writeStream)
            req.on('data', function(chunk){
                acc += chunk.length
                console.log('Progress', acc/dlSize)
                win.setProgressBar(acc/dlSize)
            })
            writeStream.on('close', cb)
        }, function(err){
            if(err){
                console.log('An asset failed to process');
            } else {
                console.log('All assets have been processed successfully');
            }
            win.setProgressBar(-1)
        })
    })
}

validateLocalIntegrity = function(filePath, algo, hash){
    if(fs.existsSync(filePath)){
        let fileName = path.basename(filePath)
        console.log('Validating integrity of local file', fileName)
        let shasum = crypto.createHash(algo)
        let content = fs.readFileSync(filePath)
        shasum.update(content)
        let localhash = shasum.digest('hex')
        if(localhash === hash){
            console.log('Hash value of ' + fileName + ' matches the index hash, woo!')
            return true
        } else {
            console.log('Hash value of ' + fileName + ' (' + localhash + ')' + ' does not match the index hash. Redownloading..')
            return false
        }
    }
    return false;
}

module.exports = {
    parseVersionData,
    downloadClient,
    downloadLogConfig,
    downloadLibraries,
    downloadAssets
}