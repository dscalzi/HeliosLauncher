/**
 * AssetGuard
 * 
 * This module aims to provide a comprehensive and stable method for processing
 * and downloading game assets for the WesterosCraft server. A central object
 * stores download meta for several identifiers (categories). This meta data
 * is initially empty until one of the module's processing functions are called.
 * That function will process the corresponding asset index and validate any exisitng
 * local files. If a file is missing or fails validation, it will be placed into an
 * array which acts as a queue. This queue is wrapped in a download tracker object
 * so that essential information can be cached. The download tracker object is then
 * assigned as the value of the identifier in the central object. These download
 * trackers will remain idle until an async process is started to process them.
 * 
 * Once the async process is started, any enqueued assets will be downloaded. The central
 * object will emit events throughout the download whose name correspond to the identifier
 * being processed. For example, if the 'assets' identifier was being processed, whenever
 * the download stream recieves data, the event 'assetsdlprogress' will be emitted off of
 * the central object instance. This can be listened to by external modules allowing for
 * categorical tracking of the downloading process.
 * 
 * @module assetguard
 */
// Requirements
const fs = require('fs')
const request = require('request')
const path = require('path')
const mkpath = require('mkdirp');
const async = require('async')
const crypto = require('crypto')
const EventEmitter = require('events');
const {remote} = require('electron')

// Classes

/** Class representing a base asset. */
class Asset{
    /**
     * Create an asset.
     * 
     * @param {any} id - id of the asset.
     * @param {String} hash - hash value of the asset.
     * @param {Number} size - size in bytes of the asset.
     * @param {String} from - url where the asset can be found.
     * @param {String} to - absolute local file path of the asset.
     */
    constructor(id, hash, size, from, to){
        this.id = id
        this.hash = hash
        this.size = size
        this.from = from
        this.to = to
    }
}

/** Class representing a mojang library. */
class Library extends Asset{

    /**
     * Converts the process.platform OS names to match mojang's OS names.
     */
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

