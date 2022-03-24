// Requirements
const AdmZip        = require('adm-zip')
const async         = require('async')
const child_process = require('child_process')
const crypto        = require('crypto')
const EventEmitter  = require('events')
const fs            = require('fs-extra')
const StreamZip     = require('node-stream-zip')
const path          = require('path')
const Registry      = require('winreg')
const request       = require('request')
const tar           = require('tar-fs')
const zlib          = require('zlib')

const ConfigManager = require('./configmanager')
const DistroManager = require('./distromanager')
const isDev         = require('./isdev')

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
            return 'osx'
        } else if (opSys === 'win32'){
            return 'windows'
        } else if (opSys === 'linux'){
            return 'linux'
        } else {
            return 'unknown_os'
        }
    }

    /**
     * Checks whether or not a library is valid for download on a particular OS, following
     * the rule format specified in the mojang version data index. If the allow property has
     * an OS specified, then the library can ONLY be downloaded on that OS. If the disallow
     * property has instead specified an OS, the library can be downloaded on any OS EXCLUDING
     * the one specified.
     * 
     * If the rules are undefined, the natives property will be checked for a matching entry
     * for the current OS.
     * 
     * @param {Array.<Object>} rules The Library's download rules.
     * @param {Object} natives The Library's natives object.
     * @returns {boolean} True if the Library follows the specified rules, otherwise false.
     */
    static validateRules(rules, natives){
        if(rules == null) {
            if(natives == null) {
                return true
            } else {
                return natives[Library.mojangFriendlyOS()] != null
            }
        }

        for(let rule of rules){
            const action = rule.action
            const osProp = rule.os
            if(action != null && osProp != null){
                const osName = osProp.name
                const osMoj = Library.mojangFriendlyOS()
                if(action === 'allow'){
                    return osName === osMoj
                } else if(action === 'disallow'){
                    return osName !== osMoj
                }
            }
        }
        return true
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

class Util {

    /**
     * Returns true if the actual version is greater than
     * or equal to the desired version.
     * 
     * @param {string} desired The desired version.
     * @param {string} actual The actual version.
     */
    static mcVersionAtLeast(desired, actual){
        const des = desired.split('.')
        const act = actual.split('.')

        for(let i=0; i<des.length; i++){
            if(!(parseInt(act[i]) >= parseInt(des[i]))){
                return false
            }
        }
        return true
    }

    static isForgeGradle3(mcVersion, forgeVersion) {

        if(Util.mcVersionAtLeast('1.13', mcVersion)) {
            return true
        }

        try {
            
            const forgeVer = forgeVersion.split('-')[1]

            const maxFG2 = [14, 23, 5, 2847]
            const verSplit = forgeVer.split('.').map(v => Number(v))

            for(let i=0; i<maxFG2.length; i++) {
                if(verSplit[i] > maxFG2[i]) {
                    return true
                } else if(verSplit[i] < maxFG2[i]) {
                    return false
                }
            }
        
            return false

        } catch(err) {
            throw new Error('Forge version is complex (changed).. launcher requires a patch.')
        }
    }

    static isAutoconnectBroken(forgeVersion) {

        const minWorking = [31, 2, 15]
        const verSplit = forgeVersion.split('.').map(v => Number(v))

        if(verSplit[0] === 31) {
            for(let i=0; i<minWorking.length; i++) {
                if(verSplit[i] > minWorking[i]) {
                    return false
                } else if(verSplit[i] < minWorking[i]) {
                    return true
                }
            }
        }

        return false
    }

}


class JavaGuard extends EventEmitter {

    constructor(mcVersion){
        super()
        this.mcVersion = mcVersion
    }

    /**
     * @typedef OpenJDKData
     * @property {string} uri The base uri of the JRE.
     * @property {number} size The size of the download.
     * @property {string} name The name of the artifact.
     */

    /**
     * Fetch the last open JDK binary.
     * 
     * HOTFIX: Uses Corretto 8 for macOS.
     * See: https://github.com/dscalzi/HeliosLauncher/issues/70
     * See: https://github.com/AdoptOpenJDK/openjdk-support/issues/101
     * 
     * @param {string} major The major version of Java to fetch.
     * 
     * @returns {Promise.<OpenJDKData>} Promise which resolved to an object containing the JRE download data.
     */
    static _latestOpenJDK(major = '8'){

        if(process.platform === 'darwin') {
            return this._latestCorretto(major)
        } else {
            return this._latestAdoptium(major)
        }
    }

    static _latestAdoptium(major) {

        const majorNum = Number(major)
        const sanitizedOS = process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'mac' : process.platform)
        const url = `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?vendor=eclipse`

        return new Promise((resolve, reject) => {
            request({url, json: true}, (err, resp, body) => {
                if(!err && body.length > 0){

                    const targetBinary = body.find(entry => {
                        return entry.version.major === majorNum
                            && entry.binary.os === sanitizedOS
                            && entry.binary.image_type === 'jdk'
                            && entry.binary.architecture === 'x64'
                    })

                    if(targetBinary != null) {
                        resolve({
                            uri: targetBinary.binary.package.link,
                            size: targetBinary.binary.package.size,
                            name: targetBinary.binary.package.name
                        })
                    } else {
                        resolve(null)
                    }
                } else {
                    resolve(null)
                }
            })
        })
    }

    static _latestCorretto(major) {

        let sanitizedOS, ext

        switch(process.platform) {
            case 'win32':
                sanitizedOS = 'windows'
                ext = 'zip'
                break
            case 'darwin':
                sanitizedOS = 'macos'
                ext = 'tar.gz'
                break
            case 'linux':
                sanitizedOS = 'linux'
                ext = 'tar.gz'
                break
            default:
                sanitizedOS = process.platform
                ext = 'tar.gz'
                break
        }

        const url = `https://corretto.aws/downloads/latest/amazon-corretto-${major}-x64-${sanitizedOS}-jdk.${ext}`

        return new Promise((resolve, reject) => {
            request.head({url, json: true}, (err, resp) => {
                if(!err && resp.statusCode === 200){
                    resolve({
                        uri: url,
                        size: parseInt(resp.headers['content-length']),
                        name: url.substr(url.lastIndexOf('/')+1)
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
     * the version information. Dynamically detects the formatting
     * to use.
     * 
     * @param {string} verString Full version string to parse.
     * @returns Object containing the version information.
     */
    static parseJavaRuntimeVersion(verString){
        const major = verString.split('.')[0]
        if(major == 1){
            return JavaGuard._parseJavaRuntimeVersion_8(verString)
        } else {
            return JavaGuard._parseJavaRuntimeVersion_9(verString)
        }
    }

    /**
     * Parses a **full** Java Runtime version string and resolves
     * the version information. Uses Java 8 formatting.
     * 
     * @param {string} verString Full version string to parse.
     * @returns Object containing the version information.
     */
    static _parseJavaRuntimeVersion_8(verString){
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
     * Parses a **full** Java Runtime version string and resolves
     * the version information. Uses Java 9+ formatting.
     * 
     * @param {string} verString Full version string to parse.
     * @returns Object containing the version information.
     */
    static _parseJavaRuntimeVersion_9(verString){
        // {major}.{minor}.{revision}+{build}
        // ex. 10.0.2+13
        const ret = {}
        let pts = verString.split('+')
        ret.build = parseInt(pts[1])
        pts = pts[0].split('.')
        ret.major = parseInt(pts[0])
        ret.minor = parseInt(pts[1])
        ret.revision = parseInt(pts[2])
        return ret
    }

    /**
     * Validates the output of a JVM's properties. Currently validates that a JRE is x64
     * and that the major = 8, update > 52.
     * 
     * @param {string} stderr The output to validate.
     * 
     * @returns {Promise.<Object>} A promise which resolves to a meta object about the JVM.
     * The validity is stored inside the `valid` property.
     */
    _validateJVMProperties(stderr){
        const res = stderr
        const props = res.split('\n')

        const goal = 2
        let checksum = 0

        const meta = {}

        for(let i=0; i<props.length; i++){
            if(props[i].indexOf('sun.arch.data.model') > -1){
                let arch = props[i].split('=')[1].trim()
                arch = parseInt(arch)
                console.log(props[i].trim())
                if(arch === 64){
                    meta.arch = arch
                    ++checksum
                    if(checksum === goal){
                        break
                    }
                }
            } else if(props[i].indexOf('java.runtime.version') > -1){
                let verString = props[i].split('=')[1].trim()
                console.log(props[i].trim())
                const verOb = JavaGuard.parseJavaRuntimeVersion(verString)
                if(verOb.major < 9){
                    // Java 8
                    if(verOb.major === 8 && verOb.update > 52){
                        meta.version = verOb
                        ++checksum
                        if(checksum === goal){
                            break
                        }
                    }
                } else {
                    // Java 9+
                    if(Util.mcVersionAtLeast('1.13', this.mcVersion)){
                        console.log('Java 9+ not yet tested.')
                        /* meta.version = verOb
                        ++checksum
                        if(checksum === goal){
                            break
                        } */
                    }
                }
                // Space included so we get only the vendor.
            } else if(props[i].lastIndexOf('java.vendor ') > -1) {
                let vendorName = props[i].split('=')[1].trim()
                console.log(props[i].trim())
                meta.vendor = vendorName
            }
        }

        meta.valid = checksum === goal
        
        return meta
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
     * @returns {Promise.<Object>} A promise which resolves to a meta object about the JVM.
     * The validity is stored inside the `valid` property.
     */
    _validateJavaBinary(binaryExecPath){

        return new Promise((resolve, reject) => {
            if(!JavaGuard.isJavaExecPath(binaryExecPath)){
                resolve({valid: false})
            } else if(fs.existsSync(binaryExecPath)){
                // Workaround (javaw.exe no longer outputs this information.)
                console.log(typeof binaryExecPath)
                if(binaryExecPath.indexOf('javaw.exe') > -1) {
                    binaryExecPath.replace('javaw.exe', 'java.exe')
                }
                child_process.exec('"' + binaryExecPath + '" -XshowSettings:properties', (err, stdout, stderr) => {
                    try {
                        // Output is stored in stderr?
                        resolve(this._validateJVMProperties(stderr))
                    } catch (err){
                        // Output format might have changed, validation cannot be completed.
                        resolve({valid: false})
                    }
                })
            } else {
                resolve({valid: false})
            }
        })
        
    }

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

            // Keys for Java 1.8 and prior:
            const regKeys = [
                '\\SOFTWARE\\JavaSoft\\Java Runtime Environment',
                '\\SOFTWARE\\JavaSoft\\Java Development Kit'
            ]

            let keysDone = 0

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
                                keysDone++
                                console.error(err)

                                // REG KEY DONE
                                // DUE TO ERROR
                                if(keysDone === regKeys.length){
                                    resolve(candidates)
                                }
                            } else {
                                if(javaVers.length === 0){
                                    // REG KEY DONE
                                    // NO SUBKEYS
                                    keysDone++
                                    if(keysDone === regKeys.length){
                                        resolve(candidates)
                                    }
                                } else {

                                    let numDone = 0

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

                                                // SUBKEY DONE

                                                numDone++
                                                if(numDone === javaVers.length){
                                                    keysDone++
                                                    if(keysDone === regKeys.length){
                                                        resolve(candidates)
                                                    }
                                                }
                                            })
                                        } else {

                                            // SUBKEY DONE
                                            // NOT JAVA 8

                                            numDone++
                                            if(numDone === javaVers.length){
                                                keysDone++
                                                if(keysDone === regKeys.length){
                                                    resolve(candidates)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        })
                    } else {

                        // REG KEY DONE
                        // DUE TO NON-EXISTANCE

                        keysDone++
                        if(keysDone === regKeys.length){
                            resolve(candidates)
                        }
                    }
                })
            }

        })
        
    }

    /**
     * See if JRE exists in the Internet Plug-Ins folder.
     * 
     * @returns {string} The path of the JRE if found, otherwise null.
     */
    static _scanInternetPlugins(){
        // /Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java
        const pth = '/Library/Internet Plug-Ins/JavaAppletPlugin.plugin'
        const res = fs.existsSync(JavaGuard.javaExecFromRoot(pth))
        return res ? pth : null
    }

    /**
     * Scan a directory for root JVM folders.
     * 
     * @param {string} scanDir The directory to scan.
     * @returns {Promise.<Set.<string>>} A promise which resolves to a set of the discovered
     * root JVM folders.
     */
    static async _scanFileSystem(scanDir){

        let res = new Set()

        if(await fs.pathExists(scanDir)) {

            const files = await fs.readdir(scanDir)
            for(let i=0; i<files.length; i++){

                const combinedPath = path.join(scanDir, files[i])
                const execPath = JavaGuard.javaExecFromRoot(combinedPath)

                if(await fs.pathExists(execPath)) {
                    res.add(combinedPath)
                }
            }
        }

        return res

    }

    /**
     * 
     * @param {Set.<string>} rootSet A set of JVM root strings to validate.
     * @returns {Promise.<Object[]>} A promise which resolves to an array of meta objects
     * for each valid JVM root directory.
     */
    async _validateJavaRootSet(rootSet){

        const rootArr = Array.from(rootSet)
        const validArr = []

        for(let i=0; i<rootArr.length; i++){

            const execPath = JavaGuard.javaExecFromRoot(rootArr[i])
            const metaOb = await this._validateJavaBinary(execPath)

            if(metaOb.valid){
                metaOb.execPath = execPath
                validArr.push(metaOb)
            }

        }

        return validArr

    }

    /**
     * Sort an array of JVM meta objects. Best candidates are placed before all others.
     * Sorts based on version and gives priority to JREs over JDKs if versions match.
     * 
     * @param {Object[]} validArr An array of JVM meta objects.
     * @returns {Object[]} A sorted array of JVM meta objects.
     */
    static _sortValidJavaArray(validArr){
        const retArr = validArr.sort((a, b) => {

            if(a.version.major === b.version.major){
                
                if(a.version.major < 9){
                    // Java 8
                    if(a.version.update === b.version.update){
                        if(a.version.build === b.version.build){
    
                            // Same version, give priority to JRE.
                            if(a.execPath.toLowerCase().indexOf('jdk') > -1){
                                return b.execPath.toLowerCase().indexOf('jdk') > -1 ? 0 : 1
                            } else {
                                return -1
                            }
    
                        } else {
                            return a.version.build > b.version.build ? -1 : 1
                        }
                    } else {
                        return  a.version.update > b.version.update ? -1 : 1
                    }
                } else {
                    // Java 9+
                    if(a.version.minor === b.version.minor){
                        if(a.version.revision === b.version.revision){
    
                            // Same version, give priority to JRE.
                            if(a.execPath.toLowerCase().indexOf('jdk') > -1){
                                return b.execPath.toLowerCase().indexOf('jdk') > -1 ? 0 : 1
                            } else {
                                return -1
                            }
    
                        } else {
                            return a.version.revision > b.version.revision ? -1 : 1
                        }
                    } else {
                        return  a.version.minor > b.version.minor ? -1 : 1
                    }
                }

            } else {
                return a.version.major > b.version.major ? -1 : 1
            }
        })

        return retArr
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
    async _win32JavaValidate(dataDir){

        // Get possible paths from the registry.
        let pathSet1 = await JavaGuard._scanRegistry()
        if(pathSet1.size === 0){
            // Do a manual file system scan of program files.
            pathSet1 = new Set([
                ...pathSet1,
                ...(await JavaGuard._scanFileSystem('C:\\Program Files\\Java')),
                ...(await JavaGuard._scanFileSystem('C:\\Program Files\\Eclipse Foundation')),
                ...(await JavaGuard._scanFileSystem('C:\\Program Files\\AdoptOpenJDK'))
            ])
        }

        // Get possible paths from the data directory.
        const pathSet2 = await JavaGuard._scanFileSystem(path.join(dataDir, 'runtime', 'x64'))

        // Merge the results.
        const uberSet = new Set([...pathSet1, ...pathSet2])

        // Validate JAVA_HOME.
        const jHome = JavaGuard._scanJavaHome()
        if(jHome != null && jHome.indexOf('(x86)') === -1){
            uberSet.add(jHome)
        }

        let pathArr = await this._validateJavaRootSet(uberSet)
        pathArr = JavaGuard._sortValidJavaArray(pathArr)

        if(pathArr.length > 0){
            return pathArr[0].execPath
        } else {
            return null
        }

    }

    /**
     * Attempts to find a valid x64 installation of Java on MacOS.
     * The system JVM directory is scanned for possible installations.
     * The JAVA_HOME enviroment variable and internet plugins directory
     * are also scanned and validated.
     * 
     * Higher versions > Lower versions
     * If versions are equal, JRE > JDK.
     * 
     * @param {string} dataDir The base launcher directory.
     * @returns {Promise.<string>} A Promise which resolves to the executable path of a valid 
     * x64 Java installation. If none are found, null is returned.
     */
    async _darwinJavaValidate(dataDir){

        const pathSet1 = await JavaGuard._scanFileSystem('/Library/Java/JavaVirtualMachines')
        const pathSet2 = await JavaGuard._scanFileSystem(path.join(dataDir, 'runtime', 'x64'))

        const uberSet = new Set([...pathSet1, ...pathSet2])

        // Check Internet Plugins folder.
        const iPPath = JavaGuard._scanInternetPlugins()
        if(iPPath != null){
            uberSet.add(iPPath)
        }

        // Check the JAVA_HOME environment variable.
        let jHome = JavaGuard._scanJavaHome()
        if(jHome != null){
            // Ensure we are at the absolute root.
            if(jHome.contains('/Contents/Home')){
                jHome = jHome.substring(0, jHome.indexOf('/Contents/Home'))
            }
            uberSet.add(jHome)
        }

        let pathArr = await this._validateJavaRootSet(uberSet)
        pathArr = JavaGuard._sortValidJavaArray(pathArr)

        if(pathArr.length > 0){
            return pathArr[0].execPath
        } else {
            return null
        }
    }

    /**
     * Attempts to find a valid x64 installation of Java on Linux.
     * The system JVM directory is scanned for possible installations.
     * The JAVA_HOME enviroment variable is also scanned and validated.
     * 
     * Higher versions > Lower versions
     * If versions are equal, JRE > JDK.
     * 
     * @param {string} dataDir The base launcher directory.
     * @returns {Promise.<string>} A Promise which resolves to the executable path of a valid 
     * x64 Java installation. If none are found, null is returned.
     */
    async _linuxJavaValidate(dataDir){

        const pathSet1 = await JavaGuard._scanFileSystem('/usr/lib/jvm')
        const pathSet2 = await JavaGuard._scanFileSystem(path.join(dataDir, 'runtime', 'x64'))
        
        const uberSet = new Set([...pathSet1, ...pathSet2])

        // Validate JAVA_HOME
        const jHome = JavaGuard._scanJavaHome()
        if(jHome != null){
            uberSet.add(jHome)
        }
        
        let pathArr = await this._validateJavaRootSet(uberSet)
        pathArr = JavaGuard._sortValidJavaArray(pathArr)

        if(pathArr.length > 0){
            return pathArr[0].execPath
        } else {
            return null
        }
    }

    /**
     * Retrieve the path of a valid x64 Java installation.
     * 
     * @param {string} dataDir The base launcher directory.
     * @returns {string} A path to a valid x64 Java installation, null if none found.
     */
    async validateJava(dataDir){
        return await this['_' + process.platform + 'JavaValidate'](dataDir)
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
class AssetGuard extends EventEmitter {

    /**
     * Create an instance of AssetGuard.
     * On creation the object's properties are never-null default
     * values. Each identifier is resolved to an empty DLTracker.
     * 
     * @param {string} commonPath The common path for shared game files.
     * @param {string} javaexec The path to a java executable which will be used
     * to finalize installation.
     */
    constructor(commonPath, javaexec){
        super()
        this.totaldlsize = 0
        this.progress = 0
        this.assets = new DLTracker([], 0)
        this.libraries = new DLTracker([], 0)
        this.files = new DLTracker([], 0)
        this.forge = new DLTracker([], 0)
        this.java = new DLTracker([], 0)
        this.extractQueue = []
        this.commonPath = commonPath
        this.javaexec = javaexec
    }

    // Static Utility Functions
    // #region

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
            let buf = fs.readFileSync(filePath)
            let calcdhash = AssetGuard._calculateHash(buf, algo)
            return calcdhash === hash.toLowerCase()
        }
        return false
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
     * @param {string} commonPath The common path for shared game files.
     * @returns {Promise.<Object>} A promise which resolves to the contents of forge's version.json.
     */
    static _finalizeForgeAsset(asset, commonPath){
        return new Promise((resolve, reject) => {
            fs.readFile(asset.to, (err, data) => {
                const zip = new AdmZip(data)
                const zipEntries = zip.getEntries()

                for(let i=0; i<zipEntries.length; i++){
                    if(zipEntries[i].entryName === 'version.json'){
                        const forgeVersion = JSON.parse(zip.readAsText(zipEntries[i]))
                        const versionPath = path.join(commonPath, 'versions', forgeVersion.id)
                        const versionFile = path.join(versionPath, forgeVersion.id + '.json')
                        if(!fs.existsSync(versionFile)){
                            fs.ensureDirSync(versionPath)
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
        return new Promise(async (resolve, reject) => {
            const versionPath = path.join(self.commonPath, 'versions', version)
            const versionFile = path.join(versionPath, version + '.json')
            if(!fs.existsSync(versionFile) || force){
                const url = await self._getVersionDataUrl(version)
                //This download will never be tracked as it's essential and trivial.
                console.log('Preparing download of ' + version + ' assets.')
                fs.ensureDirSync(versionPath)
                const stream = request(url).pipe(fs.createWriteStream(versionFile))
                stream.on('finish', () => {
                    resolve(JSON.parse(fs.readFileSync(versionFile)))
                })
            } else {
                resolve(JSON.parse(fs.readFileSync(versionFile)))
            }
        })
    }

    /**
     * Parses Mojang's version manifest and retrieves the url of the version
     * data index.
     * 
     * @param {string} version The version to lookup.
     * @returns {Promise.<string>} Promise which resolves to the url of the version data index.
     * If the version could not be found, resolves to null.
     */
    _getVersionDataUrl(version){
        return new Promise((resolve, reject) => {
            request('https://launchermeta.mojang.com/mc/game/version_manifest.json', (error, resp, body) => {
                if(error){
                    reject(error)
                } else {
                    const manifest = JSON.parse(body)

                    for(let v of manifest.versions){
                        if(v.id === version){
                            resolve(v.url)
                        }
                    }

                    resolve(null)
                }
            })
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
            const indexPath = path.join(self.commonPath, 'assets', 'indexes')
            const assetIndexLoc = path.join(indexPath, name)

            let data = null
            if(!fs.existsSync(assetIndexLoc) || force){
                console.log('Downloading ' + versionData.id + ' asset index.')
                fs.ensureDirSync(indexPath)
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
            const resourceURL = 'https://resources.download.minecraft.net/'
            const localPath = path.join(self.commonPath, 'assets')
            const objectPath = path.join(localPath, 'objects')

            const assetDlQueue = []
            let dlSize = 0
            let acc = 0
            const total = Object.keys(indexData.objects).length
            //const objKeys = Object.keys(data.objects)
            async.forEachOfLimit(indexData.objects, 10, (value, key, cb) => {
                acc++
                self.emit('progress', 'assets', acc, total)
                const hash = value.hash
                const assetName = path.join(hash.substring(0, 2), hash)
                const urlName = hash.substring(0, 2) + '/' + hash
                const ast = new Asset(key, hash, value.size, resourceURL + urlName, path.join(objectPath, assetName))
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
            const libPath = path.join(self.commonPath, 'libraries')

            const libDlQueue = []
            let dlSize = 0

            //Check validity of each library. If the hashs don't match, download the library.
            async.eachLimit(libArr, 5, (lib, cb) => {
                if(Library.validateRules(lib.rules, lib.natives)){
                    let artifact = (lib.natives == null) ? lib.downloads.artifact : lib.downloads.classifiers[lib.natives[Library.mojangFriendlyOS()].replace('${arch}', process.arch.replace('x', ''))]
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
            const targetPath = path.join(self.commonPath, 'versions', version)
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
            const targetPath = path.join(self.commonPath, 'assets', 'log_configs')

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
     * @param {Server} server The Server to validate.
     * @returns {Promise.<Object>} A promise which resolves to the server distribution object.
     */
    validateDistribution(server){
        const self = this
        return new Promise((resolve, reject) => {
            self.forge = self._parseDistroModules(server.getModules(), server.getMinecraftVersion(), server.getID())
            resolve(server)
        })
    }

    _parseDistroModules(modules, version, servid){
        let alist = []
        let asize = 0
        for(let ob of modules){
            let obArtifact = ob.getArtifact()
            let obPath = obArtifact.getPath()
            let artifact = new DistroModule(ob.getIdentifier(), obArtifact.getHash(), obArtifact.getSize(), obArtifact.getURL(), obPath, ob.getType())
            const validationPath = obPath.toLowerCase().endsWith('.pack.xz') ? obPath.substring(0, obPath.toLowerCase().lastIndexOf('.pack.xz')) : obPath
            if(!AssetGuard._validateLocal(validationPath, 'MD5', artifact.hash)){
                asize += artifact.size*1
                alist.push(artifact)
                if(validationPath !== obPath) this.extractQueue.push(obPath)
            }
            //Recursively process the submodules then combine the results.
            if(ob.getSubModules() != null){
                let dltrack = this._parseDistroModules(ob.getSubModules(), version, servid)
                asize += dltrack.dlsize*1
                alist = alist.concat(dltrack.dlqueue)
            }
        }

        return new DLTracker(alist, asize)
    }

    /**
     * Loads Forge's version.json data into memory for the specified server id.
     * 
     * @param {string} server The Server to load Forge data for.
     * @returns {Promise.<Object>} A promise which resolves to Forge's version.json data.
     */
    loadForgeData(server){
        const self = this
        return new Promise(async (resolve, reject) => {
            const modules = server.getModules()
            for(let ob of modules){
                const type = ob.getType()
                if(type === DistroManager.Types.ForgeHosted || type === DistroManager.Types.Forge){
                    if(Util.isForgeGradle3(server.getMinecraftVersion(), ob.getVersion())){
                        // Read Manifest
                        for(let sub of ob.getSubModules()){
                            if(sub.getType() === DistroManager.Types.VersionManifest){
                                resolve(JSON.parse(fs.readFileSync(sub.getArtifact().getPath(), 'utf-8')))
                                return
                            }
                        }
                        reject('No forge version manifest found!')
                        return
                    } else {
                        let obArtifact = ob.getArtifact()
                        let obPath = obArtifact.getPath()
                        let asset = new DistroModule(ob.getIdentifier(), obArtifact.getHash(), obArtifact.getSize(), obArtifact.getURL(), obPath, type)
                        try {
                            let forgeData = await AssetGuard._finalizeForgeAsset(asset, self.commonPath)
                            resolve(forgeData)
                        } catch (err){
                            reject(err)
                        }
                        return
                    }
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

    _enqueueOpenJDK(dataDir){
        return new Promise((resolve, reject) => {
            JavaGuard._latestOpenJDK('8').then(verData => {
                if(verData != null){

                    dataDir = path.join(dataDir, 'runtime', 'x64')
                    const fDir = path.join(dataDir, verData.name)
                    const jre = new Asset(verData.name, null, verData.size, verData.uri, fDir)
                    this.java = new DLTracker([jre], jre.size, (a, self) => {
                        if(verData.name.endsWith('zip')){

                            this._extractJdkZip(a.to, dataDir, self)

                        } else {
                            // Tar.gz
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
                                        self.emit('complete', 'java', JavaGuard.javaExecFromRoot(pos))
                                    })
                                })
                        }
                    })
                    resolve(true)

                } else {
                    resolve(false)
                }
            })
        })

    }

    async _extractJdkZip(zipPath, runtimeDir, self) {
                            
        const zip = new StreamZip.async({
            file: zipPath,
            storeEntries: true
        })

        let pos = ''
        try {
            const entries = await zip.entries()
            pos = path.join(runtimeDir, Object.keys(entries)[0])

            console.log('Extracting jdk..')
            await zip.extract(null, runtimeDir)
            console.log('Cleaning up..')
            await fs.remove(zipPath)
            console.log('Jdk extraction complete.')

        } catch(err) {
            console.log(err)
        } finally {
            zip.close()
            self.emit('complete', 'java', JavaGuard.javaExecFromRoot(pos))
        }
    }

    // _enqueueMojangJRE(dir){
    //     return new Promise((resolve, reject) => {
    //         // Mojang does not host the JRE for linux.
    //         if(process.platform === 'linux'){
    //             resolve(false)
    //         }
    //         AssetGuard.loadMojangLauncherData().then(data => {
    //             if(data != null) {

    //                 try {
    //                     const mJRE = data[Library.mojangFriendlyOS()]['64'].jre
    //                     const url = mJRE.url

    //                     request.head(url, (err, resp, body) => {
    //                         if(err){
    //                             resolve(false)
    //                         } else {
    //                             const name = url.substring(url.lastIndexOf('/')+1)
    //                             const fDir = path.join(dir, name)
    //                             const jre = new Asset('jre' + mJRE.version, mJRE.sha1, resp.headers['content-length'], url, fDir)
    //                             this.java = new DLTracker([jre], jre.size, a => {
    //                                 fs.readFile(a.to, (err, data) => {
    //                                     // Data buffer needs to be decompressed from lzma,
    //                                     // not really possible using node.js
    //                                 })
    //                             })
    //                         }
    //                     })
    //                 } catch (err){
    //                     resolve(false)
    //                 }

    //             }
    //         })
    //     })
    // }


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
        const dlTracker = this[identifier]
        const dlQueue = dlTracker.dlqueue

        if(dlQueue.length > 0){
            console.log('DLQueue', dlQueue)

            async.eachLimit(dlQueue, limit, (asset, cb) => {

                fs.ensureDirSync(path.join(asset.to, '..'))

                let req = request(asset.from)
                req.pause()

                req.on('response', (resp) => {

                    if(resp.statusCode === 200){

                        let doHashCheck = false
                        const contentLength = parseInt(resp.headers['content-length'])

                        if(contentLength !== asset.size){
                            console.log(`WARN: Got ${contentLength} bytes for ${asset.id}: Expected ${asset.size}`)
                            doHashCheck = true

                            // Adjust download
                            this.totaldlsize -= asset.size
                            this.totaldlsize += contentLength
                        }

                        let writeStream = fs.createWriteStream(asset.to)
                        writeStream.on('close', () => {
                            if(dlTracker.callback != null){
                                dlTracker.callback.apply(dlTracker, [asset, self])
                            }

                            if(doHashCheck){
                                const v = AssetGuard._validateLocal(asset.to, asset.type != null ? 'md5' : 'sha1', asset.hash)
                                if(v){
                                    console.log(`Hashes match for ${asset.id}, byte mismatch is an issue in the distro index.`)
                                } else {
                                    console.error(`Hashes do not match, ${asset.id} may be corrupted.`)
                                }
                            }

                            cb()
                        })
                        req.pipe(writeStream)
                        req.resume()

                    } else {

                        req.abort()
                        console.log(`Failed to download ${asset.id}(${typeof asset.from === 'object' ? asset.from.url : asset.from}). Response code ${resp.statusCode}`)
                        self.progress += asset.size*1
                        self.emit('progress', 'download', self.progress, self.totaldlsize)
                        cb()

                    }

                })

                req.on('error', (err) => {
                    self.emit('error', 'download', err)
                })

                req.on('data', (chunk) => {
                    self.progress += chunk.length
                    self.emit('progress', 'download', self.progress, self.totaldlsize)
                })

            }, (err) => {

                if(err){
                    console.log('An item in ' + identifier + ' failed to process')
                } else {
                    console.log('All ' + identifier + ' have been processed successfully')
                }

                //self.totaldlsize -= dlTracker.dlsize
                //self.progress -= dlTracker.dlsize
                self[identifier] = new DLTracker([], 0)

                if(self.progress >= self.totaldlsize) {
                    if(self.extractQueue.length > 0){
                        self.emit('progress', 'extract', 1, 1)
                        //self.emit('extracting')
                        AssetGuard._extractPackXZ(self.extractQueue, self.javaexec).then(() => {
                            self.extractQueue = []
                            self.emit('complete', 'download')
                        })
                    } else {
                        self.emit('complete', 'download')
                    }
                }

            })

            return true

        } else {
            return false
        }
    }

    /**
     * This function will initiate the download processed for the specified identifiers. If no argument is
     * given, all identifiers will be initiated. Note that in order for files to be processed you need to run
     * the processing function corresponding to that identifier. If you run this function without processing
     * the files, it is likely nothing will be enqueued in the object and processing will complete
     * immediately. Once all downloads are complete, this function will fire the 'complete' event on the
     * global object instance.
     * 
     * @param {Array.<{id: string, limit: number}>} identifiers Optional. The identifiers to process and corresponding parallel async task limit.
     */
    processDlQueues(identifiers = [{id:'assets', limit:20}, {id:'libraries', limit:5}, {id:'files', limit:5}, {id:'forge', limit:5}]){
        return new Promise((resolve, reject) => {
            let shouldFire = true

            // Assign dltracking variables.
            this.totaldlsize = 0
            this.progress = 0

            for(let iden of identifiers){
                this.totaldlsize += this[iden.id].dlsize
            }

            this.once('complete', (data) => {
                resolve()
            })

            for(let iden of identifiers){
                let r = this.startAsyncProcess(iden.id, iden.limit)
                if(r) shouldFire = false
            }

            if(shouldFire){
                this.emit('complete', 'download')
            }
        })
    }

    async validateEverything(serverid, dev = false){

        try {
            if(!ConfigManager.isLoaded()){
                ConfigManager.load()
            }
            DistroManager.setDevMode(dev)
            const dI = await DistroManager.pullLocal()
    
            const server = dI.getServer(serverid)
    
            // Validate Everything
    
            await this.validateDistribution(server)
            this.emit('validate', 'distribution')
            const versionData = await this.loadVersionData(server.getMinecraftVersion())
            this.emit('validate', 'version')
            await this.validateAssets(versionData)
            this.emit('validate', 'assets')
            await this.validateLibraries(versionData)
            this.emit('validate', 'libraries')
            await this.validateMiscellaneous(versionData)
            this.emit('validate', 'files')
            await this.processDlQueues()
            //this.emit('complete', 'download')
            const forgeData = await this.loadForgeData(server)
        
            return {
                versionData,
                forgeData
            }

        } catch (err){
            return {
                versionData: null,
                forgeData: null,
                error: err
            }
        }
        

    }

    // #endregion

}

module.exports = {
    Util,
    AssetGuard,
    JavaGuard,
    Asset,
    Library
}