/**
 * AssetGuard
 * 
 * This module aims to provide a comprehensive and stable method for processing
 * and downloading game assets for the WesterosCraft server. Download meta is
 * for several identifiers (categories) is stored inside of an AssetGuard object.
 * This meta data is initially empty until one of the module's processing functions 
 * are called. That function will process the corresponding asset index and validate 
 * any exisitng local files. If a file is missing or fails validation, it will be 
 * placed into a download queue (array). This queue is wrapped in a download tracker object
 * so that essential information can be cached. The download tracker object is then
 * assigned as the value of the identifier in the AssetGuard object. These download
 * trackers will remain idle until an async process is started to process them.
 * 
 * Once the async process is started, any enqueued assets will be downloaded. The AssetGuard
 * object will emit events throughout the download whose name correspond to the identifier
 * being processed. For example, if the 'assets' identifier was being processed, whenever
 * the download stream recieves data, the event 'assetsdlprogress' will be emitted off of
 * the AssetGuard instance. This can be listened to by external modules allowing for
 * categorical tracking of the downloading process.
 * 
 * @module assetguard
 */
// Requirements
const AdmZip = require('adm-zip')
const async = require('async')
const child_process = require('child_process')
const crypto = require('crypto')
const EventEmitter = require('events')
const fs = require('fs')
const mkpath = require('mkdirp');
const path = require('path')
const request = require('request')
const {remote} = require('electron')

// Classes

/** Class representing a base asset. */
class Asset {
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
class Library extends Asset {

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

class DistroModule extends Asset {

    /**
     * Create a DistroModule. This is for processing,
     * not equivalent to the module objects in the
     * distro index.
     * 
     * @param {any} id - id of the asset.
     * @param {String} hash - hash value of the asset.
     * @param {Number} size - size in bytes of the asset.
     * @param {String} from - url where the asset can be found.
     * @param {String} to - absolute local file path of the asset.
     * @param {String} type - the module type.
     */
    constructor(id, hash, size, from, to, type){
        super(id, hash, size, from, to)
        this.type = type
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
     * @param {function(Asset)} callback - optional callback which is called when an asset finishes downloading.
     */
    constructor(dlqueue, dlsize, callback = null){
        this.dlqueue = dlqueue
        this.dlsize = dlsize
        this.callback = callback
    }

}

let distributionData = null

/**
 * Central object class used for control flow. This object stores data about
 * categories of downloads. Each category is assigned an identifier with a 
 * DLTracker object as its value. Combined information is also stored, such as
 * the total size of all the queued files in each category. This event is used
 * to emit events so that external modules can listen into processing done in
 * this module.
 */
class AssetGuard extends EventEmitter {

    /**
     * Create an instance of AssetGuard.
     * On creation the object's properties are never-null default
     * values. Each identifier is resolved to an empty DLTracker.
     * 
     * @param {String} basePath - base path for asset validation (game root).
     * @param {String} javaexec - path to a java executable which will be used
     * to finalize installation.
     */
    constructor(basePath, javaexec){
        super()
        this.totaldlsize = 0;
        this.progress = 0;
        this.assets = new DLTracker([], 0)
        this.libraries = new DLTracker([], 0)
        this.files = new DLTracker([], 0)
        this.forge = new DLTracker([], 0)
        this.basePath = basePath
        this.javaexec = javaexec
    }

    // Static Utility Functions

    /**
     * Resolve an artifact id into a path. For example, on windows
     * 'net.minecraftforge:forge:1.11.2-13.20.0.2282', '.jar' becomes
     * net\minecraftforge\forge\1.11.2-13.20.0.2282\forge-1.11.2-13.20.0.2282.jar
     * 
     * @param {String} artifactid - the artifact id string.
     * @param {String} extension - the extension of the file at the resolved path.
     * @returns {String} - the resolved relative path from the artifact id.
     */
    static _resolvePath(artifactid, extension){
        let ps = artifactid.split(':')
        let cs = ps[0].split('.')

        cs.push(ps[1])
        cs.push(ps[2])
        cs.push(ps[1].concat('-').concat(ps[2]).concat(extension))

        return path.join.apply(path, cs)
    }

