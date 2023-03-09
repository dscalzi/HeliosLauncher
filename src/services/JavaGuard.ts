import * as EventEmitter from "events";
import { LoggerUtil } from 'helios-core/.';
import { DevUtil } from '../util/DevUtil';
import { join } from 'path';
import { existsSync, pathExists, readdir } from 'fs-extra';
import Registry from "winreg";
import { MinecraftUtil } from '../util/MinecraftUtil';
import { exec } from "child_process";
import nodeDiskInfo from "node-disk-info";
import fetch from "node-fetch";
import { AdoptiumBinary, JavaMetaObject, JavaRuntimeVersion } from '../util/JavaType';


const logger = LoggerUtil.getLogger("JavaGuard");
export class JavaGuard extends EventEmitter {


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
    public static latestOpenJDK(major = '8') {
        return process.platform === 'darwin' ?
            this.latestCorretto(major) : this.latestAdoptium(major);
    }

    private static async latestAdoptium(major: string) {
        const majorNum = Number(major)
        const sanitizedOS = process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'mac' : process.platform)
        const url = `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?vendor=eclipse`

        const response = await fetch(url).catch(_e => { logger.error(_e); return null });
        if (!response) return null;
        const json = await response.json() as AdoptiumBinary[]

        const targetBinary = json.find(entry => {
            return entry.version.major === majorNum
                && entry.binary.os === sanitizedOS
                && entry.binary.image_type === 'jdk'
                && entry.binary.architecture === 'x64'
        });