    /**
     * Checks whether or not a library is valid for download on a particular OS, following
     * the rule format specified in the mojang version data index. If the allow property has
     * an OS specified, then the library can ONLY be downloaded on that OS. If the disallow
     * property has instead specified an OS, the library can be downloaded on any OS EXCLUDING
     * the one specified.
     * 
     * @param {Object} rules - the Library's download rules.
     * @returns {Boolean} - true if the Library follows the specified rules, otherwise false.
     */
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

/**
 * Class representing a download tracker. This is used to store meta data
 * about a download queue, including the queue itself.
 */
class DLTracker {
    /**
     * Create a DLTracker
     * 
     * @param {Array.<Asset>} dlqueue - an array containing assets queued for download.
     * @param {Number} dlsize - the combined size of each asset in the download queue array.
     */
    constructor(dlqueue, dlsize){
        this.dlqueue = dlqueue
        this.dlsize = dlsize
    }
}

/**
 * Central object class used for control flow. This object stores data about
 * categories of downloads. Each category is assigned an identifier with a 
 * DLTracker object as its value. Combined information is also stored, such as
 * the total size of all the queued files in each category. This event is used
 * to emit events so that external modules can listen into processing done in
 * this module.
 */
class AssetGuard extends EventEmitter{
    /**
     * AssetGuard class should only ever have one instance which is defined in
     * this module. On creation the object's properties are never-null default
     * values. Each identifier is resolved to an empty DLTracker.
     */
    constructor(){
        super()
        this.totaldlsize = 0;
        this.progress = 0;
        this.assets = new DLTracker([], 0)
        this.libraries = new DLTracker([], 0)
        this.files = new DLTracker([], 0)
    }
}

/**
 * Global static final instance of AssetGuard
 */
const instance = new AssetGuard()

// Utility Functions

/**
 * Validate that a file exists and matches a given hash value.
 * 
 * @param {String} filePath - the path of the file to validate.
 * @param {String} algo - the hash algorithm to check against.
 * @param {String} hash - the existing hash to check against.
 * @returns {Boolean} - true if the file exists and calculated hash matches the given hash, otherwise false.
 */
function validateLocal(filePath, algo, hash){
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

/**
 * Initiate an async download process for an AssetGuard DLTracker.
 * 
 * @param {String} identifier - the identifier of the AssetGuard DLTracker.
 * @param {Number} limit - optional. The number of async processes to run in parallel.
 * @returns {Boolean} - true if the process began, otherwise false.
 */
function startAsyncProcess(identifier, limit = 5){
    let win = remote.getCurrentWindow()

    let acc = 0
    const concurrentDlQueue = instance[identifier].dlqueue.slice(0)
    if(concurrentDlQueue.length === 0){
        return false
    } else {
        async.eachLimit(concurrentDlQueue, limit, function(asset, cb){
            mkpath.sync(path.join(asset.to, ".."))
            let req = request(asset.from)
            let writeStream = fs.createWriteStream(asset.to)
            req.pipe(writeStream)
            req.on('data', function(chunk){
                instance.progress += chunk.length
                acc += chunk.length
                instance.emit(identifier + 'dlprogress', acc)
                //console.log(identifier + ' Progress', acc/instance[identifier].dlsize)
                win.setProgressBar(instance.progress/instance.totaldlsize)
            })
            writeStream.on('close', cb)
        }, function(err){
            if(err){
                instance.emit(identifier + 'dlerror')
                console.log('An item in ' + identifier + ' failed to process');
            } else {
                instance.emit(identifier + 'dlcomplete')
                console.log('All ' + identifier + ' have been processed successfully')
            }
            instance.totaldlsize -= instance[identifier].dlsize
            instance[identifier] = new DLTracker([], 0)
            if(instance.totaldlsize === 0) {
                win.setProgressBar(-1)
                instance.emit('dlcomplete')
            }
        })
        return true
    }
}

// Validation Functions

/**
 * Loads the version data for a given minecraft version.
 * 
 * @param {String} version - the game version for which to load the index data.
 * @param {String} basePath - the absolute file path which will be prepended to the given relative paths.
 * @param {Boolean} force - optional. If true, the version index will be downloaded even if it exists locally. Defaults to false.
 * @returns {Promise.<Object>} - Promise which resolves to the version data object.
 */
function loadVersionData(version, basePath, force = false){
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
 * Public asset validation function. This function will handle the validation of assets.
 * It will parse the asset index specified in the version data, analyzing each
 * asset entry. In this analysis it will check to see if the local file exists and is valid.
 * If not, it will be added to the download queue for the 'assets' identifier.
 * 
 * @param {Object} versionData - the version data for the assets.
 * @param {String} basePath - the absolute file path which will be prepended to the given relative paths.
 * @param {Boolean} force - optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
 * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
 */
function validateAssets(versionData, basePath, force = false){
    return new Promise(function(fulfill, reject){
        _assetChainIndexData(versionData, basePath, force).then(() => {
            fulfill()
        })
    })
}

//Chain the asset tasks to provide full async. The below functions are private.
/**
 * Private function used to chain the asset validation process. This function retrieves
 * the index data.
 * @param {Object} versionData
 * @param {String} basePath
 * @param {Boolean} force
 * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
 */
function _assetChainIndexData(versionData, basePath, force = false){
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
                _assetChainValidateAssets(versionData, basePath, data).then(() => {
                    fulfill()
                })
            })
        } else {
            data = JSON.parse(fs.readFileSync(assetIndexLoc, 'utf-8'))
            _assetChainValidateAssets(versionData, basePath, data).then(() => {
                fulfill()
            })
        }
    })
}

/**
 * Private function used to chain the asset validation process. This function processes
 * the assets and enqueues missing or invalid files.
 * @param {Object} versionData
 * @param {String} basePath
 * @param {Boolean} force
 * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
 */