    /**
     * Resolve an artifact id into a URL. For example,
     * 'net.minecraftforge:forge:1.11.2-13.20.0.2282', '.jar' becomes
     * net/minecraftforge/forge/1.11.2-13.20.0.2282/forge-1.11.2-13.20.0.2282.jar
     * 
     * @param {String} artifactid - the artifact id string.
     * @param {String} extension - the extension of the file at the resolved url.
     * @returns {String} - the resolved relative URL from the artifact id.
     */
    static _resolveURL(artifactid, extension){
        let ps = artifactid.split(':')
        let cs = ps[0].split('.')

        cs.push(ps[1])
        cs.push(ps[2])
        cs.push(ps[1].concat('-').concat(ps[2]).concat(extension))

        return cs.join('/')
    }

    /**
     * Calculates the hash for a file using the specified algorithm.
     * 
     * @param {Buffer} buf - the buffer containing file data.
     * @param {String} algo - the hash algorithm.
     * @returns {String} - the calculated hash in hex.
     */
    static _calculateHash(buf, algo){
        return crypto.createHash(algo).update(buf).digest('hex')
    }

    /**
     * Used to parse a checksums file. This is specifically designed for
     * the checksums.sha1 files found inside the forge scala dependencies.
     * 
     * @param {String} content - the string content of the checksums file.
     * @returns {Object} - an object with keys being the file names, and values being the hashes.
     */
    static _parseChecksumsFile(content){
        let finalContent = {}
        let lines = content.split('\n')
        for(let i=0; i<lines.length; i++){
            let bits = lines[i].split(' ')
            if(bits[1] == null) {
                continue
            }
            finalContent[bits[1]] = bits[0]
        }
        return finalContent
    }

    /**
     * Validate that a file exists and matches a given hash value.
     * 
     * @param {String} filePath - the path of the file to validate.
     * @param {String} algo - the hash algorithm to check against.
     * @param {String} hash - the existing hash to check against.
     * @returns {Boolean} - true if the file exists and calculated hash matches the given hash, otherwise false.
     */
    static _validateLocal(filePath, algo, hash){
        if(fs.existsSync(filePath)){
            //No hash provided, have to assume it's good.
            if(hash == null){
                return true
            }
            let fileName = path.basename(filePath)
            let buf = fs.readFileSync(filePath)
            let calcdhash = AssetGuard._calculateHash(buf, algo)
            return calcdhash === hash
        }
        return false;
    }

    /**
     * Statically retrieve the distribution data.
     * 
     * @param {String} basePath - base path for asset validation (game root).
     * @param {Boolean} cached - optional. False if the distro should be freshly downloaded, else
     * a cached copy will be returned.
     * @returns {Promise.<Object>} - A promise which resolves to the distribution data object.
     */
    static retrieveDistributionData(basePath, cached = true){
        return new Promise(function(fulfill, reject){
            if(!cached || distributionData == null){
                // TODO Download file from upstream.
                //const distroURL = 'http://mc.westeroscraft.com/WesterosCraftLauncher/westeroscraft.json'
                // TODO Save file to path.join(basePath, 'westeroscraft.json')
                // TODO Fulfill with JSON.parse()

                // Workaround while file is not hosted.
                fs.readFile(path.join(__dirname, '..', 'westeroscraft.json'), 'utf-8', (err, data) => {
                    distributionData = JSON.parse(data)
                    fulfill(distributionData)
                })
            } else {
                fulfill(distributionData)
            }
        })
    }

    /**
     * Statically retrieve the distribution data.
     * 
     * @param {String} basePath - base path for asset validation (game root).
     * @param {Boolean} cached - optional. False if the distro should be freshly downloaded, else
     * a cached copy will be returned.
     * @returns {Object} - The distribution data object.
     */
    static retrieveDistributionDataSync(basePath, cached = true){
        if(!cached || distributionData == null){
            distributionData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'westeroscraft.json'), 'utf-8'))
        }
        return distributionData
    }

