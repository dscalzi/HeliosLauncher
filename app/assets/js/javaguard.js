const cp = require('child_process')
const EventEmitter = require('events')
const fs = require('fs')
const path = require('path')
const Registry = require('winreg')
const request = require('request')

const PLATFORM_MAP = {
    win32: '-windows-x64.tar.gz',
    darwin: '-macosx-x64.tar.gz',
    linux: '-linux-x64.tar.gz'
}

class JavaGuard extends EventEmitter {

    /**
     * Validates that a Java binary is at least 64 bit. This makes use of the non-standard
     * command line option -XshowSettings:properties. The output of this contains a property,
     * sun.arch.data.model = ARCH, in which ARCH is either 32 or 64. This option is supported
     * in Java 8 and 9. Since this is a non-standard option. This will resolve to true if
     * the function's code throws errors. That would indicate that the option is changed or
     * removed.
     * 
     * @param {string} binaryPath Path to the root of the java binary we wish to validate.
     * 
     * @returns {Promise.<boolean>} Resolves to false only if the test is successful and the result
     * is less than 64.
     */
    static _validateBinary(binaryPath){

        return new Promise((resolve, reject) => {
            const fBp = path.join(binaryPath, 'bin', 'java.exe')
            if(fs.existsSync(fBp)){
                cp.exec('"' + fBp + '" -XshowSettings:properties', (err, stdout, stderr) => {

                    try {
                        // Output is stored in stderr?
                        const res = stderr
                        const props = res.split('\n')
                        for(let i=0; i<props.length; i++){
                            if(props[i].indexOf('sun.arch.data.model') > -1){
                                let arch = props[i].split('=')[1].trim()
                                console.log(props[i].trim() + ' for ' + binaryPath)
                                resolve(parseInt(arch) >= 64)
                            }
                        }

                        // sun.arch.data.model not found?
                        // Disregard this test.
                        resolve(true)

                    } catch (err){

                        // Output format might have changed, validation cannot be completed.
                        // Disregard this test in that case.
                        resolve(true)
                    }
                })
            } else {
                resolve(false)
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
     * @returns {string} The root path of a valid x64 Java installation. If none are
     * found, null is returned.
     */
    static async _win32Validate(){

        // Get possible paths from the registry.
        const pathSet = await JavaGuard._scanRegistry()

        console.log(Array.from(pathSet)) // DEBUGGING

        // Validate JAVA_HOME
        const jHome = JavaGuard._scanJavaHome()
        if(jHome != null && jHome.indexOf('(x86)') === -1){
            pathSet.add(jHome)
        }

        // Convert path set to an array for processing.
        let pathArr = Array.from(pathSet)

        console.log(pathArr) // DEBUGGING

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

        console.log(pathArr) // DEBUGGING

        // Validate that the binary is actually x64.
        for(let i=0; i<pathArr.length; i++) {
            let res = await JavaGuard._validateBinary(pathArr[i])
            if(res){
                return pathArr[i]
            }
        }

        // No suitable candidates found.
        return null;

    }

    /**
     * WIP ->  get a valid x64 Java path on macOS.
     */
    static async _darwinValidate(){
        return null
    }

    /**
     * WIP ->  get a valid x64 Java path on linux.
     */
    static async _linuxValidate(){
        return null
    }

    static async validate(){
        return await JavaGuard['_' + process.platform + 'Validate']()
    }

    // WIP -> Downloading Suite

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

    async _downloadOracleJRE(acceptLicense, dir){

        if(!acceptLicense){
            return
        }
    
        // TODO -> Complete this code. See format used in assetguard.js#510
    
        const latestData = await JavaGuard._latestJREOracle()
    
        const combined = latestData.uri + PLATFORM_MAP[process.platform]
        const name = combined.substring(combined.lastIndexOf('/')+1)
        const fDir = path.join(dir, name)
    
        const opts = {
            url: combined,
            headers: {
                'Cookie': 'oraclelicense=accept-securebackup-cookie'
            }
        }
    
        const req = request(opts)
        let writeStream = fs.createWriteStream(fDir)
        req.pipe(writeStream)
        req.resume()
    
    }

    _downloadJava(dir){
        this._downloadOracleJRE(true, dir)
    }

}

async function test(){
    //console.log(await JavaGuard.validate())
    const g = new JavaGuard()
    g._downloadJava('C:\\Users\\Asus\\Desktop\\LauncherElectron\\target\\')
    //console.log(JSON.stringify(await _latestJREOracle()))
}

test()

module.exports = {
    JavaGuard
}