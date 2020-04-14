import { EventEmitter } from 'events'
import request from 'request'
import { join } from 'path'
import { pathExistsSync, pathExists, readdir, exists, readFileSync, createWriteStream, ensureDirSync, readFile, writeFileSync, unlink, createReadStream, readJsonSync } from 'fs-extra'
import Registry from 'winreg'
import { exec, spawn } from 'child_process'
import { LauncherJson } from '../asset/model/mojang/LauncherJson'
import { createHash } from 'crypto'
import AdmZip from 'adm-zip'
import { forEachOfLimit, eachLimit } from 'async'
import { extract } from 'tar-fs'
import { createGunzip } from 'zlib'
import { VersionJson, AssetIndex, Rule, Natives, Library } from '../asset/model/mojang/VersionJson'

import { ConfigManager } from '../config/configmanager'
import isDev from '../util/isdev'
const DistroManager = require('./distromanager')

// Constants
// const PLATFORM_MAP = {
//     win32: '-windows-x64.tar.gz',
//     darwin: '-macosx-x64.tar.gz',
//     linux: '-linux-x64.tar.gz'
// }

// Classes

/** Class representing a base asset. */
export class Asset {
    /**
     * Create an asset.
     * 
     * @param {any} id The id of the asset.
     * @param {string} hash The hash value of the asset.
     * @param {number} size The size in bytes of the asset.
     * @param {string} from The url where the asset can be found.
     * @param {string} to The absolute local file path of the asset.
     */
    constructor(
        public id: any,
        public hash: string,
        public size: number,
        public from: string,
        public to: string
    ) {}
}

/** Class representing a mojang library. */
export class LibraryInternal extends Asset {

    /**
     * Converts the process.platform OS names to match mojang's OS names.
     */
    public static mojangFriendlyOS(){
        const opSys = process.platform
        if (opSys === 'darwin') {
            return 'osx'
        } else if (opSys === 'win32'){
            return 'windows'
        } else if (opSys === 'linux'){
            return 'linux'
        } else {
            return null
        }
    }