    /**
     * Resolve the default selected server from the distribution index.
     * 
     * @param {String} basePath - base path for asset validation (game root).
     * @returns {Object} - An object resolving to the default selected server.
     */
    static resolveSelectedServer(basePath){
        const distro = AssetGuard.retrieveDistributionDataSync(basePath)
        const servers = distro.servers
        for(let i=0; i<servers.length; i++){
            if(servers[i].default_selected){
                return servers[i].id
            }
        }
        // If no server declares default_selected, default to the first one declared.
        return (servers.length > 0) ? servers[0].id : null
    }

    /**
     * Gets a server from the distro index which maches the provided ID.
     * Returns null if the ID could not be found or the distro index has
     * not yet been loaded.
     * 
     * @param {String} basePath - base path for asset validation (game root).
     * @param {String} serverID - The id of the server to retrieve.
     * @returns {Object} - The server object whose id matches the parameter.
     */
    static getServerById(basePath, serverID){
        if(distributionData == null){
            AssetGuard.retrieveDistributionDataSync(basePath, false)
        }
        const servers = distributionData.servers
        let serv = null
        for(let i=0; i<servers.length; i++){
            if(servers[i].id === serverID){
                serv = servers[i]
            }
        }
        return serv
    }

    /**
     * Validates a file in the style used by forge's version index.
     * 
     * @param {String} filePath - the path of the file to validate.
     * @param {Array.<String>} checksums - the checksums listed in the forge version index.
     * @returns {Boolean} - true if the file exists and the hashes match, otherwise false.
     */
    static _validateForgeChecksum(filePath, checksums){
        if(fs.existsSync(filePath)){
            if(checksums == null || checksums.length === 0){
                return true
            }
            let buf = fs.readFileSync(filePath)
            let calcdhash = AssetGuard._calculateHash(buf, 'sha1')
            let valid = checksums.includes(calcdhash)
            if(!valid && filePath.endsWith('.jar')){
                valid = AssetGuard._validateForgeJar(filePath, checksums)
            }
            return valid
        }
        return false
    }

    /**
     * Validates a forge jar file dependency who declares a checksums.sha1 file.
     * This can be an expensive task as it usually requires that we calculate thousands
     * of hashes.
     * 
     * @param {Buffer} buf - the buffer of the jar file.
     * @param {Array.<String>} checksums - the checksums listed in the forge version index.
     * @returns {Boolean} - true if all hashes declared in the checksums.sha1 file match the actual hashes.
     */
    static _validateForgeJar(buf, checksums){
        // Double pass method was the quickest I found. I tried a version where we store data
        // to only require a single pass, plus some quick cleanup but that seemed to take slightly more time.

        const hashes = {}
        let expected = {}

        const zip = new AdmZip(buf)
        const zipEntries = zip.getEntries()

        //First pass
        for(let i=0; i<zipEntries.length; i++){
            let entry = zipEntries[i]
            if(entry.entryName === 'checksums.sha1'){
                expected = AssetGuard._parseChecksumsFile(zip.readAsText(entry))
            }
            hashes[entry.entryName] = AssetGuard._calculateHash(entry.getData(), 'sha1')
        }

        if(!checksums.includes(hashes['checksums.sha1'])){
            return false
        }

        //Check against expected
        const expectedEntries = Object.keys(expected)
        for(let i=0; i<expectedEntries.length; i++){
            if(expected[expectedEntries[i]] !== hashes[expectedEntries[i]]){
                return false
            }
        }
        return true
    }

    /**
     * Extracts and unpacks a file from .pack.xz format.
     * 
     * @param {Array.<String>} filePaths - The paths of the files to be extracted and unpacked.
     * @returns {Promise.<Void>} - An empty promise to indicate the extraction has completed.
     */
    static _extractPackXZ(filePaths, javaExecutable){
        return new Promise(function(fulfill, reject){
            const libPath = path.join(__dirname, '..', 'libraries', 'java', 'PackXZExtract.jar')
            const filePath = filePaths.join(',')
            const child = child_process.spawn(javaExecutable, ['-jar', libPath, '-packxz', filePath])
            child.stdout.on('data', (data) => {
                //console.log('PackXZExtract:', data.toString('utf8'))
            })
            child.stderr.on('data', (data) => {
                //console.log('PackXZExtract:', data.toString('utf8'))
            })
            child.on('close', (code, signal) => {
                //console.log('PackXZExtract: Exited with code', code)
                fulfill()
            })
        })
    }