        return targetBinary ?
            {
                uri: targetBinary.binary.package.link,
                size: targetBinary.binary.package.size,
                name: targetBinary.binary.package.name
            }
            : null
    }

    private static async latestCorretto(major: string) {
        let sanitizedOS: string, ext: string;
        switch (process.platform) {
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

        const arch = DevUtil.isARM64 ? 'aarch64' : 'x64'
        const url = `https://corretto.aws/downloads/latest/amazon-corretto-${major}-${arch}-${sanitizedOS}-jdk.${ext}`

        const response = await fetch(url).catch(e => { logger.error(e); return null; });
        if (!response) return null;

        return {
            uri: url,
            size: Number(response.headers.get("content-length")),
            name: url.substring(url.lastIndexOf('/') + 1)
        }
    }

    /**
     * Returns the path of the OS-specific executable for the given Java
     * installation. Supported OS's are win32, darwin, linux.
     * 
     * @param {string} rootDir The root directory of the Java installation.
     * @returns {string} The path to the Java executable.
     */
    public static javaExecFromRoot(rootDir) {
        if (process.platform === 'win32') {
            return join(rootDir, 'bin', 'javaw.exe')
        } else if (process.platform === 'darwin') {
            return join(rootDir, 'Contents', 'Home', 'bin', 'java')
        } else if (process.platform === 'linux') {
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
    public static isJavaExecPath(pth: string) {
        if (pth == null) {
            return false
        }
        if (process.platform === 'win32') {
            return pth.endsWith(join('bin', 'javaw.exe'))
        } else if (process.platform === 'darwin') {
            return pth.endsWith(join('bin', 'java'))
        } else if (process.platform === 'linux') {
            return pth.endsWith(join('bin', 'java'))
        }
        return false
    }


    /**
     * Load Mojang's launcher.json file.
     * 
     * //TODO: Import the launcher.json to have autocompletion
     * 
     * @returns {Promise.<Object>} Promise which resolves to Mojang's launcher.json object.
     */
    public static async loadMojangLauncherData() {
        const response = await fetch('https://launchermeta.mojang.com/mc/launcher.json').catch(e => { logger.error(e); return null });
        if (!response) return null;

        return response.json();
    }

    /**
     * Parses a **full** Java Runtime version string and resolves
     * the version information. Dynamically detects the formatting
     * to use.
     * 
     * @param {string} versionString Full version string to parse.
     * @returns Object containing the version information.
     */
    static parseJavaRuntimeVersion(versionString: string): JavaRuntimeVersion {
        const major = versionString.split('.')[0]
        return major == "1" ?
            JavaGuard.parseJavaRuntimeVersion_8(versionString)
            : JavaGuard.parseJavaRuntimeVersion_9(versionString)
    }

    /**
     * Parses a **full** Java Runtime version string and resolves
     * the version information. Uses Java 8 formatting.
     * 
     * @param {string} versionString Full version string to parse.
     * @returns Object containing the version information.
     */
    public static parseJavaRuntimeVersion_8(versionString: string) {
        // 1.{major}.0_{update}-b{build}
        // ex. 1.8.0_152-b16
        let pts = versionString.split('-')
        const build = parseInt(pts[1].substring(1))

        pts = pts[0].split('_')

        const update = parseInt(pts[1])
        const major = parseInt(pts[0].split('.')[1])

        return {
            build,
            update,
            major,
            minor: undefined,
            revision: undefined
        }
    }

    /**
     * Parses a **full** Java Runtime version string and resolves
     * the version information. Uses Java 9+ formatting.
     * 
     * @param {string} verString Full version string to parse.
     * @returns Object containing the version information.
     */
    public static parseJavaRuntimeVersion_9(verString: string) {
        // {major}.{minor}.{revision}+{build}
        // ex. 10.0.2+13
        let pts = verString.split('+')
        const build = parseInt(pts[1])

        pts = pts[0].split('.')

        const major = parseInt(pts[0])
        const minor = parseInt(pts[1])
        const revision = parseInt(pts[2])
        return {
            build,
            major,
            minor,
            revision
        }
    }


    /**
     * Checks for the presence of the environment variable JAVA_HOME. If it exits, we will check
     * to see if the value points to a path which exists. If the path exits, the path is returned.
     * 
     * @returns {string} The path defined by JAVA_HOME, if it exists. Otherwise null.
     */
    private static scanJavaHome() {
        const jHome = process.env.JAVA_HOME
        if (!jHome) return null;
        try {
            let res = existsSync(jHome)
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
    private static scanRegistry(): Promise<Set<string>> {
        return new Promise((resolve, _reject) => {
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

            for (let i = 0; i < regKeys.length; i++) {
                const key = new Registry({
                    hive: Registry.HKLM,
                    key: regKeys[i],
                    arch: 'x64'
                })
                key.keyExists((err, exists) => {
                    if (exists) {
                        key.keys((err, javaVers) => {
                            if (err) {
                                keysDone++
                                console.error(err)

                                // REG KEY DONE
                                // DUE TO ERROR
                                if (keysDone === regKeys.length) {
                                    resolve(candidates)
                                }
                            } else {
                                if (javaVers.length === 0) {
                                    // REG KEY DONE
                                    // NO SUBKEYS
                                    keysDone++
                                    if (keysDone === regKeys.length) {
                                        resolve(candidates)
                                    }
                                } else {

                                    let numDone = 0

                                    for (let j = 0; j < javaVers.length; j++) {
                                        const javaVer = javaVers[j]
                                        const vKey = javaVer.key.substring(javaVer.key.lastIndexOf('\\') + 1)
                                        // Only Java 8 is supported currently.
                                        if (parseFloat(vKey) === 1.8) {
                                            javaVer.get('JavaHome', (err, res) => {
                                                const jHome = res.value
                                                if (jHome.indexOf('(x86)') === -1) {
                                                    candidates.add(jHome)
                                                }

                                                // SUBKEY DONE

                                                numDone++
                                                if (numDone === javaVers.length) {
                                                    keysDone++
                                                    if (keysDone === regKeys.length) {
                                                        resolve(candidates)
                                                    }
                                                }
                                            })
                                        } else {

                                            // SUBKEY DONE
                                            // NOT JAVA 8

                                            numDone++
                                            if (numDone === javaVers.length) {
                                                keysDone++
                                                if (keysDone === regKeys.length) {
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
                        if (keysDone === regKeys.length) {
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
    private static scanInternetPlugins() {
        // /Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java
        const pth = '/Library/Internet Plug-Ins/JavaAppletPlugin.plugin'
        const res = existsSync(JavaGuard.javaExecFromRoot(pth))
        return res ? pth : null
    }

    /**
     * Scan a directory for root JVM folders.
     * 
     * @param {string} scanDir The directory to scan.
     * @returns {Promise.<Set.<string>>} A promise which resolves to a set of the discovered
     * root JVM folders.
     */
    private static async scanFileSystem(scanDir) {
        let res = new Set<string>()
        if (await pathExists(scanDir)) {

            const files = await readdir(scanDir)
            for (let i = 0; i < files.length; i++) {

                const combinedPath = join(scanDir, files[i])
                const execPath = JavaGuard.javaExecFromRoot(combinedPath)

                if (await pathExists(execPath)) {
                    res.add(combinedPath)
                }
            }
        }

        return res
    }

    /**
     * Sort an array of JVM meta objects. Best candidates are placed before all others.
     * Sorts based on version and gives priority to JREs over JDKs if versions match.
     * 
     * @param {Object[]} validArr An array of JVM meta objects.
     * @returns {Object[]} A sorted array of JVM meta objects.
     */
    private static sortValidJavaArray(validArr: JavaMetaObject[]) {
        const retArr = validArr.sort((a, b) => {

            if (a.version.major === b.version.major) {

                if (a.version.major < 9) {
                    // Java 8
                    if (a.version.update === b.version.update) {
                        if (a.version.build === b.version.build) {

                            // Same version, give priority to JRE.
                            if (a.execPath!.toLowerCase().indexOf('jdk') > -1) {
                                return b.execPath!.toLowerCase().indexOf('jdk') > -1 ? 0 : 1
                            } else {
                                return -1
                            }

                        } else {
                            return a.version.build > b.version.build ? -1 : 1
                        }
                    } else {
                        return a.version.update! > b.version.update! ? -1 : 1
                    }
                } else {
                    // Java 9+
                    if (a.version.minor === b.version.minor) {
                        if (a.version.revision === b.version.revision) {

                            // Same version, give priority to JRE.
                            if (a.execPath!.toLowerCase().indexOf('jdk') > -1) {
                                return b.execPath!.toLowerCase().indexOf('jdk') > -1 ? 0 : 1
                            } else {
                                return -1
                            }

                        } else {
                            return a.version.revision! > b.version.revision! ? -1 : 1
                        }
                    } else {
                        return a.version.minor! > b.version.minor! ? -1 : 1
                    }
                }

            } else {
                return a.version.major > b.version.major ? -1 : 1
            }
        })

        return retArr
    }

    constructor(public mcVersion: string) {
        super();

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
    private validateJVMProperties(stderr: string) {
        const res = stderr
        const props = res.split('\n')

        const goal = 2
        let checksum = 0

        const meta: any = {}

        for (let i = 0; i < props.length; i++) {
            if (props[i].indexOf('sun.arch.data.model') > -1) {
                const arch = props[i].split('=')[1].trim()
                const parsedArch = parseInt(arch)
                logger.debug(props[i].trim())

                if (parsedArch === 64) {
                    meta.arch = parsedArch
                    ++checksum
                    if (checksum === goal) break;
                }

            } else if (props[i].indexOf('java.runtime.version') > -1) {
                let verString = props[i].split('=')[1].trim()
                logger.debug(props[i].trim())
                const objectVersion = JavaGuard.parseJavaRuntimeVersion(verString)
                // TODO implement a support matrix eventually. Right now this is good enough
                // 1.7-1.16 = Java 8
                // 1.17+ = Java 17
                // Actual support may vary, but we're going with this rule for simplicity.
                if (objectVersion.major < 9 && !MinecraftUtil.mcVersionAtLeast('1.17', this.mcVersion)) {
                    // Java 8
                    if (objectVersion.major === 8 && objectVersion.update! > 52) {
                        meta.version = objectVersion
                        ++checksum
                        if (checksum === goal) break;
                    }
                } else if (objectVersion.major >= 17 && MinecraftUtil.mcVersionAtLeast('1.17', this.mcVersion)) {
                    // Java 9+
                    meta.version = objectVersion
                    ++checksum
                    if (checksum === goal) break;
                }
                // Space included so we get only the vendor.
            } else if (props[i].lastIndexOf('java.vendor ') > -1) {
                let vendorName = props[i].split('=')[1].trim()
                logger.debug(props[i].trim())
                meta.vendor = vendorName
            } else if (props[i].indexOf('os.arch') > -1) {
                meta.isARM = props[i].split('=')[1].trim() === 'aarch64'
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
    private validateJavaBinary(binaryExecPath): Promise<JavaMetaObject | null> {
        return new Promise((resolve, _reject) => {
            if (!JavaGuard.isJavaExecPath(binaryExecPath)) {
                resolve(null)
            } else if (existsSync(binaryExecPath)) {
                // Workaround (javaw.exe no longer outputs this information.)
                logger.debug(typeof binaryExecPath)
                if (binaryExecPath.indexOf('javaw.exe') > -1) {
                    binaryExecPath.replace('javaw.exe', 'java.exe')
                }
                exec('"' + binaryExecPath + '" -XshowSettings:properties', (_err, _stdout, stderr) => {
                    try {
                        // Output is stored in stderr?
                        resolve(this.validateJVMProperties(stderr) as JavaMetaObject)
                    } catch (err) {
                        // Output format might have changed, validation cannot be completed.
                        resolve(null)
                    }
                })
            } else {
                resolve(null)
            }
        })

    }

    /**
     * 
     * @param {Set.<string>} rootSet A set of JVM root strings to validate.
     * @returns {Promise.<Object[]>} A promise which resolves to an array of meta objects
     * for each valid JVM root directory.
     */
    private async validateJavaRootSet(rootSet: Set<string>) {

        const rootArr = Array.from(rootSet)
        const validArr: JavaMetaObject[] = []

        for (let i = 0; i < rootArr.length; i++) {

            const execPath = JavaGuard.javaExecFromRoot(rootArr[i])

            let metaObj: JavaMetaObject | null = await this.validateJavaBinary(execPath);
            if (!metaObj) continue;

            metaObj.execPath = execPath
            validArr.push(metaObj)
        }

        return validArr

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
    private async win32JavaValidate(dataDir: string): Promise<string | null> {

        // Get possible paths from the registry.
        let pathSet1 = await JavaGuard.scanRegistry()
        if (pathSet1.size === 0) {

            // Do a manual file system scan of program files.
            // Check all drives
            const driveMounts = nodeDiskInfo.getDiskInfoSync().map(({ mounted }) => mounted)
            for (const mount of driveMounts) {
                pathSet1 = new Set<string>([
                    ...pathSet1,
                    ...(await JavaGuard.scanFileSystem(`${mount}\\Program Files\\Java`)),
                    ...(await JavaGuard.scanFileSystem(`${mount}\\Program Files\\Eclipse Adoptium`)),
                    ...(await JavaGuard.scanFileSystem(`${mount}\\Program Files\\Eclipse Foundation`)),
                    ...(await JavaGuard.scanFileSystem(`${mount}\\Program Files\\AdoptOpenJDK`))
                ])
            }

        }

        // Get possible paths from the data directory.
        const pathSet2 = await JavaGuard.scanFileSystem(join(dataDir, 'runtime', 'x64'))

        // Merge the results.
        const uberSet = new Set([...pathSet1, ...pathSet2])

        // Validate JAVA_HOME.
        const jHome = JavaGuard.scanJavaHome()
        if (jHome != null && jHome.indexOf('(x86)') === -1) {
            uberSet.add(jHome)
        }

        let pathArr = await this.validateJavaRootSet(uberSet)
        pathArr = JavaGuard.sortValidJavaArray(pathArr)

        return pathArr.length > 0 ? pathArr[0].execPath! : null;
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
     * 
     * Added: On the system with ARM architecture attempts to find aarch64 Java.
     * 
     */
    private async darwinJavaValidate(dataDir: string): Promise<string | null> {

        const pathSet1 = await JavaGuard.scanFileSystem('/Library/Java/JavaVirtualMachines')
        const pathSet2 = await JavaGuard.scanFileSystem(join(dataDir, 'runtime', 'x64'))

        const uberSet = new Set([...pathSet1, ...pathSet2])

        // Check Internet Plugins folder.
        const iPPath = JavaGuard.scanInternetPlugins()
        if (iPPath != null) {
            uberSet.add(iPPath)
        }

        // Check the JAVA_HOME environment variable.
        let jHome = JavaGuard.scanJavaHome()
        if (jHome != null) {
            // Ensure we are at the absolute root.
            if (jHome.includes('/Contents/Home')) {
                jHome = jHome.substring(0, jHome.indexOf('/Contents/Home'))
            }
            uberSet.add(jHome)
        }

        let pathArr = await this.validateJavaRootSet(uberSet)
        pathArr = JavaGuard.sortValidJavaArray(pathArr)

        if (pathArr.length > 0) {

            // TODO Revise this a bit, seems to work for now. Discovery logic should
            // probably just filter out the invalid architectures before it even
            // gets to this point.
            if (DevUtil.isARM64) {
                return pathArr.find(({ isARM }) => isARM)?.execPath ?? null
            } else {
                return pathArr.find(({ isARM }) => !isARM)?.execPath ?? null
            }

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
    async linuxJavaValidate(dataDir: string): Promise<string | null> {

        const pathSet1 = await JavaGuard.scanFileSystem('/usr/lib/jvm')
        const pathSet2 = await JavaGuard.scanFileSystem(join(dataDir, 'runtime', 'x64'))

        const uberSet = new Set([...pathSet1, ...pathSet2])

        // Validate JAVA_HOME
        const jHome = JavaGuard.scanJavaHome()
        if (jHome != null) {
            uberSet.add(jHome)
        }

        let pathArr = await this.validateJavaRootSet(uberSet)
        pathArr = JavaGuard.sortValidJavaArray(pathArr)

        return pathArr.length > 0 ? pathArr[0].execPath! : null;
    }

    /**
     * Retrieve the path of a valid x64 Java installation.
     * 
     * @param {string} dataDir The base launcher directory.
     * @returns {string} A path to a valid x64 Java installation, null if none found.
     */
    public async validateJava(dataDir) {
        return this[process.platform + 'JavaValidate'](dataDir)
    }


}