    // TODO types
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
    public static validateRules(rules: Rule[] | null | undefined, natives: Natives | null | undefined){
        if(rules == null) {
            if(natives == null) {
                return true
            } else {
                return natives[LibraryInternal.mojangFriendlyOS()!] != null
            }
        }

        for(let rule of rules){
            const action = rule.action
            const osProp = rule.os
            if(action != null && osProp != null){
                const osName = osProp.name
                const osMoj = LibraryInternal.mojangFriendlyOS()
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
    constructor(
        id: any,
        hash: string,
        size: number,
        from: string,
        to: string,
        public type: string
    ) {
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
    constructor(
        public dlqueue: Asset[],
        public dlsize: number,
        public callback?: (asset: Asset, ...args: any[]) => void
    ) {}

}

export class Util {

    /**
     * Returns true if the actual version is greater than
     * or equal to the desired version.
     * 
     * @param {string} desired The desired version.
     * @param {string} actual The actual version.
     */
    public static mcVersionAtLeast(desired: string, actual: string){
        const des = desired.split('.')
        const act = actual.split('.')

        for(let i=0; i<des.length; i++){
            if(!(parseInt(act[i]) >= parseInt(des[i]))){
                return false
            }
        }
        return true
    }

}

interface OpenJDKData {
    uri: string
    size: number
    name: string
}

interface JDK8Version {
    major: number
    update: number
    build: number
}

interface JDK9Version {
    major: number
    minor: number
    revision: number
    build: number
}

interface JVMMeta {
    arch?: number
    version?: JDK8Version | JDK9Version
    execPath?: string
    valid: boolean // Above properties are present if valid.
}

export class JavaGuard extends EventEmitter {

    constructor(
        public mcVersion: string
    ) {
        super()
    }

    // /**
    //  * @typedef OracleJREData
    //  * @property {string} uri The base uri of the JRE.
    //  * @property {{major: string, update: string, build: string}} version Object containing version information.
    //  */

    // /**
    //  * Resolves the latest version of Oracle's JRE and parses its download link.
    //  * 
    //  * @returns {Promise.<OracleJREData>} Promise which resolved to an object containing the JRE download data.
    //  */
    // static _latestJREOracle(){

    //     const url = 'https://www.oracle.com/technetwork/java/javase/downloads/jre8-downloads-2133155.html'
    //     const regex = /https:\/\/.+?(?=\/java)\/java\/jdk\/([0-9]+u[0-9]+)-(b[0-9]+)\/([a-f0-9]{32})?\/jre-\1/
    
    //     return new Promise((resolve, reject) => {
    //         request(url, (err, resp, body) => {
    //             if(!err){
    //                 const arr = body.match(regex)
    //                 const verSplit = arr[1].split('u')
    //                 resolve({
    //                     uri: arr[0],
    //                     version: {
    //                         major: verSplit[0],
    //                         update: verSplit[1],
    //                         build: arr[2]
    //                     }
    //                 })
    //             } else {
    //                 resolve(null)
    //             }
    //         })
    //     })
    // }

    /**
     * Fetch the last open JDK binary. Uses https://api.adoptopenjdk.net/
     * 
     * @param {string} major The major version of Java to fetch.
     * 
     * @returns {Promise.<OpenJDKData>} Promise which resolved to an object containing the JRE download data.
     */
    // TODO reject not null use try catch in caller
    public static latestOpenJDK(major = '8'): Promise<OpenJDKData | null> {

        const sanitizedOS = process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'mac' : process.platform)

        const url = `https://api.adoptopenjdk.net/v2/latestAssets/nightly/openjdk${major}?os=${sanitizedOS}&arch=x64&heap_size=normal&openjdk_impl=hotspot&type=jre`
        
        return new Promise((resolve, reject) => {
            request({url, json: true}, (err, resp, body) => {
                if(!err && body.length > 0){
                    resolve({
                        uri: body[0].binary_link,
                        size: body[0].binary_size,
                        name: body[0].binary_name
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
    public static javaExecFromRoot(rootDir: string){
        if(process.platform === 'win32'){
            return join(rootDir, 'bin', 'javaw.exe')
        } else if(process.platform === 'darwin'){
            return join(rootDir, 'Contents', 'Home', 'bin', 'java')
        } else if(process.platform === 'linux'){
            return join(rootDir, 'bin', 'java')
        }
        return rootDir
    }

    /**
     * Check to see if the given path points to a Java executable.
     * 
     * @param {string} pth The path to check against.
     * @returns {boolean} True if the path points to a Java executable, otherwise false.
     */
    public static isJavaExecPath(pth: string){
        if(process.platform === 'win32'){
            return pth.endsWith(join('bin', 'javaw.exe'))
        } else if(process.platform === 'darwin'){
            return pth.endsWith(join('bin', 'java'))
        } else if(process.platform === 'linux'){
            return pth.endsWith(join('bin', 'java'))
        }
        return false
    }

    /**
     * Load Mojang's launcher.json file.
     * 
     * @returns {Promise.<Object>} Promise which resolves to Mojang's launcher.json object.
     */
    // TODO reject and have caller try catch
    public static loadMojangLauncherData(): Promise<LauncherJson | null> {
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
    public static parseJavaRuntimeVersion(verString: string){
        const major = Number(verString.split('.')[0])
        if(major === 1){
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
    public static _parseJavaRuntimeVersion_8(verString: string): JDK8Version {
        // 1.{major}.0_{update}-b{build}
        // ex. 1.8.0_152-b16
        const ptsOne = verString.split('-')
        const ptsTwo = ptsOne[0].split('_')
        return {
            major: parseInt(ptsTwo[0].split('.')[1]),
            update: parseInt(ptsTwo[1]),
            build: parseInt(ptsOne[1].substring(1))
        }
    }

    /**
     * Parses a **full** Java Runtime version string and resolves
     * the version information. Uses Java 9+ formatting.
     * 
     * @param {string} verString Full version string to parse.
     * @returns Object containing the version information.
     */
    public static _parseJavaRuntimeVersion_9(verString: string): JDK9Version {
        // {major}.{minor}.{revision}+{build}
        // ex. 10.0.2+13
        const ptsOne = verString.split('+')
        const ptsTwo = ptsOne[0].split('.')
        return {
            major: parseInt(ptsTwo[0]),
            minor: parseInt(ptsTwo[1]),
            revision: parseInt(ptsTwo[2]),
            build: parseInt(ptsOne[1])
        }
    }

    /**
     * Validates the output of a JVM's properties. Currently validates that a JRE is x64
     * and that the major = 8, update > 52.
     * 
     * @param {string} stderr The output to validate.
     * 
     * @returns {JVMMeta} A meta object about the JVM.
     * The validity is stored inside the `valid` property.
     */
    private _validateJVMProperties(stderr: string) {
        const res = stderr
        const props = res.split('\n')

        const goal = 2
        let checksum = 0

        const meta: any = {}

        for(let i=0; i<props.length; i++){
            if(props[i].indexOf('sun.arch.data.model') > -1){
                const arch = parseInt(props[i].split('=')[1].trim())
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
                    if(verOb.major === 8 && (verOb as JDK8Version).update > 52){
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
            }
        }

        meta.valid = checksum === goal
        
        return meta as JVMMeta
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
     * @returns {Promise.<JVMMeta>} A promise which resolves to a meta object about the JVM.
     * The validity is stored inside the `valid` property.
     */
    private _validateJavaBinary(binaryExecPath: string): Promise<JVMMeta> {

        return new Promise((resolve, reject) => {
            if(!JavaGuard.isJavaExecPath(binaryExecPath)){
                resolve({valid: false})
            } else if(pathExistsSync(binaryExecPath)){
                // Workaround (javaw.exe no longer outputs this information.)
                console.log(typeof binaryExecPath)
                if(binaryExecPath.indexOf('javaw.exe') > -1) {
                    binaryExecPath.replace('javaw.exe', 'java.exe')
                }
                exec('"' + binaryExecPath + '" -XshowSettings:properties', (err, stdout, stderr) => {
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
    private static _scanJavaHome(){
        const jHome = process.env.JAVA_HOME as string
        try {
            let res = pathExistsSync(jHome)
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
    private static _scanRegistry(): Promise<Set<string>> {

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

            const candidates = new Set<string>()

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
    private static _scanInternetPlugins(){
        // /Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java
        const pth = '/Library/Internet Plug-Ins/JavaAppletPlugin.plugin'
        const res = pathExistsSync(JavaGuard.javaExecFromRoot(pth))
        return res ? pth : null
    }

    /**
     * Scan a directory for root JVM folders.
     * 
     * @param {string} scanDir The directory to scan.
     * @returns {Promise.<Set.<string>>} A promise which resolves to a set of the discovered
     * root JVM folders.
     */
    private static _scanFileSystem(scanDir: string): Promise<Set<string>> {
        return new Promise((resolve, reject) => {

            pathExists(scanDir, (e) => {

                let res = new Set<string>()
                
                if(e){
                    readdir(scanDir, (err, files) => {
                        if(err){
                            resolve(res)
                            console.log(err)
                        } else {
                            let pathsDone = 0

                            for(let i=0; i<files.length; i++){

                                const combinedPath = join(scanDir, files[i])
                                const execPath = JavaGuard.javaExecFromRoot(combinedPath)

                                exists(execPath, (v) => {

                                    if(v){
                                        res.add(combinedPath)
                                    }

                                    ++pathsDone

                                    if(pathsDone === files.length){
                                        resolve(res)
                                    }

                                })
                            }
                            if(pathsDone === files.length){
                                resolve(res)
                            }
                        }
                    })
                } else {
                    resolve(res)
                }
            })

        })
    }

    /**
     * 
     * @param {Set.<string>} rootSet A set of JVM root strings to validate.
     * @returns {Promise.<Object[]>} A promise which resolves to an array of meta objects
     * for each valid JVM root directory.
     */
    private async _validateJavaRootSet(rootSet: Set<string>): Promise<JVMMeta[]>{

        const rootArr = Array.from(rootSet)
        const validArr: JVMMeta[] = []

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
    private static _sortValidJavaArray(validArr: any[]){
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
    private async _win32JavaValidate(dataDir: string){

        // Get possible paths from the registry.
        let pathSet1 = await JavaGuard._scanRegistry()
        if(pathSet1.size === 0){
            // Do a manual file system scan of program files.
            pathSet1 = await JavaGuard._scanFileSystem('C:\\Program Files\\Java')
        }

        // Get possible paths from the data directory.
        const pathSet2 = await JavaGuard._scanFileSystem(join(dataDir, 'runtime', 'x64'))

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
    async _darwinJavaValidate(dataDir: string){

        const pathSet1 = await JavaGuard._scanFileSystem('/Library/Java/JavaVirtualMachines')
        const pathSet2 = await JavaGuard._scanFileSystem(join(dataDir, 'runtime', 'x64'))

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
            if(jHome.includes('/Contents/Home')){
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
    async _linuxJavaValidate(dataDir: string){

        const pathSet1 = await JavaGuard._scanFileSystem('/usr/lib/jvm')
        const pathSet2 = await JavaGuard._scanFileSystem(join(dataDir, 'runtime', 'x64'))
        
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
    async validateJava(dataDir: string){
        return await (this as any)[`_${process.platform}JavaValidate`](dataDir)
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

    protected totaldlsize: number
    protected progress: number
    protected assets: DLTracker
    protected libraries: DLTracker
    protected files: DLTracker
    protected forge: DLTracker
    protected java: DLTracker
    protected extractQueue: any[]

    /**
     * Create an instance of AssetGuard.
     * On creation the object's properties are never-null default
     * values. Each identifier is resolved to an empty DLTracker.
     * 
     * @param {string} commonPath The common path for shared game files.
     * @param {string} javaexec The path to a java executable which will be used
     * to finalize installation.
     */
    constructor(
        public commonPath: string,
        public javaexec: string
    ) {
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
    private static _calculateHash(buf: Buffer, algo: string){
        return createHash(algo).update(buf).digest('hex')
    }

    /**
     * Used to parse a checksums file. This is specifically designed for
     * the checksums.sha1 files found inside the forge scala dependencies.
     * 
     * @param {string} content The string content of the checksums file.
     * @returns {Object} An object with keys being the file names, and values being the hashes.
     */
    private static _parseChecksumsFile(content: string) {
        let finalContent: {[fileName: string]: string} = {}
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
    private static _validateLocal(filePath: string, algo: string, hash: string){
        if(pathExistsSync(filePath)){
            //No hash provided, have to assume it's good.
            if(hash == null){
                return true
            }
            let buf = readFileSync(filePath)
            let calcdhash = AssetGuard._calculateHash(buf, algo)
            return calcdhash === hash
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
    private static _validateForgeChecksum(filePath: string, checksums: string[]){
        if(pathExistsSync(filePath)){
            if(checksums == null || checksums.length === 0){
                return true
            }
            let buf = readFileSync(filePath)
            let calcdhash = AssetGuard._calculateHash(buf, 'sha1')
            let valid = checksums.includes(calcdhash)
            if(!valid && filePath.endsWith('.jar')){
                valid = AssetGuard._validateForgeJar(buf, checksums)
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
    private static _validateForgeJar(buf: Buffer, checksums: string[]){
        // Double pass method was the quickest I found. I tried a version where we store data
        // to only require a single pass, plus some quick cleanup but that seemed to take slightly more time.

        const hashes: {[fileName: string]: string} = {}
        let expected: {[fileName: string]: string} = {}

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
    private static _extractPackXZ(filePaths: string[], javaExecutable: string){
        console.log('[PackXZExtract] Starting')
        return new Promise((resolve, reject) => {

            let libPath
            if(isDev){
                libPath = join(process.cwd(), 'libraries', 'java', 'PackXZExtract.jar')
            } else {
                if(process.platform === 'darwin'){
                    libPath = join(process.cwd(),'Contents', 'Resources', 'libraries', 'java', 'PackXZExtract.jar')
                } else {
                    libPath = join(process.cwd(), 'resources', 'libraries', 'java', 'PackXZExtract.jar')
                }
            }

            const filePath = filePaths.join(',')
            const child = spawn(javaExecutable, ['-jar', libPath, '-packxz', filePath])
            child.stdout.on('data', (data) => {
                console.log('[PackXZExtract]', data.toString('utf8').trim())
            })
            child.stderr.on('data', (data) => {
                console.log('[PackXZExtract]', data.toString('utf8').trim())
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
    // TODO type def
    private static _finalizeForgeAsset(asset: Asset, commonPath: string){
        return new Promise((resolve, reject) => {
            readFile(asset.to, (err, data) => {
                const zip = new AdmZip(data)
                const zipEntries = zip.getEntries()

                for(let i=0; i<zipEntries.length; i++){
                    if(zipEntries[i].entryName === 'version.json'){
                        const forgeVersion = JSON.parse(zip.readAsText(zipEntries[i]))
                        const versionPath = join(commonPath, 'versions', forgeVersion.id)
                        const versionFile = join(versionPath, forgeVersion.id + '.json')
                        if(!pathExistsSync(versionFile)){
                            ensureDirSync(versionPath)
                            writeFileSync(join(versionPath, forgeVersion.id + '.json'), zipEntries[i].getData())
                            resolve(forgeVersion)
                        } else {
                            //Read the saved file to allow for user modifications.
                            resolve(JSON.parse(readFileSync(versionFile, 'utf-8')))
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
     * @returns {Promise.<VersionJson>} Promise which resolves to the version data object.
     */
    public loadVersionData(version: string, force = false): Promise<VersionJson>{
        const self = this
        return new Promise(async (resolve, reject) => {
            const versionPath = join(self.commonPath, 'versions', version)
            const versionFile = join(versionPath, version + '.json')
            if(!pathExistsSync(versionFile) || force){
                const url = await self._getVersionDataUrl(version)
                if (url == null) {
                    console.error(`No version index found for ${version}.`)
                    reject()
                    return
                }
                //This download will never be tracked as it's essential and trivial.
                console.log('Preparing download of ' + version + ' assets.')
                ensureDirSync(versionPath)
                const stream = request(url).pipe(createWriteStream(versionFile))
                stream.on('finish', () => {
                    resolve(readJsonSync(versionFile) as VersionJson)
                })
            } else {
                resolve(readJsonSync(versionFile) as VersionJson)
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
    private _getVersionDataUrl(version: string): Promise<string | null> {
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
     * @param {VersionJson} versionData The version data for the assets.
     * @param {boolean} force Optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    public validateAssets(versionData: VersionJson, force = false): Promise<void> {
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
     * @param {VersionJson} versionData
     * @param {boolean} force
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    private _assetChainIndexData(versionData: VersionJson, force = false): Promise<void> {
        const self = this
        return new Promise((resolve, reject) => {
            //Asset index constants.
            const assetIndex = versionData.assetIndex
            const name = assetIndex.id + '.json'
            const indexPath = join(self.commonPath, 'assets', 'indexes')
            const assetIndexLoc = join(indexPath, name)

            let data = null
            if(!pathExistsSync(assetIndexLoc) || force){
                console.log('Downloading ' + versionData.id + ' asset index.')
                ensureDirSync(indexPath)
                const stream = request(assetIndex.url).pipe(createWriteStream(assetIndexLoc))
                stream.on('finish', () => {
                    data = JSON.parse(readFileSync(assetIndexLoc, 'utf-8'))
                    self._assetChainValidateAssets(versionData, data).then(() => {
                        resolve()
                    })
                })
            } else {
                data = JSON.parse(readFileSync(assetIndexLoc, 'utf-8'))
                self._assetChainValidateAssets(versionData, data).then(() => {
                    resolve()
                })
            }
        })
    }

    /**
     * Private function used to chain the asset validation process. This function processes
     * the assets and enqueues missing or invalid files.
     * @param {VersionJson} versionData
     * @param {boolean} force
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    private _assetChainValidateAssets(versionData: VersionJson, indexData: AssetIndex): Promise<void> {
        const self = this
        return new Promise((resolve, reject) => {

            //Asset constants
            const resourceURL = 'http://resources.download.minecraft.net/'
            const localPath = join(self.commonPath, 'assets')
            const objectPath = join(localPath, 'objects')

            const assetDlQueue: Asset[] = []
            let dlSize = 0
            let acc = 0
            const total = Object.keys(indexData.objects).length
            //const objKeys = Object.keys(data.objects)
            forEachOfLimit(indexData.objects, 10, (value, key, cb) => {
                acc++
                self.emit('progress', 'assets', acc, total)
                const hash = value.hash
                const assetName = join(hash.substring(0, 2), hash)
                const urlName = hash.substring(0, 2) + '/' + hash
                const ast = new Asset(key, hash, value.size, resourceURL + urlName, join(objectPath, assetName))
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
     * @param {VersionJson} versionData The version data for the assets.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    public validateLibraries(versionData: VersionJson){
        const self = this
        return new Promise((resolve, reject) => {

            const libArr = versionData.libraries
            const libPath = join(self.commonPath, 'libraries')

            const libDlQueue: LibraryInternal[] = []
            let dlSize = 0

            //Check validity of each library. If the hashs don't match, download the library.
            eachLimit(libArr, 5, (lib: Library, cb) => {
                if(LibraryInternal.validateRules(lib.rules, lib.natives)){
                    // @ts-ignore
                    let artifact = (lib.natives == null) ? lib.downloads.artifact : lib.downloads.classifiers[lib.natives[LibraryInternal.mojangFriendlyOS()].replace('${arch}', process.arch.replace('x', ''))]
                    const libItm = new LibraryInternal(lib.name, artifact.sha1, artifact.size, artifact.url, join(libPath, artifact.path))
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
     * @param {VersionJson} versionData The version data for the assets.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    public validateMiscellaneous(versionData: VersionJson){
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
     * @param {VersionJson} versionData The version data for the assets.
     * @param {boolean} force Optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    public validateClient(versionData: VersionJson, force = false){
        const self = this
        return new Promise((resolve, reject) => {
            const clientData = versionData.downloads.client
            const version = versionData.id
            const targetPath = join(self.commonPath, 'versions', version)
            const targetFile = version + '.jar'

            let client = new Asset(version + ' client', clientData.sha1, clientData.size, clientData.url, join(targetPath, targetFile))

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
     * @param {VersionJson} versionData The version data for the assets.
     * @param {boolean} force Optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    public validateLogConfig(versionData: VersionJson){
        const self = this
        return new Promise((resolve, reject) => {
            const client = versionData.logging.client
            const file = client.file
            const targetPath = join(self.commonPath, 'assets', 'log_configs')

            let logConfig = new Asset(file.id, file.sha1, file.size, file.url, join(targetPath, file.id))

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
    public validateDistribution(server: any){
        const self = this
        return new Promise((resolve, reject) => {
            self.forge = self._parseDistroModules(server.getModules(), server.getMinecraftVersion(), server.getID())
            resolve(server)
        })
    }

    private _parseDistroModules(modules: any[], version: string, servid: string){
        let alist: any[] = []
        let asize = 0
        for(let ob of modules){
            let obArtifact = ob.getArtifact()
            let obPath = obArtifact.getPath()
            let artifact = new DistroModule(ob.getIdentifier(), obArtifact.getHash(), obArtifact.getSize(), obArtifact.getURL(), obPath, ob.getType())
            const validationPath = obPath.toLowerCase().endsWith('.pack.xz') ? obPath.substring(0, obPath.toLowerCase().lastIndexOf('.pack.xz')) : obPath
            if(!AssetGuard._validateLocal(validationPath, 'MD5', artifact.hash)){
                asize += artifact.size*1
                alist.push(artifact)
                // @ts-ignore
                // TODO revisit
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
     * @param {any} server The Server to load Forge data for.
     * @returns {Promise.<Object>} A promise which resolves to Forge's version.json data.
     */
    public loadForgeData(server: any){
        const self = this
        return new Promise(async (resolve, reject) => {
            const modules = server.getModules()
            for(let ob of modules){
                const type = ob.getType()
                if(type === DistroManager.Types.ForgeHosted || type === DistroManager.Types.Forge){
                    if(Util.mcVersionAtLeast('1.13', server.getMinecraftVersion())){
                        // Read Manifest
                        for(let sub of ob.getSubModules()){
                            if(sub.getType() === DistroManager.Types.VersionManifest){
                                resolve(JSON.parse(readFileSync(sub.getArtifact().getPath(), 'utf-8')))
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

    private _parseForgeLibraries(){
        /* TODO
        * Forge asset validations are already implemented. When there's nothing much
        * to work on, implement forge downloads using forge's version.json. This is to
        * have the code on standby if we ever need it (since it's half implemented already).
        */
    }

    // #endregion

    // Java (Category=''') Validation (download) Functions
    // #region

    private _enqueueOpenJDK(dataDir: string){
        return new Promise((resolve, reject) => {
            JavaGuard.latestOpenJDK('8').then(verData => {
                if(verData != null){

                    dataDir = join(dataDir, 'runtime', 'x64')
                    const fDir = join(dataDir, verData.name)
                    // @ts-ignore
                    // TODO revisit
                    const jre = new Asset(verData.name, null, verData.size, verData.uri, fDir)
                    this.java = new DLTracker([jre], jre.size, (a: Asset, self: this) => {
                        if(verData.name.endsWith('zip')){

                            const zip = new AdmZip(a.to)
                            const pos = join(dataDir, zip.getEntries()[0].entryName)
                            zip.extractAllToAsync(dataDir, true, (err) => {
                                if(err){
                                    console.log(err)
                                    self.emit('complete', 'java', JavaGuard.javaExecFromRoot(pos))
                                } else {
                                    unlink(a.to, err => {
                                        if(err){
                                            console.log(err)
                                        }
                                        self.emit('complete', 'java', JavaGuard.javaExecFromRoot(pos))
                                    })
                                }
                            })

                        } else {
                            // Tar.gz
                            let h: string
                            createReadStream(a.to)
                                .on('error', err => console.log(err))
                                .pipe(createGunzip())
                                .on('error', err => console.log(err))
                                .pipe(extract(dataDir, {
                                    map: (header) => {
                                        if(h == null){
                                            h = header.name
                                        }
                                        return header
                                    }
                                }))
                                .on('error', err => console.log(err))
                                .on('finish', () => {
                                    unlink(a.to, err => {
                                        if(err){
                                            console.log(err)
                                        }
                                        if(h.indexOf('/') > -1){
                                            h = h.substring(0, h.indexOf('/'))
                                        }
                                        const pos = join(dataDir, h)
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

    // _enqueueOracleJRE(dataDir){
    //     return new Promise((resolve, reject) => {
    //         JavaGuard._latestJREOracle().then(verData => {
    //             if(verData != null){

    //                 const combined = verData.uri + PLATFORM_MAP[process.platform]
        
    //                 const opts = {
    //                     url: combined,
    //                     headers: {
    //                         'Cookie': 'oraclelicense=accept-securebackup-cookie'
    //                     }
    //                 }
        
    //                 request.head(opts, (err, resp, body) => {
    //                     if(err){
    //                         resolve(false)
    //                     } else {
    //                         dataDir = path.join(dataDir, 'runtime', 'x64')
    //                         const name = combined.substring(combined.lastIndexOf('/')+1)
    //                         const fDir = path.join(dataDir, name)
    //                         const jre = new Asset(name, null, parseInt(resp.headers['content-length']), opts, fDir)
    //                         this.java = new DLTracker([jre], jre.size, (a, self) => {
    //                             let h = null
    //                             fs.createReadStream(a.to)
    //                                 .on('error', err => console.log(err))
    //                                 .pipe(zlib.createGunzip())
    //                                 .on('error', err => console.log(err))
    //                                 .pipe(tar.extract(dataDir, {
    //                                     map: (header) => {
    //                                         if(h == null){
    //                                             h = header.name
    //                                         }
    //                                     }
    //                                 }))
    //                                 .on('error', err => console.log(err))
    //                                 .on('finish', () => {
    //                                     fs.unlink(a.to, err => {
    //                                         if(err){
    //                                             console.log(err)
    //                                         }
    //                                         if(h.indexOf('/') > -1){
    //                                             h = h.substring(0, h.indexOf('/'))
    //                                         }
    //                                         const pos = path.join(dataDir, h)
    //                                         self.emit('complete', 'java', JavaGuard.javaExecFromRoot(pos))
    //                                     })
    //                                 })
                                
    //                         })
    //                         resolve(true)
    //                     }
    //                 })

    //             } else {
    //                 resolve(false)
    //             }
    //         })
    //     })

    // }

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
    public startAsyncProcess(identifier: string, limit = 5){

        const self = this
        const dlTracker = (this as any)[identifier]
        const dlQueue = dlTracker.dlqueue

        if(dlQueue.length > 0){
            console.log('DLQueue', dlQueue)

            eachLimit(dlQueue, limit, (asset: Asset, cb) => {

                ensureDirSync(join(asset.to, '..'))

                let req = request(asset.from)
                req.pause()

                req.on('response', (resp) => {

                    if(resp.statusCode === 200){

                        let doHashCheck = false
                        const contentLength = parseInt(resp.headers['content-length'] as string)

                        if(contentLength !== asset.size){
                            console.log(`WARN: Got ${contentLength} bytes for ${asset.id}: Expected ${asset.size}`)
                            doHashCheck = true

                            // Adjust download
                            this.totaldlsize -= asset.size
                            this.totaldlsize += contentLength
                        }

                        let writeStream = createWriteStream(asset.to)
                        writeStream.on('close', () => {
                            if(dlTracker.callback != null){
                                dlTracker.callback.apply(dlTracker, [asset, self])
                            }

                            if(doHashCheck){
                                // @ts-ignore
                                // TODO revisit
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
                        // @ts-ignore
                        // TODO revisit
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
                (self as any)[identifier] = new DLTracker([], 0)

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
    public processDlQueues(identifiers = [{id:'assets', limit:20}, {id:'libraries', limit:5}, {id:'files', limit:5}, {id:'forge', limit:5}]){
        return new Promise((resolve, reject) => {
            let shouldFire = true

            // Assign dltracking variables.
            this.totaldlsize = 0
            this.progress = 0

            for(let iden of identifiers){
                this.totaldlsize += (this as any)[iden.id].dlsize
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

    public async validateEverything(serverid: string, dev = false){

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