    /**
     * Function which finalizes the forge installation process. This creates a 'version'
     * instance for forge and saves its version.json file into that instance. If that
     * instance already exists, the contents of the version.json file are read and returned
     * in a promise.
     * 
     * @param {Asset} asset - The Asset object representing Forge.
     * @param {String} basePath - Base path for asset validation (game root).
     * @returns {Promise.<Object>} - A promise which resolves to the contents of forge's version.json.
     */
    static _finalizeForgeAsset(asset, basePath){
        return new Promise(function(fulfill, reject){
            fs.readFile(asset.to, (err, data) => {
                const zip = new AdmZip(data)
                const zipEntries = zip.getEntries()

                for(let i=0; i<zipEntries.length; i++){
                    if(zipEntries[i].entryName === 'version.json'){
                        const forgeVersion = JSON.parse(zip.readAsText(zipEntries[i]))
                        const versionPath = path.join(basePath, 'versions', forgeVersion.id)
                        const versionFile = path.join(versionPath, forgeVersion.id + '.json')
                        if(!fs.existsSync(versionFile)){
                            mkpath.sync(versionPath)
                            fs.writeFileSync(path.join(versionPath, forgeVersion.id + '.json'), zipEntries[i].getData())
                            fulfill(forgeVersion)
                        } else {
                            //Read the saved file to allow for user modifications.
                            fulfill(JSON.parse(fs.readFileSync(versionFile, 'utf-8')))
                        }
                        return
                    }
                }
                //We didn't find forge's version.json.
                reject('Unable to finalize Forge processing, version.json not found! Has forge changed their format?')
            })
        })
    }