function _assetChainValidateAssets(versionData, basePath, indexData){
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
 * Public library validation function. This function will handle the validation of libraries.
 * It will parse the version data, analyzing each library entry. In this analysis, it will
 * check to see if the local file exists and is valid. If not, it will be added to the download
 * queue for the 'libraries' identifier.
 * 
 * @param {Object} versionData - the version data for the assets.
 * @param {String} basePath - the absolute file path which will be prepended to the given relative paths.
 * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
 */
function validateLibraries(versionData, basePath){
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

/**
 * Public miscellaneous mojang file validation function. These files will be enqueued under
 * the 'files' identifier.
 * 
 * @param {Object} versionData - the version data for the assets.
 * @param {String} basePath - the absolute file path which will be prepended to the given relative paths.
 * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
 */
function validateMiscellaneous(versionData, basePath){
    return new Promise(async function(fulfill, reject){
        await validateClient(versionData, basePath)
        await validateLogConfig(versionData, basePath)
        fulfill()
    })
}

/**
 * Validate client file - artifact renamed from client.jar to '{version}'.jar.
 * 
 * @param {Object} versionData - the version data for the assets.
 * @param {String} basePath - the absolute file path which will be prepended to the given relative paths.
 * @param {Boolean} force - optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
 * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
 */
function validateClient(versionData, basePath, force = false){
    return new Promise(function(fulfill, reject){
        const clientData = versionData.downloads.client
        const version = versionData.id
        const targetPath = path.join(basePath, 'versions', version)
        const targetFile = version + '.jar'

        let client = new Asset(version + ' client', clientData.sha1, clientData.size, clientData.url, path.join(targetPath, targetFile))

        if(!validateLocal(client.to, 'sha1', client.hash) || force){
            instance.files.dlqueue.push(client)
            instance.files.dlsize += client.size*1
            fulfill()
        } else {
            fulfill()
        }
    })
}

/**
 * Validate log config.
 * 
 * @param {Object} versionData - the version data for the assets.
 * @param {String} basePath - the absolute file path which will be prepended to the given relative paths.
 * @param {Boolean} force - optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
 * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
 */
function validateLogConfig(versionData, basePath){
    return new Promise(function(fulfill, reject){
        const client = versionData.logging.client
        const file = client.file
        const targetPath = path.join(basePath, 'assets', 'log_configs')

        let logConfig = new Asset(file.id, file.sha1, file.size, file.url, path.join(targetPath, file.id))

        if(!validateLocal(logConfig.to, 'sha1', logConfig.hash)){
            instance.files.dlqueue.push(logConfig)
            instance.files.dlsize += client.size*1
            fulfill()
        } else {
            fulfill()
        }
    })
}

/**
 * This function will initiate the download processed for the specified identifiers. If no argument is
 * given, all identifiers will be initiated. Note that in order for files to be processed you need to run
 * the processing function corresponding to that identifier. If you run this function without processing
 * the files, it is likely nothing will be enqueued in the global object and processing will complete
 * immediately. Once all downloads are complete, this function will fire the 'dlcomplete' event on the
 * global object instance.
 * 
 * @param {Array.<{id: string, limit: number}>} identifiers - optional. The identifiers to process and corresponding parallel async task limit.
 */
function processDlQueues(identifiers = [{id:'assets', limit:20}, {id:'libraries', limit:5}, {id:'files', limit:5}]){
    this.progress = 0;
    let win = remote.getCurrentWindow()

    let shouldFire = true

    for(let i=0; i<identifiers.length; i++){
        let iden = identifiers[i]
        let r = startAsyncProcess(iden.id, iden.limit)
        if(r) shouldFire = false
    }

    if(shouldFire){
        instance.emit('dlcomplete')
    }
}

module.exports = {
    loadVersionData,
    validateAssets,
    validateLibraries,
    validateMiscellaneous,
    processDlQueues,
    instance,
    Asset,
    Library
}