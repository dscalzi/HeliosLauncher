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
const isDev = require('electron-is-dev')
const mkpath = require('mkdirp');
const path = require('path')
const Registry = require('winreg')
const request = require('request')
const tar = require('tar-fs')
const zlib = require('zlib')

// Constants
const PLATFORM_MAP = {
    win32: '-windows-x64.tar.gz',
    darwin: '-macosx-x64.tar.gz',
    linux: '-linux-x64.tar.gz'
}

// Classes

/** Class representing a base asset. */
class Asset {
    /**
     * Create an asset.
     * 
     * @param {any} id The id of the asset.
     * @param {string} hash The hash value of the asset.
     * @param {number} size The size in bytes of the asset.
     * @param {string} from The url where the asset can be found.
     * @param {string} to The absolute local file path of the asset.
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
     * @param {Object} rules The Library's download rules.
     * @returns {boolean} True if the Library follows the specified rules, otherwise false.
     */
    static validateRules(rules){
        if(rules == null) return true

        let result = true
        rules.forEach((rule) => {
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
     * @param {any} id The id of the asset.
     * @param {string} hash The hash value of the asset.
     * @param {number} size The size in bytes of the asset.
     * @param {string} from The url where the asset can be found.
     * @param {string} to The absolute local file path of the asset.
     * @param {string} type The the module type.
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
     * @param {Array.<Asset>} dlqueue An array containing assets queued for download.
     * @param {number} dlsize The combined size of each asset in the download queue array.
     * @param {function(Asset)} callback Optional callback which is called when an asset finishes downloading.
     */
    constructor(dlqueue, dlsize, callback = null){
        this.dlqueue = dlqueue
        this.dlsize = dlsize
        this.callback = callback
    }

}

let distributionData = null
let launchWithLocal = false

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
     * @param {string} basePath The base path for asset validation (game root).
     * @param {string} launcherPath The root launcher directory.
     * @param {string} javaexec The path to a java executable which will be used
     * to finalize installation.
     */
    constructor(basePath, launcherPath, javaexec){
        super()
        this.totaldlsize = 0
        this.progress = 0
        this.assets = new DLTracker([], 0)
        this.libraries = new DLTracker([], 0)
        this.files = new DLTracker([], 0)
        this.forge = new DLTracker([], 0)
        this.java = new DLTracker([], 0)
        this.extractQueue = []
        this.basePath = basePath
        this.launcherPath = launcherPath
        this.javaexec = javaexec
    }

    // Static Utility Functions
    // #region

    // Static General Resolve Functions
    // #region

    /**
     * Resolve an artifact id into a path. For example, on windows
     * 'net.minecraftforge:forge:1.11.2-13.20.0.2282', '.jar' becomes
     * net\minecraftforge\forge\1.11.2-13.20.0.2282\forge-1.11.2-13.20.0.2282.jar
     * 
     * @param {string} artifactid The artifact id string.
     * @param {string} extension The extension of the file at the resolved path.
     * @returns {string} The resolved relative path from the artifact id.
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
     * @param {string} artifactid The artifact id string.
     * @param {string} extension The extension of the file at the resolved url.
     * @returns {string} The resolved relative URL from the artifact id.
     */
    static _resolveURL(artifactid, extension){
        let ps = artifactid.split(':')
        let cs = ps[0].split('.')

        cs.push(ps[1])
        cs.push(ps[2])
        cs.push(ps[1].concat('-').concat(ps[2]).concat(extension))

        return cs.join('/')
    }

    // #endregion

    // Static Hash Validation Functions
    // #region

    /**
     * Calculates the hash for a file using the specified algorithm.
     * 
     * @param {Buffer} buf The buffer containing file data.
     * @param {string} algo The hash algorithm.
     * @returns {string} The calculated hash in hex.
     */
    static _calculateHash(buf, algo){
        return crypto.createHash(algo).update(buf).digest('hex')
    }

    /**
     * Used to parse a checksums file. This is specifically designed for
     * the checksums.sha1 files found inside the forge scala dependencies.
     * 
     * @param {string} content The string content of the checksums file.
     * @returns {Object} An object with keys being the file names, and values being the hashes.
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
     * @param {string} filePath The path of the file to validate.
     * @param {string} algo The hash algorithm to check against.
     * @param {string} hash The existing hash to check against.
     * @returns {boolean} True if the file exists and calculated hash matches the given hash, otherwise false.
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
     * Validates a file in the style used by forge's version index.
     * 
     * @param {string} filePath The path of the file to validate.
     * @param {Array.<string>} checksums The checksums listed in the forge version index.
     * @returns {boolean} True if the file exists and the hashes match, otherwise false.
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
     * @param {Buffer} buf The buffer of the jar file.
     * @param {Array.<string>} checksums The checksums listed in the forge version index.
     * @returns {boolean} True if all hashes declared in the checksums.sha1 file match the actual hashes.
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

    // #endregion

    // Static Distribution Index Functions
    // #region

    /**
     * Retrieve a new copy of the distribution index from our servers.
     * 
     * @param {string} launcherPath The root launcher directory.
     * @returns {Promise.<Object>} A promise which resolves to the distribution data object.
     */
    static refreshDistributionDataRemote(launcherPath){
        return new Promise((resolve, reject) => {
            const distroURL = 'http://mc.westeroscraft.com/WesterosCraftLauncher/westeroscraft.json'
            const distroDest = path.join(launcherPath, 'westeroscraft.json')
            request(distroURL, (error, resp, body) => {
                if(!error){
                    distributionData = JSON.parse(body)

                    fs.writeFile(distroDest, body, 'utf-8', (err) => {
                        if(!err){
                            resolve(distributionData)
                        } else {
                            reject(err)
                        }
                    })
                } else {
                    reject(error)
                }
            })
        })
    }

    /**
     * Retrieve a local copy of the distribution index asynchronously.
     * 
     * @param {string} launcherPath The root launcher directory.
     * @returns {Promise.<Object>} A promise which resolves to the distribution data object.
     */
    static refreshDistributionDataLocal(launcherPath){
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(launcherPath, 'westeroscraft.json'), 'utf-8', (err, data) => {
                if(!err){
                    distributionData = JSON.parse(data)
                    resolve(distributionData)
                } else {
                    reject(err)
                }
            })
        })
    }

    /**
     * Retrieve a local copy of the distribution index synchronously.
     * 
     * @param {string} launcherPath The root launcher directory.
     * @returns {Object} The distribution data object.
     */
    static refreshDistributionDataLocalSync(launcherPath){
        distributionData = JSON.parse(fs.readFileSync(path.join(launcherPath, 'westeroscraft.json'), 'utf-8'))
        return distributionData
    }

    /**
     * Get a cached copy of the distribution index.
     */
    static getDistributionData(){
        return distributionData
    }

    /**
     * Resolve the default selected server from the distribution index.
     * 
     * @returns {Object} An object resolving to the default selected server.
     */
    static resolveSelectedServer(){
        const distro = AssetGuard.getDistributionData()
        const servers = distro.servers
        for(let i=0; i<servers.length; i++){
            if(servers[i].default_selected){
                return servers[i]
            }
        }
        // If no server declares default_selected, default to the first one declared.
        return (servers.length > 0) ? servers[0] : null
    }

    /**
     * Gets a server from the distro index which maches the provided ID.
     * Returns null if the ID could not be found or the distro index has
     * not yet been loaded.
     * 
     * @param {string} serverID The id of the server to retrieve.
     * @returns {Object} The server object whose id matches the parameter.
     */
    static getServerById(serverID){
        const distro = AssetGuard.getDistributionData()
        const servers = distro.servers
        let serv = null
        for(let i=0; i<servers.length; i++){
            if(servers[i].id === serverID){
                serv = servers[i]
            }
        }
        return serv
    }

    /**
     * Set whether or not we should launch with a local copy of the distribution
     * index. This is useful for testing experimental changes to the distribution index.
     * 
     * @param {boolean} value True if we should launch with a local copy. Otherwise false. 
     */
    static launchWithLocal(value, silent = false){
        if(!silent){
            if(value){
                console.log('%c[AssetGuard]', 'color: #a02d2a; font-weight: bold', 'Will now launch using a local copy of the distribution index.')
                console.log('%c[AssetGuard]', 'color: #a02d2a; font-weight: bold', 'Unless you are a developer, revert this change immediately.')
            } else {
                console.log('%c[AssetGuard]', 'color: #a02d2a; font-weight: bold', 'Will now retrieve a fresh copy of the distribution index on launch.')
            }
        }
        launchWithLocal = value
    }

    /**
     * Check if AssetGuard is configured to launch with a local copy
     * of the distribution index.
     * 
     * @returns {boolean} True if launching with local, otherwise false.
     */
    static isLocalLaunch(){
        return launchWithLocal
    }

    // #endregion

    // Miscellaneous Static Functions
    // #region

    /**
     * Extracts and unpacks a file from .pack.xz format.
     * 
     * @param {Array.<string>} filePaths The paths of the files to be extracted and unpacked.
     * @returns {Promise.<void>} An empty promise to indicate the extraction has completed.
     */
    static _extractPackXZ(filePaths, javaExecutable){
        console.log('[PackXZExtract] Starting')
        return new Promise((resolve, reject) => {

            

            let libPath
            if(isDev){
                libPath = path.join(process.cwd(), 'libraries', 'java', 'PackXZExtract.jar')
            } else {
                if(process.platform === 'darwin'){
                    libPath = path.join(process.cwd(),'Contents', 'Resources', 'libraries', 'java', 'PackXZExtract.jar')
                } else {
                    libPath = path.join(process.cwd(), 'resources', 'libraries', 'java', 'PackXZExtract.jar')
                }
            }

            const filePath = filePaths.join(',')
            const child = child_process.spawn(javaExecutable, ['-jar', libPath, '-packxz', filePath])
            child.stdout.on('data', (data) => {
                console.log('[PackXZExtract]', data.toString('utf8'))
            })
            child.stderr.on('data', (data) => {
                console.log('[PackXZExtract]', data.toString('utf8'))
            })
            child.on('close', (code, signal) => {
                console.log('[PackXZExtract]', 'Exited with code', code)
                resolve()
            })
        })
    }

    /**
     * Function which finalizes the forge installation process. This creates a 'version'
     * instance for forge and saves its version.json file into that instance. If that
     * instance already exists, the contents of the version.json file are read and returned
     * in a promise.
     * 
     * @param {Asset} asset The Asset object representing Forge.
     * @param {string} basePath Base path for asset validation (game root).
     * @returns {Promise.<Object>} A promise which resolves to the contents of forge's version.json.
     */
    static _finalizeForgeAsset(asset, basePath){
        return new Promise((resolve, reject) => {
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
                            resolve(forgeVersion)
                        } else {
                            //Read the saved file to allow for user modifications.
                            resolve(JSON.parse(fs.readFileSync(versionFile, 'utf-8')))
                        }
                        return
                    }
                }
                //We didn't find forge's version.json.
                reject('Unable to finalize Forge processing, version.json not found! Has forge changed their format?')
            })
        })
    }

    // #endregion

    // Static Java Utility
    // #region

    /**
     * @typedef OracleJREData
     * @property {string} uri The base uri of the JRE.
     * @property {{major: string, update: string, build: string}} version Object containing version information.
     */

    /**
     * Resolves the latest version of Oracle's JRE and parses its download link.
     * 
     * @returns {Promise.<OracleJREData>} Promise which resolved to an object containing the JRE download data.
     */
    static _latestJREOracle(){

        const url = 'http://www.oracle.com/technetwork/java/javase/downloads/jre8-downloads-2133155.html'
        const regex = /http:\/\/.+?(?=\/java)\/java\/jdk\/([0-9]+u[0-9]+)-(b[0-9]+)\/([a-f0-9]{32})?\/jre-\1/
    
        return new Promise((resolve, reject) => {
            request(url, (err, resp, body) => {
                if(!err){
                    const arr = body.match(regex)
                    const verSplit = arr[1].split('u')
                    resolve({
                        uri: arr[0],
                        version: {
                            major: verSplit[0],
                            update: verSplit[1],
                            build: arr[2]
                        }
                    })
                } else {
                    resolve(null)
                }
            })
        })
    }

    /**
     * Returns the path of the OS-specific executable for the given Java
     * installation. Supported OS's are win32, darwin, linux.
     * 
     * @param {string} rootDir The root directory of the Java installation.
     * @returns {string} The path to the Java executable.
     */
    static javaExecFromRoot(rootDir){
        if(process.platform === 'win32'){
            return path.join(rootDir, 'bin', 'javaw.exe')
        } else if(process.platform === 'darwin'){
            return path.join(rootDir, 'Contents', 'Home', 'bin', 'java')
        } else if(process.platform === 'linux'){
            return path.join(rootDir, 'bin', 'java')
        }
        return rootDir
    }

    /**
     * Check to see if the given path points to a Java executable.
     * 
     * @param {string} pth The path to check against.
     * @returns {boolean} True if the path points to a Java executable, otherwise false.
     */
    static isJavaExecPath(pth){
        if(process.platform === 'win32'){
            return pth.endsWith(path.join('bin', 'javaw.exe'))
        } else if(process.platform === 'darwin'){
            return pth.endsWith(path.join('bin', 'java'))
        } else if(process.platform === 'linux'){
            return pth.endsWith(path.join('bin', 'java'))
        }
        return false
    }

    /**
     * Load Mojang's launcher.json file.
     * 
     * @returns {Promise.<Object>} Promise which resolves to Mojang's launcher.json object.
     */
    static loadMojangLauncherData(){
        return new Promise((resolve, reject) => {
            request.get('https://launchermeta.mojang.com/mc/launcher.json', (err, resp, body) => {
                if(err){
                    resolve(null)
                } else {
                    resolve(JSON.parse(body))
                }
            })
        })
    }

    /**
     * Parses a **full** Java Runtime version string and resolves
     * the version information. Uses Java 8 formatting.
     * 
     * @param {string} verString Full version string to parse.
     * @returns Object containing the version information.
     */
    static parseJavaRuntimeVersion(verString){
        // 1.{major}.0_{update}-b{build}
        // ex. 1.8.0_152-b16
        const ret = {}
        let pts = verString.split('-')
        ret.build = parseInt(pts[1].substring(1))
        pts = pts[0].split('_')
        ret.update = parseInt(pts[1])
        ret.major = parseInt(pts[0].split('.')[1])
        return ret
    }

    /**
     * Validates the output of a JVM's properties. Currently validates that a JRE is x64
     * and that the major = 8, update > 52.
     * 
     * @param {string} stderr The output to validate.
     * 
     * @returns {Promise.<boolean>} A promise which resolves to true if the properties are valid.
     * Otherwise false.
     */
    static _validateJVMProperties(stderr){
        const res = stderr
        const props = res.split('\n')

        const goal = 2
        let checksum = 0

        for(let i=0; i<props.length; i++){
            if(props[i].indexOf('sun.arch.data.model') > -1){
                let arch = props[i].split('=')[1].trim()
                console.log(props[i].trim())
                if(parseInt(arch) === 64){
                    ++checksum
                    if(checksum === goal){
                        return true
                    }
                }
            } else if(props[i].indexOf('java.runtime.version') > -1){
                let verString = props[i].split('=')[1].trim()
                console.log(props[i].trim())
                const verOb = AssetGuard.parseJavaRuntimeVersion(verString)
                if(verOb.major === 8 && verOb.update > 52){
                    ++checksum
                    if(checksum === goal){
                        return true
                    }
                }
            }
        }
        
        return checksum === goal
    }

    /**
     * Validates that a Java binary is at least 64 bit. This makes use of the non-standard
     * command line option -XshowSettings:properties. The output of this contains a property,
     * sun.arch.data.model = ARCH, in which ARCH is either 32 or 64. This option is supported
     * in Java 8 and 9. Since this is a non-standard option. This will resolve to true if
     * the function's code throws errors. That would indicate that the option is changed or
     * removed.
     * 
     * @param {string} binaryExecPath Path to the java executable we wish to validate.
     * 
     * @returns {Promise.<boolean>} Resolves to false only if the test is successful and the result
     * is less than 64.
     */
    static _validateJavaBinary(binaryExecPath){

        return new Promise((resolve, reject) => {
            if(fs.existsSync(binaryExecPath)){
                child_process.exec('"' + binaryExecPath + '" -XshowSettings:properties', (err, stdout, stderr) => {
                    try {
                        // Output is stored in stderr?
                        resolve(this._validateJVMProperties(stderr))
                    } catch (err){
                        // Output format might have changed, validation cannot be completed.
                        resolve(false)
                    }
                })
            } else {
                resolve(false)
            }
        })
        
    }

    /*static _validateJavaBinaryDarwin(binaryPath){

        return new Promise((resolve, reject) => {
            if(fs.existsSync(binaryExecPath)){
                child_process.exec('export JAVA_HOME="' + binaryPath + '"; java -XshowSettings:properties', (err, stdout, stderr) => {
                    try {
                        // Output is stored in stderr?
                        resolve(this._validateJVMProperties(stderr))
                    } catch (err){
                        // Output format might have changed, validation cannot be completed.
                        resolve(false)
                    }
                })
            } else {
                resolve(false)
            }
        })

    }*/

    /**
     * Checks for the presence of the environment variable JAVA_HOME. If it exits, we will check
     * to see if the value points to a path which exists. If the path exits, the path is returned.
     * 
     * @returns {string} The path defined by JAVA_HOME, if it exists. Otherwise null.
     */
    static _scanJavaHome(){
        const jHome = process.env.JAVA_HOME
        try {
            let res = fs.existsSync(jHome)
            return res ? jHome : null
        } catch (err) {
            // Malformed JAVA_HOME property.
            return null
        }
    }

    /**
     * Scans the data folder's runtime directory for suitable JRE candidates.
     * 
     * @param {string} dataDir The base launcher directory.
     * @returns {Promise.<Set.<string>>} A set containing suitable JRE candidates found
     * in the runtime directory.
     */
    static _scanDataFolder(dataDir){
        return new Promise((resolve, reject) => {
            const x64RuntimeDir = path.join(dataDir, 'runtime', 'x64')
            fs.exists(x64RuntimeDir, (e) => {
                let res = new Set()
                if(e){
                    fs.readdir(x64RuntimeDir, (err, files) => {
                        if(err){
                            resolve(res)
                            console.log(err)
                        } else {
                            for(let i=0; i<files.length; i++){
                                res.add(path.join(x64RuntimeDir, files[i]))
                            }
                            resolve(res)
                        }
                    })
                } else {
                    resolve(res)
                }
            })
        })
    }

    /**
     * Scans the registry for 64-bit Java entries. The paths of each entry are added to
     * a set and returned. Currently, only Java 8 (1.8) is supported.
     * 
     * @returns {Promise.<Set.<string>>} A promise which resolves to a set of 64-bit Java root
     * paths found in the registry.
     */
    static _scanRegistry(){

        return new Promise((resolve, reject) => {
            // Keys for Java v9.0.0 and later:
            // 'SOFTWARE\\JavaSoft\\JRE'
            // 'SOFTWARE\\JavaSoft\\JDK'
            // Forge does not yet support Java 9, therefore we do not.

            let cbTracker = 0
            let cbAcc = 0

            // Keys for Java 1.8 and prior:
            const regKeys = [
                '\\SOFTWARE\\JavaSoft\\Java Runtime Environment',
                '\\SOFTWARE\\JavaSoft\\Java Development Kit'
            ]

            const candidates = new Set()

            for(let i=0; i<regKeys.length; i++){
                const key = new Registry({
                    hive: Registry.HKLM,
                    key: regKeys[i],
                    arch: 'x64'
                })
                key.keyExists((err, exists) => {
                    if(exists) {
                        key.keys((err, javaVers) => {
                            if(err){
                                console.error(err)
                                if(i === regKeys.length-1 && cbAcc === cbTracker){
                                    resolve(candidates)
                                }
                            } else {
                                cbTracker += javaVers.length
                                if(i === regKeys.length-1 && cbTracker === cbAcc){
                                    resolve(candidates)
                                } else {
                                    for(let j=0; j<javaVers.length; j++){
                                        const javaVer = javaVers[j]
                                        const vKey = javaVer.key.substring(javaVer.key.lastIndexOf('\\')+1)
                                        // Only Java 8 is supported currently.
                                        if(parseFloat(vKey) === 1.8){
                                            javaVer.get('JavaHome', (err, res) => {
                                                const jHome = res.value
                                                if(jHome.indexOf('(x86)') === -1){
                                                    candidates.add(jHome)
                                                    
                                                }
                                                cbAcc++
                                                if(i === regKeys.length-1 && cbAcc === cbTracker){
                                                    resolve(candidates)
                                                }
                                            })
                                        } else {
                                            cbAcc++
                                            if(i === regKeys.length-1 && cbAcc === cbTracker){
                                                resolve(candidates)
                                            }
                                        }
                                    }
                                }
                            }
                        })
                    } else {
                        if(i === regKeys.length-1 && cbAcc === cbTracker){
                            resolve(candidates)
                        }
                    }
                })
            }

        })
        
    }

    /**
     * Attempts to find a valid x64 installation of Java on Windows machines.
     * Possible paths will be pulled from the registry and the JAVA_HOME environment
     * variable. The paths will be sorted with higher versions preceeding lower, and
     * JREs preceeding JDKs. The binaries at the sorted paths will then be validated.
     * The first validated is returned.
     * 
     * Higher versions > Lower versions
     * If versions are equal, JRE > JDK.
     * 
     * @param {string} dataDir The base launcher directory.
     * @returns {Promise.<string>} A Promise which resolves to the executable path of a valid 
     * x64 Java installation. If none are found, null is returned.
     */
    static async _win32JavaValidate(dataDir){

        // Get possible paths from the registry.
        const pathSet = await AssetGuard._scanRegistry()

        //console.log(Array.from(pathSet)) // DEBUGGING

        // Get possible paths from the data directory.
        const pathSet2 = await AssetGuard._scanDataFolder(dataDir)

        // Validate JAVA_HOME
        const jHome = AssetGuard._scanJavaHome()
        if(jHome != null && jHome.indexOf('(x86)') === -1){
            pathSet.add(jHome)
        }

        const mergedSet = new Set([...pathSet, ...pathSet2])

        // Convert path set to an array for processing.
        let pathArr = Array.from(mergedSet)

        //console.log(pathArr) // DEBUGGING

        // Sorts array. Higher version numbers preceed lower. JRE preceeds JDK.
        pathArr = pathArr.sort((a, b) => {
            // Note that Java 9+ uses semver and that will need to be accounted for in
            // the future.
            const aVer = parseInt(a.split('_')[1])
            const bVer = parseInt(b.split('_')[1])
            if(bVer === aVer){
                return a.indexOf('jdk') > -1 ? 1 : 0
            } else {
                return bVer - aVer
            }
        })

        //console.log(pathArr) // DEBUGGING

        // Validate that the binary is actually x64.
        for(let i=0; i<pathArr.length; i++) {
            const execPath = AssetGuard.javaExecFromRoot(pathArr[i])
            let res = await AssetGuard._validateJavaBinary(execPath)
            if(res){
                return execPath
            }
        }

        // No suitable candidates found.
        return null;

    }

    /**
     * See if JRE exists in the Internet Plug-Ins folder.
     * 
     * @returns {string} The path of the JRE if found, otherwise null.
     */
    static _scanInternetPlugins(){
        // /Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java
        const pth = '/Library/Internet Plug-Ins/JavaAppletPlugin.plugin'
        const res = fs.existsSync(AssetGuard.javaExecFromRoot(pth))
        return res ? pth : null
    }

    /**
     * WIP ->  get a valid x64 Java path on macOS.
     */
    static async _darwinJavaValidate(dataDir){

        const pathSet = new Set()

        // Check Internet Plugins folder.
        const iPPath = AssetGuard._scanInternetPlugins()
        if(iPPath != null){
            pathSet.add(iPPath)
        }

        // Check the JAVA_HOME environment variable.
        const jHome = AssetGuard._scanJavaHome()
        if(jHome != null){
            // Ensure we are at the absolute root.
            if(jHome.contains('/Contents/Home')){
                jHome = jHome.substring(0, jHome.indexOf('/Contents/Home'))
            }
            pathSet.add(jHome)
        }

        // Get possible paths from the data directory.
        const pathSet2 = await AssetGuard._scanDataFolder(dataDir)

        // TODO Sort by highest version.

        let pathArr = Array.from(pathSet2).concat(Array.from(pathSet))
        for(let i=0; i<pathArr.length; i++) {
            const execPath = AssetGuard.javaExecFromRoot(pathArr[i])
            let res = await AssetGuard._validateJavaBinary(execPath)
            if(res){
                return execPath
            }
        }

        return null
    }

    /**
     * WIP ->  get a valid x64 Java path on linux.
     */
    static async _linuxJavaValidate(dataDir){
        return null
    }

    /**
     * Retrieve the path of a valid x64 Java installation.
     * 
     * @param {string} dataDir The base launcher directory.
     * @returns {string} A path to a valid x64 Java installation, null if none found.
     */
    static async validateJava(dataDir){
        return await AssetGuard['_' + process.platform + 'JavaValidate'](dataDir)
    }

    // #endregion

    // #endregion

    // Validation Functions
    // #region

    /**
     * Loads the version data for a given minecraft version.
     * 
     * @param {string} version The game version for which to load the index data.
     * @param {boolean} force Optional. If true, the version index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<Object>} Promise which resolves to the version data object.
     */
    loadVersionData(version, force = false){
        const self = this
        return new Promise((resolve, reject) => {
            const name = version + '.json'
            const url = 'https://s3.amazonaws.com/Minecraft.Download/versions/' + version + '/' + name
            const versionPath = path.join(self.basePath, 'versions', version)
            const versionFile = path.join(versionPath, name)
            if(!fs.existsSync(versionFile) || force){
                //This download will never be tracked as it's essential and trivial.
                console.log('Preparing download of ' + version + ' assets.')
                mkpath.sync(versionPath)
                const stream = request(url).pipe(fs.createWriteStream(versionFile))
                stream.on('finish', () => {
                    resolve(JSON.parse(fs.readFileSync(versionFile)))
                })
            } else {
                resolve(JSON.parse(fs.readFileSync(versionFile)))
            }
        })
    }


    // Asset (Category=''') Validation Functions
    // #region

    /**
     * Public asset validation function. This function will handle the validation of assets.
     * It will parse the asset index specified in the version data, analyzing each
     * asset entry. In this analysis it will check to see if the local file exists and is valid.
     * If not, it will be added to the download queue for the 'assets' identifier.
     * 
     * @param {Object} versionData The version data for the assets.
     * @param {boolean} force Optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    validateAssets(versionData, force = false){
        const self = this
        return new Promise((resolve, reject) => {
            self._assetChainIndexData(versionData, force).then(() => {
                resolve()
            })
        })
    }

    //Chain the asset tasks to provide full async. The below functions are private.
    /**
     * Private function used to chain the asset validation process. This function retrieves
     * the index data.
     * @param {Object} versionData
     * @param {boolean} force
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    _assetChainIndexData(versionData, force = false){
        const self = this
        return new Promise((resolve, reject) => {
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
                stream.on('finish', () => {
                    data = JSON.parse(fs.readFileSync(assetIndexLoc, 'utf-8'))
                    self._assetChainValidateAssets(versionData, data).then(() => {
                        resolve()
                    })
                })
            } else {
                data = JSON.parse(fs.readFileSync(assetIndexLoc, 'utf-8'))
                self._assetChainValidateAssets(versionData, data).then(() => {
                    resolve()
                })
            }
        })
    }

    /**
     * Private function used to chain the asset validation process. This function processes
     * the assets and enqueues missing or invalid files.
     * @param {Object} versionData
     * @param {boolean} force
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    _assetChainValidateAssets(versionData, indexData){
        const self = this
        return new Promise((resolve, reject) => {

            //Asset constants
            const resourceURL = 'http://resources.download.minecraft.net/'
            const localPath = path.join(self.basePath, 'assets')
            const indexPath = path.join(localPath, 'indexes')
            const objectPath = path.join(localPath, 'objects')

            const assetDlQueue = []
            let dlSize = 0
            let acc = 0
            const total = Object.keys(indexData.objects).length
            //const objKeys = Object.keys(data.objects)
            async.forEachOfLimit(indexData.objects, 10, (value, key, cb) => {
                acc++
                self.emit('assetVal', {acc, total})
                const hash = value.hash
                const assetName = path.join(hash.substring(0, 2), hash)
                const urlName = hash.substring(0, 2) + "/" + hash
                const ast = new Asset(key, hash, String(value.size), resourceURL + urlName, path.join(objectPath, assetName))
                if(!AssetGuard._validateLocal(ast.to, 'sha1', ast.hash)){
                    dlSize += (ast.size*1)
                    assetDlQueue.push(ast)
                }
                cb()
            }, (err) => {
                self.assets = new DLTracker(assetDlQueue, dlSize)
                resolve()
            })
        })
    }
    
    // #endregion

    // Library (Category=''') Validation Functions
    // #region

    /**
     * Public library validation function. This function will handle the validation of libraries.
     * It will parse the version data, analyzing each library entry. In this analysis, it will
     * check to see if the local file exists and is valid. If not, it will be added to the download
     * queue for the 'libraries' identifier.
     * 
     * @param {Object} versionData The version data for the assets.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    validateLibraries(versionData){
        const self = this
        return new Promise((resolve, reject) => {

            const libArr = versionData.libraries
            const libPath = path.join(self.basePath, 'libraries')

            const libDlQueue = []
            let dlSize = 0

            //Check validity of each library. If the hashs don't match, download the library.
            async.eachLimit(libArr, 5, (lib, cb) => {
                if(Library.validateRules(lib.rules)){
                    let artifact = (lib.natives == null) ? lib.downloads.artifact : lib.downloads.classifiers[lib.natives[Library.mojangFriendlyOS()]]
                    const libItm = new Library(lib.name, artifact.sha1, artifact.size, artifact.url, path.join(libPath, artifact.path))
                    if(!AssetGuard._validateLocal(libItm.to, 'sha1', libItm.hash)){
                        dlSize += (libItm.size*1)
                        libDlQueue.push(libItm)
                    }
                }
                cb()
            }, (err) => {
                self.libraries = new DLTracker(libDlQueue, dlSize)
                resolve()
            })
        })
    }

    // #endregion

    // Miscellaneous (Category=files) Validation Functions
    // #region

    /**
     * Public miscellaneous mojang file validation function. These files will be enqueued under
     * the 'files' identifier.
     * 
     * @param {Object} versionData The version data for the assets.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    validateMiscellaneous(versionData){
        const self = this
        return new Promise(async (resolve, reject) => {
            await self.validateClient(versionData)
            await self.validateLogConfig(versionData)
            resolve()
        })
    }

    /**
     * Validate client file - artifact renamed from client.jar to '{version}'.jar.
     * 
     * @param {Object} versionData The version data for the assets.
     * @param {boolean} force Optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    validateClient(versionData, force = false){
        const self = this
        return new Promise((resolve, reject) => {
            const clientData = versionData.downloads.client
            const version = versionData.id
            const targetPath = path.join(self.basePath, 'versions', version)
            const targetFile = version + '.jar'

            let client = new Asset(version + ' client', clientData.sha1, clientData.size, clientData.url, path.join(targetPath, targetFile))

            if(!AssetGuard._validateLocal(client.to, 'sha1', client.hash) || force){
                self.files.dlqueue.push(client)
                self.files.dlsize += client.size*1
                resolve()
            } else {
                resolve()
            }
        })
    }

    /**
     * Validate log config.
     * 
     * @param {Object} versionData The version data for the assets.
     * @param {boolean} force Optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    validateLogConfig(versionData){
        const self = this
        return new Promise((resolve, reject) => {
            const client = versionData.logging.client
            const file = client.file
            const targetPath = path.join(self.basePath, 'assets', 'log_configs')

            let logConfig = new Asset(file.id, file.sha1, file.size, file.url, path.join(targetPath, file.id))

            if(!AssetGuard._validateLocal(logConfig.to, 'sha1', logConfig.hash)){
                self.files.dlqueue.push(logConfig)
                self.files.dlsize += logConfig.size*1
                resolve()
            } else {
                resolve()
            }
        })
    }

    // #endregion

    // Distribution (Category=forge) Validation Functions
    // #region

    /**
     * Validate the distribution.
     * 
     * @param {string} serverpackid The id of the server to validate.
     * @returns {Promise.<Object>} A promise which resolves to the server distribution object.
     */
    validateDistribution(serverpackid){
        const self = this
        return new Promise((resolve, reject) => {
            AssetGuard.refreshDistributionDataLocal(self.launcherPath).then((v) => {
                const serv = AssetGuard.getServerById(serverpackid)

                if(serv == null) {
                    console.error('Invalid server pack id:', serverpackid)
                }

                self.forge = self._parseDistroModules(serv.modules, serv.mc_version)
                // Correct our workaround here.
                let decompressqueue = self.forge.callback
                self.extractQueue = decompressqueue
                self.forge.callback = (asset, self) => {
                    if(asset.type === 'forge-hosted' || asset.type === 'forge'){
                        AssetGuard._finalizeForgeAsset(asset, self.basePath)
                    }
                }
                resolve(serv)
            })
        })
    }

    _parseDistroModules(modules, version){
        let alist = []
        let asize = 0;
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
     * @param {string} serverpack The id of the server to load Forge data for.
     * @returns {Promise.<Object>} A promise which resolves to Forge's version.json data.
     */
    loadForgeData(serverpack){
        const self = this
        return new Promise(async (resolve, reject) => {
            let distro = AssetGuard.getDistributionData()
            
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
                    resolve(forgeData)
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

    // #endregion

    // Java (Category=''') Validation (download) Functions
    // #region

    _enqueueOracleJRE(dataDir){
        return new Promise((resolve, reject) => {
            AssetGuard._latestJREOracle().then(verData => {
                if(verData != null){

                    const combined = verData.uri + PLATFORM_MAP[process.platform]
        
                    const opts = {
                        url: combined,
                        headers: {
                            'Cookie': 'oraclelicense=accept-securebackup-cookie'
                        }
                    }
        
                    request.head(opts, (err, resp, body) => {
                        if(err){
                            resolve(false)
                        } else {
                            dataDir = path.join(dataDir, 'runtime', 'x64')
                            const name = combined.substring(combined.lastIndexOf('/')+1)
                            const fDir = path.join(dataDir, name)
                            const jre = new Asset(name, null, resp.headers['content-length'], opts, fDir)
                            this.java = new DLTracker([jre], jre.size, (a, self) => {
                                let h = null
                                fs.createReadStream(a.to)
                                    .on('error', err => console.log(err))
                                .pipe(zlib.createGunzip())
                                    .on('error', err => console.log(err))
                                .pipe(tar.extract(dataDir, {
                                    map: (header) => {
                                        if(h == null){
                                            h = header.name
                                        }
                                    }
                                }))
                                    .on('error', err => console.log(err))
                                    .on('finish', () => {
                                        fs.unlink(a.to, err => {
                                            if(err){
                                                console.log(err)
                                            }
                                            if(h.indexOf('/') > -1){
                                                h = h.substring(0, h.indexOf('/'))
                                            }
                                            const pos = path.join(dataDir, h)
                                            self.emit('jExtracted', AssetGuard.javaExecFromRoot(pos))
                                        })
                                    })
                                
                            })
                            resolve(true)
                        }
                    })

                } else {
                    resolve(false)
                }
            })
        })

    }

    /*_enqueueMojangJRE(dir){
        return new Promise((resolve, reject) => {
            // Mojang does not host the JRE for linux.
            if(process.platform === 'linux'){
                resolve(false)
            }
            AssetGuard.loadMojangLauncherData().then(data => {
                if(data != null) {

                    try {
                        const mJRE = data[Library.mojangFriendlyOS()]['64'].jre
                        const url = mJRE.url

                        request.head(url, (err, resp, body) => {
                            if(err){
                                resolve(false)
                            } else {
                                const name = url.substring(url.lastIndexOf('/')+1)
                                const fDir = path.join(dir, name)
                                const jre = new Asset('jre' + mJRE.version, mJRE.sha1, resp.headers['content-length'], url, fDir)
                                this.java = new DLTracker([jre], jre.size, a => {
                                    fs.readFile(a.to, (err, data) => {
                                        // Data buffer needs to be decompressed from lzma,
                                        // not really possible using node.js
                                    })
                                })
                            }
                        })
                    } catch (err){
                        resolve(false)
                    }

                }
            })
        })
    }*/


    // #endregion

    // #endregion

    // Control Flow Functions
    // #region

    /**
     * Initiate an async download process for an AssetGuard DLTracker.
     * 
     * @param {string} identifier The identifier of the AssetGuard DLTracker.
     * @param {number} limit Optional. The number of async processes to run in parallel.
     * @returns {boolean} True if the process began, otherwise false.
     */
    startAsyncProcess(identifier, limit = 5){
        const self = this
        let acc = 0
        const concurrentDlTracker = this[identifier]
        const concurrentDlQueue = concurrentDlTracker.dlqueue.slice(0)
        if(concurrentDlQueue.length === 0){
            return false
        } else {
            console.log('DLQueue', concurrentDlQueue)
            async.eachLimit(concurrentDlQueue, limit, (asset, cb) => {
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
                                concurrentDlTracker.callback.apply(concurrentDlTracker, [asset, self])
                            }
                            cb()
                        })
                        req.pipe(writeStream)
                        req.resume()
                    } else {
                        req.abort()
                        const realFrom = typeof asset.from === 'object' ? asset.from.url : asset.from
                        console.log('Failed to download ' + realFrom + '. Response code', resp.statusCode)
                        self.progress += asset.size*1
                        self.emit('totaldlprogress', {acc: self.progress, total: self.totaldlsize})
                        cb()
                    }
                })
                req.on('error', (err) => {
                    self.emit('dlerror', err)
                })
                req.on('data', (chunk) => {
                    count += chunk.length
                    self.progress += chunk.length
                    acc += chunk.length
                    self.emit(identifier + 'dlprogress', acc)
                    self.emit('totaldlprogress', {acc: self.progress, total: self.totaldlsize})
                })
            }, (err) => {
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
                    if(self.extractQueue.length > 0){
                        self.emit('extracting')
                        AssetGuard._extractPackXZ(self.extractQueue, self.javaexec).then(() => {
                            self.extractQueue = []
                            self.emit('dlcomplete')
                        })
                    } else {
                        self.emit('dlcomplete')
                    }
                }
            })
            return true
        }
    }

    /**
     * This function will initiate the download processed for the specified identifiers. If no argument is
     * given, all identifiers will be initiated. Note that in order for files to be processed you need to run
     * the processing function corresponding to that identifier. If you run this function without processing
     * the files, it is likely nothing will be enqueued in the object and processing will complete
     * immediately. Once all downloads are complete, this function will fire the 'dlcomplete' event on the
     * global object instance.
     * 
     * @param {Array.<{id: string, limit: number}>} identifiers Optional. The identifiers to process and corresponding parallel async task limit.
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

    // #endregion

}

module.exports = {
    AssetGuard,
    Asset,
    Library
}