    /**
     * Initiate an async download process for an AssetGuard DLTracker.
     * 
     * @param {String} identifier - the identifier of the AssetGuard DLTracker.
     * @param {Number} limit - optional. The number of async processes to run in parallel.
     * @returns {Boolean} - true if the process began, otherwise false.
     */
    startAsyncProcess(identifier, limit = 5){
        const self = this
        let acc = 0
        const concurrentDlTracker = this[identifier]
        const concurrentDlQueue = concurrentDlTracker.dlqueue.slice(0)
        if(concurrentDlQueue.length === 0){
            return false
        } else {
            async.eachLimit(concurrentDlQueue, limit, function(asset, cb){
                let count = 0;
                mkpath.sync(path.join(asset.to, ".."))
                let req = request(asset.from)
                req.pause()
                req.on('response', (resp) => {
                    if(resp.statusCode === 200){
                        let writeStream = fs.createWriteStream(asset.to)
                        writeStream.on('close', () => {
                            //console.log('DLResults ' + asset.size + ' ' + count + ' ', asset.size === count)
                            if(concurrentDlTracker.callback != null){
                                concurrentDlTracker.callback.apply(concurrentDlTracker, [asset])
                            }
                            cb()
                        })
                        req.pipe(writeStream)
                        req.resume()
                    } else {
                        req.abort()
                        console.log('Failed to download ' + asset.from + '. Response code', resp.statusCode)
                        self.progress += asset.size*1
                        self.emit('totaldlprogress', {acc: self.progress, total: self.totaldlsize})
                        cb()
                    }
                })
                req.on('data', function(chunk){
                    count += chunk.length
                    self.progress += chunk.length
                    acc += chunk.length
                    self.emit(identifier + 'dlprogress', acc)
                    self.emit('totaldlprogress', {acc: self.progress, total: self.totaldlsize})
                })
            }, function(err){
                if(err){
                    self.emit(identifier + 'dlerror')
                    console.log('An item in ' + identifier + ' failed to process');
                } else {
                    self.emit(identifier + 'dlcomplete')
                    console.log('All ' + identifier + ' have been processed successfully')
                }
                self.totaldlsize -= self[identifier].dlsize
                self.progress -= self[identifier].dlsize
                self[identifier] = new DLTracker([], 0)
                if(self.totaldlsize === 0) {
                    self.emit('dlcomplete')
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
     * @param {Boolean} force - optional. If true, the version index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<Object>} - Promise which resolves to the version data object.
     */
    loadVersionData(version, force = false){
        const self = this
        return new Promise(function(fulfill, reject){
            const name = version + '.json'
            const url = 'https://s3.amazonaws.com/Minecraft.Download/versions/' + version + '/' + name
            const versionPath = path.join(self.basePath, 'versions', version)
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
     * @param {Boolean} force - optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
     */
    validateAssets(versionData, force = false){
        const self = this
        return new Promise(function(fulfill, reject){
            self._assetChainIndexData(versionData, force).then(() => {
                fulfill()
            })
        })
    }

    //Chain the asset tasks to provide full async. The below functions are private.
    /**
     * Private function used to chain the asset validation process. This function retrieves
     * the index data.
     * @param {Object} versionData
     * @param {Boolean} force
     * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
     */
    _assetChainIndexData(versionData, force = false){
        const self = this
        return new Promise(function(fulfill, reject){
            //Asset index constants.
            const assetIndex = versionData.assetIndex
            const name = assetIndex.id + '.json'
            const indexPath = path.join(self.basePath, 'assets', 'indexes')
            const assetIndexLoc = path.join(indexPath, name)

            let data = null
            if(!fs.existsSync(assetIndexLoc) || force){
                console.log('Downloading ' + versionData.id + ' asset index.')
                mkpath.sync(indexPath)
                const stream = request(assetIndex.url).pipe(fs.createWriteStream(assetIndexLoc))
                stream.on('finish', function() {
                    data = JSON.parse(fs.readFileSync(assetIndexLoc, 'utf-8'))
                    self._assetChainValidateAssets(versionData, data).then(() => {
                        fulfill()
                    })
                })
            } else {
                data = JSON.parse(fs.readFileSync(assetIndexLoc, 'utf-8'))
                self._assetChainValidateAssets(versionData, data).then(() => {
                    fulfill()
                })
            }
        })
    }

    /**
     * Private function used to chain the asset validation process. This function processes
     * the assets and enqueues missing or invalid files.
     * @param {Object} versionData
     * @param {Boolean} force
     * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
     */
    _assetChainValidateAssets(versionData, indexData){
        const self = this
        return new Promise(function(fulfill, reject){

            //Asset constants
            const resourceURL = 'http://resources.download.minecraft.net/'
            const localPath = path.join(self.basePath, 'assets')
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
                if(!AssetGuard._validateLocal(ast.to, 'sha1', ast.hash)){
                    dlSize += (ast.size*1)
                    assetDlQueue.push(ast)
                }
                cb()
            }, function(err){
                self.assets = new DLTracker(assetDlQueue, dlSize)
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
     * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
     */
    validateLibraries(versionData){
        const self = this
        return new Promise(function(fulfill, reject){

            const libArr = versionData.libraries
            const libPath = path.join(self.basePath, 'libraries')

            const libDlQueue = []
            let dlSize = 0

            //Check validity of each library. If the hashs don't match, download the library.
            async.eachLimit(libArr, 5, function(lib, cb){
                if(Library.validateRules(lib.rules)){
                    let artifact = (lib.natives == null) ? lib.downloads.artifact : lib.downloads.classifiers[lib.natives[Library.mojangFriendlyOS()]]
                    const libItm = new Library(lib.name, artifact.sha1, artifact.size, artifact.url, path.join(libPath, artifact.path))
                    if(!AssetGuard._validateLocal(libItm.to, 'sha1', libItm.hash)){
                        dlSize += (libItm.size*1)
                        libDlQueue.push(libItm)
                    }
                }
                cb()
            }, function(err){
                self.libraries = new DLTracker(libDlQueue, dlSize)
                fulfill()
            })
        })
    }

    /**
     * Public miscellaneous mojang file validation function. These files will be enqueued under
     * the 'files' identifier.
     * 
     * @param {Object} versionData - the version data for the assets.
     * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
     */
    validateMiscellaneous(versionData){
        const self = this
        return new Promise(async function(fulfill, reject){
            await self.validateClient(versionData)
            await self.validateLogConfig(versionData)
            fulfill()
        })
    }

    /**
     * Validate client file - artifact renamed from client.jar to '{version}'.jar.
     * 
     * @param {Object} versionData - the version data for the assets.
     * @param {Boolean} force - optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
     */
    validateClient(versionData, force = false){
        const self = this
        return new Promise(function(fulfill, reject){
            const clientData = versionData.downloads.client
            const version = versionData.id
            const targetPath = path.join(self.basePath, 'versions', version)
            const targetFile = version + '.jar'

            let client = new Asset(version + ' client', clientData.sha1, clientData.size, clientData.url, path.join(targetPath, targetFile))

            if(!AssetGuard._validateLocal(client.to, 'sha1', client.hash) || force){
                self.files.dlqueue.push(client)
                self.files.dlsize += client.size*1
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
     * @param {Boolean} force - optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<Void>} - An empty promise to indicate the async processing has completed.
     */
    validateLogConfig(versionData){
        const self = this
        return new Promise(function(fulfill, reject){
            const client = versionData.logging.client
            const file = client.file
            const targetPath = path.join(self.basePath, 'assets', 'log_configs')

            let logConfig = new Asset(file.id, file.sha1, file.size, file.url, path.join(targetPath, file.id))

            if(!AssetGuard._validateLocal(logConfig.to, 'sha1', logConfig.hash)){
                self.files.dlqueue.push(logConfig)
                self.files.dlsize += logConfig.size*1
                fulfill()
            } else {
                fulfill()
            }
        })
    }

    /**
     * Validate the distribution.
     * 
     * @param {String} serverpackid - The id of the server to validate.
     * @returns {Promise.<Object>} - A promise which resolves to the server distribution object.
     */
    validateDistribution(serverpackid){
        const self = this
        return new Promise(function(fulfill, reject){
            AssetGuard.retrieveDistributionData(self.basePath, false).then((value) => {
                /*const servers = value.servers
                let serv = null
                for(let i=0; i<servers.length; i++){
                    if(servers[i].id === serverpackid){
                        serv = servers[i]
                        break
                    }
                }*/
                const serv = AssetGuard.getServerById(self.basePath, serverpackid)

                if(serv == null) {
                    console.error('Invalid server pack id:', serverpackid)
                }

                self.forge = self._parseDistroModules(serv.modules, serv.mc_version)
                //Correct our workaround here.
                let decompressqueue = self.forge.callback
                self.forge.callback = function(asset){
                    if(asset.to.toLowerCase().endsWith('.pack.xz')){
                        AssetGuard._extractPackXZ([asset.to], self.javaexec)
                    }
                    if(asset.type === 'forge-hosted' || asset.type === 'forge'){
                        AssetGuard._finalizeForgeAsset(asset, self.basePath)
                    }
                }
                fulfill(serv)
            })
        })
    }

    /*//TODO The file should be hosted, the following code is for local testing.
    _chainValidateDistributionIndex(basePath){
        return new Promise(function(fulfill, reject){
            //const distroURL = 'http://mc.westeroscraft.com/WesterosCraftLauncher/westeroscraft.json'
            //const targetFile = path.join(basePath, 'westeroscraft.json')

            //TEMP WORKAROUND TO TEST WHILE THIS IS NOT HOSTED
            fs.readFile(path.join(__dirname, '..', 'westeroscraft.json'), 'utf-8', (err, data) => {
                fulfill(JSON.parse(data))
            })
        })
    }*/

    _parseDistroModules(modules, version){
        let alist = []
        let asize = 0;
        //This may be removed soon, considering the most efficient way to extract.
        let decompressqueue = []
        for(let i=0; i<modules.length; i++){
            let ob = modules[i]
            let obType = ob.type
            let obArtifact = ob.artifact
            let obPath = obArtifact.path == null ? AssetGuard._resolvePath(ob.id, obArtifact.extension) : obArtifact.path
            switch(obType){
                case 'forge-hosted':
                case 'forge':
                case 'library':
                    obPath = path.join(this.basePath, 'libraries', obPath)
                    break
                case 'forgemod':
                    //obPath = path.join(this.basePath, 'mods', obPath)
                    obPath = path.join(this.basePath, 'modstore', obPath)
                    break
                case 'litemod':
                    //obPath = path.join(this.basePath, 'mods', version, obPath)
                    obPath = path.join(this.basePath, 'modstore', obPath)
                    break
                case 'file':
                default: 
                    obPath = path.join(this.basePath, obPath)
            }
            let artifact = new DistroModule(ob.id, obArtifact.MD5, obArtifact.size, obArtifact.url, obPath, obType)
            const validationPath = obPath.toLowerCase().endsWith('.pack.xz') ? obPath.substring(0, obPath.toLowerCase().lastIndexOf('.pack.xz')) : obPath
            if(!AssetGuard._validateLocal(validationPath, 'MD5', artifact.hash)){
                asize += artifact.size*1
                alist.push(artifact)
                if(validationPath !== obPath) decompressqueue.push(obPath)
            }
            //Recursively process the submodules then combine the results.
            if(ob.sub_modules != null){
                let dltrack = this._parseDistroModules(ob.sub_modules, version)
                asize += dltrack.dlsize*1
                alist = alist.concat(dltrack.dlqueue)
                decompressqueue = decompressqueue.concat(dltrack.callback)
            }
        }

        //Since we have no callback at this point, we use this value to store the decompressqueue.
        return new DLTracker(alist, asize, decompressqueue)
    }

    /**
     * Loads Forge's version.json data into memory for the specified server id.
     * 
     * @param {String} serverpack - The id of the server to load Forge data for.
     * @returns {Promise.<Object>} - A promise which resolves to Forge's version.json data.
     */
    loadForgeData(serverpack){
        const self = this
        return new Promise(async function(fulfill, reject){
            let distro = AssetGuard.retrieveDistributionDataSync(self.basePath)
            
            const servers = distro.servers
            let serv = null
            for(let i=0; i<servers.length; i++){
                if(servers[i].id === serverpack){
                    serv = servers[i]
                    break
                }
            }

            const modules = serv.modules
            for(let i=0; i<modules.length; i++){
                const ob = modules[i]
                if(ob.type === 'forge-hosted' || ob.type === 'forge'){
                    let obArtifact = ob.artifact
                    let obPath = obArtifact.path == null ? path.join(self.basePath, 'libraries', AssetGuard._resolvePath(ob.id, obArtifact.extension)) : obArtifact.path
                    let asset = new DistroModule(ob.id, obArtifact.MD5, obArtifact.size, obArtifact.url, obPath, ob.type)
                    let forgeData = await AssetGuard._finalizeForgeAsset(asset, self.basePath)
                    fulfill(forgeData)
                    return
                }
            }
            reject('No forge module found!')
        })
    }

    _parseForgeLibraries(){
        /* TODO
        * Forge asset validations are already implemented. When there's nothing much
        * to work on, implement forge downloads using forge's version.json. This is to
        * have the code on standby if we ever need it (since it's half implemented already).
        */
    }

    /**
     * This function will initiate the download processed for the specified identifiers. If no argument is
     * given, all identifiers will be initiated. Note that in order for files to be processed you need to run
     * the processing function corresponding to that identifier. If you run this function without processing
     * the files, it is likely nothing will be enqueued in the object and processing will complete
     * immediately. Once all downloads are complete, this function will fire the 'dlcomplete' event on the
     * global object instance.
     * 
     * @param {Array.<{id: string, limit: number}>} identifiers - optional. The identifiers to process and corresponding parallel async task limit.
     */
    processDlQueues(identifiers = [{id:'assets', limit:20}, {id:'libraries', limit:5}, {id:'files', limit:5}, {id:'forge', limit:5}]){
        this.progress = 0;

        let shouldFire = true

        // Assign dltracking variables.
        this.totaldlsize = 0
        this.progress = 0
        for(let i=0; i<identifiers.length; i++){
            this.totaldlsize += this[identifiers[i].id].dlsize
        }

        for(let i=0; i<identifiers.length; i++){
            let iden = identifiers[i]
            let r = this.startAsyncProcess(iden.id, iden.limit)
            if(r) shouldFire = false
        }

        if(shouldFire){
            this.emit('dlcomplete')
        }
    }

}

module.exports = {
    AssetGuard,
    Asset,
    Library
}