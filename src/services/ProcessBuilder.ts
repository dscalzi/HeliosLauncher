import { ensureDirSync, remove, writeFile, writeFileSync } from "fs-extra";
import { join, basename } from "path";
import { pseudoRandomBytes } from "crypto";
import os from "os";
import { existsSync } from "fs-extra";
import AdmZip from "adm-zip";
import { spawn } from "child_process";
import { LoggerUtil } from "helios-core/.";
import { ConfigManager } from "../manager/ConfigManager";
import { MinecraftUtil } from "../util/MinecraftUtil";
import { DistroTypes } from "../manager/DistroManager";
import { Library } from "../models/Library";
import { Module } from "../models/Module";
import { Required } from "../models/Required";
import { ArgumentRule, MinecraftGameVersionManifest } from '../dto/Minecraft';
import { Server } from '../models/Server';

const logger = LoggerUtil.getLogger('ProcessBuilder')
export default class ProcessBuilder {

    /**
     * Get the platform specific classpath separator. On windows, this is a semicolon.
     * On Unix, this is a colon.
     * 
     * @returns {string} The classpath separator for the current operating system.
     */
    public static get classpathSeparator() {
        return process.platform === 'win32' ? ';' : ':'
    }

    public static isModEnabled(modCfg, required?: Required) {
        return modCfg != null ? ((typeof modCfg === 'boolean' && modCfg) || (typeof modCfg === 'object' && (typeof modCfg.value !== 'undefined' ? modCfg.value : true))) : required != null ? required.isDefault() : true
    }


    public gameDir: string;
    public commonDir: string;
    public forgeModListFile: string;
    public fmlDir: string;
    public llDir: string;
    public libPath: string;

    public usingLiteLoader = false;
    public llPath?: string;

    constructor(
        public server: Server,
        public versionData: MinecraftGameVersionManifest,
        public forgeData,
        public authUser,
        public launcherVersion
    ) {

        this.gameDir = join(ConfigManager.instanceDirectory, server.id)
        this.commonDir = ConfigManager.commonDirectory
        this.versionData = versionData
        this.forgeData = forgeData
        this.authUser = authUser
        this.launcherVersion = launcherVersion
        this.forgeModListFile = join(this.gameDir, 'forgeMods.list') // 1.13+
        this.fmlDir = join(this.gameDir, 'forgeModList.json')
        this.llDir = join(this.gameDir, 'liteloaderModList.json')
        this.libPath = join(this.commonDir, 'libraries')

    }


    /**
     * Convienence method to run the functions typically used to build a process.
     */
    public build() {
        ensureDirSync(this.gameDir)
        const tempNativePath = join(os.tmpdir(), ConfigManager.tempNativeFolder, pseudoRandomBytes(16).toString('hex'))
        process.throwDeprecation = true
        this.setupLiteLoader()
        logger.info('Using liteloader:', this.usingLiteLoader)
        const modObj = this.resolveModConfiguration(ConfigManager.getModConfigurationForServer(this.server.id).mods, this.server.modules)

        // Mod list below 1.13
        if (!MinecraftUtil.mcVersionAtLeast('1.13', this.server.minecraftVersion)) {
            this.constructJSONModList('forge', modObj.forgeMods, true)
            if (this.usingLiteLoader) {
                this.constructJSONModList('liteloader', modObj.liteMods, true)
            }
        }

        const everyMods = modObj.forgeMods.concat(modObj.liteMods)
        let args = this.constructJVMArguments(everyMods, tempNativePath)

        if (MinecraftUtil.mcVersionAtLeast('1.13', this.server.minecraftVersion)) {
            //args = args.concat(this.constructModArguments(modObj.forgeMods))
            args = args.concat(this.constructModList(modObj.forgeMods))
        }

        logger.info('Launch Arguments:', args)

        const child = spawn(ConfigManager.getJavaExecutable(this.server.id), args, {
            cwd: this.gameDir,
            detached: ConfigManager.getLaunchDetached()
        })

        if (ConfigManager.getLaunchDetached()) {
            child.unref()
        }

        child.stdout.setEncoding('utf8')
        child.stderr.setEncoding('utf8')

        child.stdout.on('data', (data) => {
            data.trim().split('\n').forEach(x => console.log(`\x1b[32m[Minecraft]\x1b[0m ${x}`))

        })
        child.stderr.on('data', (data) => {
            data.trim().split('\n').forEach(x => console.log(`\x1b[31m[Minecraft]\x1b[0m ${x}`))
        })
        child.on('close', (code, signal) => {
            logger.info('Exited with code', code)
            remove(tempNativePath, (err) => {
                if (err) {
                    logger.warn('Error while deleting temp dir', err)
                } else {
                    logger.info('Temp dir deleted successfully.')
                }
            })
        })

        return child
    }

    /**
     * Function which performs a preliminary scan of the top level
     * mods. If liteloader is present here, we setup the special liteloader
     * launch options. Note that liteloader is only allowed as a top level
     * mod. It must not be declared as a submodule.
     */
    public setupLiteLoader() {
        for (let module of this.server.modules) {
            if (module.type === DistroTypes.LiteLoader) {
                if (!module.required.isRequired) {
                    const modCfg = ConfigManager.getModConfigurationForServer(this.server.id).mods
                    if (ProcessBuilder.isModEnabled(modCfg[module.versionlessID], module.required)) {
                        if (existsSync(module.artifact.getPath())) {
                            this.usingLiteLoader = true
                            this.llPath = module.artifact.getPath()
                        }
                    }
                } else {
                    if (existsSync(module.artifact.getPath())) {
                        this.usingLiteLoader = true
                        this.llPath = module.artifact.getPath()
                    }
                }
            }
        }
    }

    /**
     * Resolve an array of all enabled mods. These mods will be constructed into
     * a mod list format and enabled at launch.
     * 
     * @param {Object} modConfig The mod configuration object.
     * @param {Array.<Object>} modules An array of modules to parse.
     * @returns {{forgeMods: Array.<Object>, liteMods: Array.<Object>}} An object which contains
     * a list of enabled forge mods and litemods.
     */
    public resolveModConfiguration(modConfig, modules: Module[]) {
        let forgeMods: Module[] = []
        let liteMods: Module[] = []

        for (let module of modules) {
            const type = module.type;
            if (type === DistroTypes.ForgeMod || type === DistroTypes.LiteMod || type === DistroTypes.LiteLoader) {
                const isRequired = !module.required.isRequired
                const isEnabled = ProcessBuilder.isModEnabled(modConfig[module.versionlessID], module.required)
                if (!isRequired || (isRequired && isEnabled)) {
                    if (module.hasSubModules) {
                        const v = this.resolveModConfiguration(modConfig[module.versionlessID].mods, module.subModules)
                        forgeMods = forgeMods.concat(v.forgeMods)
                        liteMods = liteMods.concat(v.liteMods)
                        if (module.type === DistroTypes.LiteLoader) continue;
                    }
                    if (type === DistroTypes.ForgeMod) {
                        forgeMods.push(module)
                    } else {
                        liteMods.push(module)
                    }
                }
            }
        }

        return {
            forgeMods,
            liteMods
        }
    }


    /**
     * Construct a mod list json object.
     * 
     * @param {'forge' | 'liteloader'} type The mod list type to construct.
     * @param {Array.<Object>} mods An array of mods to add to the mod list.
     * @param {boolean} save Optional. Whether or not we should save the mod list file.
     */
    public constructJSONModList(type: 'forge' | 'liteloader', mods: Module[], save = false) {
        let modList: {
            repositoryRoot: string,
            modRef: string[]
        } = {
            repositoryRoot: ((type === 'forge' && this.requiresAbsolute()) ? 'absolute:' : '') + join(this.commonDir, 'modstore'),
            modRef: []
        }

        const ids: string[] = []
        if (type === 'forge') {
            for (let mod of mods) {
                ids.push(mod.extensionlessID)
            }
        } else {
            for (let mod of mods) {
                ids.push(mod.extensionlessID + '@' + mod.artifactExt)
            }
        }

        modList.modRef = ids

        if (save) {
            const json = JSON.stringify(modList, null, 4)
            writeFileSync(type === 'forge' ? this.fmlDir : this.llDir, json, { encoding: 'utf-8' })
        }

        return modList
    }

    /**
     * Construct the argument array that will be passed to the JVM process.
     * 
     * @param {Array.<Object>} mods An array of enabled mods which will be launched with this process.
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {Array.<string>} An array containing the full JVM arguments for this process.
     */
    public constructJVMArguments(mods: Module[], tempNativePath: string): string[] {
        if (MinecraftUtil.mcVersionAtLeast('1.13', this.server.minecraftVersion)) {
            return this.constructJVMArguments113(mods, tempNativePath)
        } else {
            return this.constructJVMArguments112(mods, tempNativePath)
        }
    }


    /**
     * Resolve the full classpath argument list for this process. This method will resolve all Mojang-declared
     * libraries as well as the libraries declared by the server. Since mods are permitted to declare libraries,
     * this method requires all enabled mods as an input
     * 
     * @param {Array.<Object>} mods An array of enabled mods which will be launched with this process.
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {Array.<string>} An array containing the paths of each library required by this process.
     */
    public classpathArg(mods: Module[], tempNativePath: string) {
        let cpArgs: string[] = []

        if (!MinecraftUtil.mcVersionAtLeast('1.17', this.server.minecraftVersion)) {
            // Add the version.jar to the classpath.
            // Must not be added to the classpath for Forge 1.17+.
            const version = this.versionData.id
            cpArgs.push(join(this.commonDir, 'versions', version, version + '.jar'))
        }


        if (this.usingLiteLoader && this.llPath) {
            cpArgs.push(this.llPath)
        }

        // Resolve the Mojang declared libraries.
        const mojangLibs = this.resolveMojangLibraries(tempNativePath)

        // Resolve the server declared libraries.
        const servLibs = this.resolveServerLibraries(mods)

        // Merge libraries, server libs with the same
        // maven identifier will override the mojang ones.
        // Ex. 1.7.10 forge overrides mojang's guava with newer version.
        const finalLibs = { ...mojangLibs, ...servLibs }
        cpArgs = cpArgs.concat(Object.values(finalLibs))

        this.processClassPathList(cpArgs)

        return cpArgs
    }

    /**
     * Construct the mod argument list for forge 1.13
     * 
     * @param {Array.<Object>} mods An array of mods to add to the mod list.
     */
    public constructModList(mods: Module[]) {
        const writeBuffer = mods.map(mod => {
            return mod.extensionlessID
        }).join('\n')

        if (writeBuffer) {
            writeFileSync(this.forgeModListFile, writeBuffer, { encoding: 'utf-8' })
            return [
                '--fml.mavenRoots',
                join('..', '..', 'common', 'modstore'),
                '--fml.modLists',
                this.forgeModListFile
            ]
        } else {
            return []
        }

    }



    /**
     * Ensure that the classpath entries all point to jar files.
     * 
     * //TODO: WTF WHY MATE WHY ?????
     * @param {Array.<String>} classpathEntries Array of classpath entries.
     */
    private processClassPathList(classpathEntries: string[]) {
        const ext = '.jar'
        const extLen = ext.length
        for (let i = 0; i < classpathEntries.length; i++) {
            const extIndex = classpathEntries[i].indexOf(ext)
            if (extIndex > -1 && extIndex !== classpathEntries[i].length - extLen) {
                classpathEntries[i] = classpathEntries[i].substring(0, extIndex + extLen)
            }
        }
    }


    /**
     * Resolve the libraries declared by this server in order to add them to the classpath.
     * This method will also check each enabled mod for libraries, as mods are permitted to
     * declare libraries.
     * 
     * @param {Array.<Object>} mods An array of enabled mods which will be launched with this process.
     * @returns {{[id: string]: string}} An object containing the paths of each library this server requires.
     */
    private resolveServerLibraries(mods: Module[]) {
        const modules: Module[] = this.server.modules;
        let libs: Record<string, string> = {}

        // Locate Forge/Libraries
        for (let module of modules) {
            const type = module.type
            if (type === DistroTypes.ForgeHosted || type === DistroTypes.Library) {
                libs[module.versionlessID] = module.artifact.path;
                if (!module.hasSubModules) continue;
                const res = this.resolveModuleLibraries(module)
                if (res.length > 0) {

                    //TODO: I don't understand why ? 
                    libs = { ...libs, ...res }
                }
            }
        }

        //Check for any libraries in our mod list.
        for (let i = 0; i < mods.length; i++) {
            const mod = mods[i];
            if (!mod.hasSubModules) continue;
            const res = this.resolveModuleLibraries(mods[i])
            if (res.length > 0) {
                //TODO: I don't understand why ? 
                libs = { ...libs, ...res }
            }
        }

        return libs
    }

    /**
     * Recursively resolve the path of each library required by this module.
     * 
     * @param {Object} module A module object from the server distro index.
     * @returns {Array.<string>} An array containing the paths of each library this module requires.
     */
    private resolveModuleLibraries(module: Module) {
        if (!module.hasSubModules) return []

        let libs: string[] = []

        for (let subModule of module.subModules) {
            if (subModule.type === DistroTypes.Library) {

                if (subModule.classpath) {
                    libs.push(subModule.artifact.path)
                }
            }

            // If this module has submodules, we need to resolve the libraries for those.
            // To avoid unnecessary recursive calls, base case is checked here.
            if (module.hasSubModules) {
                const res = this.resolveModuleLibraries(subModule)
                if (res.length > 0) {
                    libs = libs.concat(res)
                }
            }
        }

        return libs
    }


    /**
     * Resolve the libraries defined by Mojang's version data. This method will also extract
     * native libraries and point to the correct location for its classpath.
     * 
     * TODO - clean up function
     * 
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {{[id: string]: string}} An object containing the paths of each library mojang declares.
     */
    private resolveMojangLibraries(tempNativePath: string) {
        const nativesRegex = /.+:natives-([^-]+)(?:-(.+))?/
        let libs: Record<string, string> = {}

        const libArr = this.versionData.libraries
        ensureDirSync(tempNativePath)
        for (let i = 0; i < libArr.length; i++) {
            const lib = libArr[i]
            if (Library.validateRules(lib.rules, lib.natives)) {

                // Pre-1.19 has a natives object.
                if (lib.natives != null) {
                    // Extract the native library.
                    const exclusionArr: string[] = lib.extract != null ? lib.extract.exclude : ['META-INF/']
                    const artifact = lib.downloads.classifiers[lib.natives[Library.mojangFriendlyOS()].replace('${arch}', process.arch.replace('x', ''))]

                    // Location of native zip.
                    const to = join(this.libPath, artifact.path)

                    const zip = new AdmZip(to)
                    const zipEntries = zip.getEntries()

                    // Unzip the native zip.
                    for (let i = 0; i < zipEntries.length; i++) {
                        const fileName = zipEntries[i].entryName

                        let shouldExclude = false

                        // Exclude noted files.
                        exclusionArr.forEach(exclusion => {
                            if (fileName.indexOf(exclusion) > -1) {
                                shouldExclude = true
                            }
                        })

                        // Extract the file.
                        if (shouldExclude) continue;
                        writeFile(join(tempNativePath, fileName), zipEntries[i].getData(), (err) => {
                            if (err) {
                                logger.error('Error while extracting native library:', err)
                            }
                        })

                    }
                }
                // 1.19+ logic
                else if (lib.name.includes('natives-')) {

                    const regexTest: RegExpExecArray | null = nativesRegex.exec(lib.name)
                    // const os = regexTest[1]
                    if (!regexTest) throw new Error("No RegexTest - Processor Builder");

                    const arch = regexTest[2] ?? 'x64'

                    if (arch != process.arch) continue;

                    // Extract the native library.
                    const exclusionArr: string[] = lib.extract != null ? lib.extract.exclude : ['META-INF/', '.git', '.sha1']
                    const artifact = lib.downloads.artifact

                    // Location of native zip.
                    const to = join(this.libPath, artifact.path)

                    let zip = new AdmZip(to)
                    let zipEntries = zip.getEntries()

                    // Unzip the native zip.
                    for (let i = 0; i < zipEntries.length; i++) {
                        if (zipEntries[i].isDirectory) continue;

                        const fileName = zipEntries[i].entryName;

                        let shouldExclude = false;

                        // Exclude noted files.
                        exclusionArr.forEach(exclusion => {
                            if (fileName.indexOf(exclusion) > -1) {
                                shouldExclude = true
                            }
                        })

                        const extractName = fileName.includes('/') ? fileName.substring(fileName.lastIndexOf('/')) : fileName

                        // Extract the file.
                        if (shouldExclude) continue;

                        writeFile(join(tempNativePath, extractName), zipEntries[i].getData(), (err) => {
                            if (err) {
                                logger.error('Error while extracting native library:', err)
                            }
                        })
                    }
                }
                // No natives
                else {
                    const dlInfo = lib.downloads
                    const artifact = dlInfo.artifact
                    const to = join(this.libPath, artifact.path)
                    const versionIndependentId = lib.name.substring(0, lib.name.lastIndexOf(':'))
                    libs[versionIndependentId] = to
                }
            }
        }

        return libs
    }

    /**
     * Construct the argument array that will be passed to the JVM process.
     * This function is for 1.12 and below.
     * 
     * @param {Array.<Object>} mods An array of enabled mods which will be launched with this process.
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {Array.<string>} An array containing the full JVM arguments for this process.
     */
    private constructJVMArguments112(mods: Module[], tempNativePath: string) {

        let args: string[] = []

        // Classpath Argument
        args.push('-cp')
        args.push(this.classpathArg(mods, tempNativePath).join(ProcessBuilder.classpathSeparator))

        // Java Arguments
        if (process.platform === 'darwin') {
            args.push(`-Xdock:name=${ConfigManager.launcherName.replace(" ", "")}`)
            args.push('-Xdock:icon=' + join(__dirname, '..', 'images', 'minecraft.icns'))
        }
        args.push('-Xmx' + ConfigManager.getMaxRAM(this.server.id))
        args.push('-Xms' + ConfigManager.getMinRAM(this.server.id))
        args = args.concat(ConfigManager.getJVMOptions(this.server.id))
        args.push('-Djava.library.path=' + tempNativePath)

        // Main Java Class
        args.push(this.forgeData.mainClass)

        // Forge Arguments
        args = args.concat(this.resolveForgeArgs())

        return args
    }

    /**
     * Construct the argument array that will be passed to the JVM process.
     * This function is for 1.13+
     * 
     * Note: Required Libs https://github.com/MinecraftForge/MinecraftForge/blob/af98088d04186452cb364280340124dfd4766a5c/src/fmllauncher/java/net/minecraftforge/fml/loading/LibraryFinder.java#L82
     * 
     * @param {Array.<Object>} mods An array of enabled mods which will be launched with this process.
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {Array.<string>} An array containing the full JVM arguments for this process.
     */
    private constructJVMArguments113(mods: Module[], tempNativePath: string): string[] {

        const argDiscovery = /\${*(.*)}/

        // JVM Arguments First
        let args = this.versionData.arguments.jvm

        // Debug securejarhandler
        // args.push('-Dbsl.debug=true')

        if (this.forgeData.arguments.jvm != null) {
            for (const argStr of this.forgeData.arguments.jvm) {
                args.push(argStr
                    .replaceAll('${library_directory}', this.libPath)
                    .replaceAll('${classpath_separator}', ProcessBuilder.classpathSeparator)
                    .replaceAll('${version_name}', this.forgeData.id)
                )
            }
        }

        //args.push('-Dlog4j.configurationFile=D:\\WesterosCraft\\game\\common\\assets\\log_configs\\client-1.12.xml')

        // Java Arguments
        if (process.platform === 'darwin') {
            args.push(`-Xdock:name=${ConfigManager.launcherName.replace(" ", "")}`)
            args.push('-Xdock:icon=' + join(__dirname, '..', 'images', 'minecraft.icns'))
        }
        args.push('-Xmx' + ConfigManager.getMaxRAM(this.server.id))
        args.push('-Xms' + ConfigManager.getMinRAM(this.server.id))
        args = args.concat(ConfigManager.getJVMOptions(this.server.id))

        // Main Java Class
        args.push(this.forgeData.mainClass)

        // Vanilla Arguments
        args = args.concat(this.versionData.arguments.game)

        for (let i = 0; i < args.length; i++) {
            const argument = args[i];
            if (typeof argument === 'string') {

                if (argDiscovery.test(argument)) {
                    const identifier = argument.match(argDiscovery)![1]
                    let val: string | null = null;
                    switch (identifier) {
                        case 'auth_player_name':
                            val = this.authUser.displayName.trim()
                            break
                        case 'version_name':
                            //val = versionData.id
                            val = this.server.id
                            break
                        case 'game_directory':
                            val = this.gameDir
                            break
                        case 'assets_root':
                            val = join(this.commonDir, 'assets')
                            break
                        case 'assets_index_name':
                            val = this.versionData.assets
                            break
                        case 'auth_uuid':
                            val = this.authUser.uuid.trim()
                            break
                        case 'auth_access_token':
                            val = this.authUser.accessToken
                            break
                        case 'user_type':
                            val = this.authUser.type === 'microsoft' ? 'msa' : 'mojang'
                            break
                        case 'version_type':
                            val = this.versionData.type
                            break
                        case 'resolution_width':
                            val = ConfigManager.getGameWidth().toString();
                            break
                        case 'resolution_height':
                            val = ConfigManager.getGameHeight().toString();
                            break
                        case 'natives_directory':
                            val = argument.replace(argDiscovery, tempNativePath)
                            break
                        case 'launcher_name':
                            val = argument.replace(argDiscovery, ConfigManager.launcherName)
                            break
                        case 'launcher_version':
                            val = argument.replace(argDiscovery, this.launcherVersion)
                            break
                        case 'classpath':
                            val = this.classpathArg(mods, tempNativePath).join(ProcessBuilder.classpathSeparator)
                            break
                    }
                    if (val) {
                        args[i] = val
                    }
                }

            } else if (argument.rules != null) {
                let checksum = 0
                for (let rule of argument.rules) {
                    if (rule.os != null) {
                        if (rule.os.name === Library.mojangFriendlyOS()
                            && (rule.os.version == null || new RegExp(rule.os.version).test(os.release()))) {
                            if (rule.action === 'allow') {
                                checksum++
                            }
                        } else {
                            if (rule.action === 'disallow') {
                                checksum++
                            }
                        }
                    } else if (rule.features != null) {
                        // We don't have many 'features' in the index at the moment.
                        // This should be fine for a while.
                        // TODO: Make it a bit better 
                        if (rule.features.has_custom_resolution != null && rule.features.has_custom_resolution === true) {
                            if (ConfigManager.getFullscreen()) {
                                (args[i] as ArgumentRule).value = [
                                    '--fullscreen',
                                    'true'
                                ]
                            }
                            checksum++
                        }
                    }
                }

                // TODO splice not push
                if (checksum === argument.rules.length) {
                    if (typeof argument.value === 'string') {
                        args[i] = argument.value
                    } else if (typeof argument.value === 'object') {
                        args.splice(i, 1, ...argument.value)
                    }

                    // Decrement i to reprocess the resolved value
                    i--;
                } else {
                    // If not whith the checksum remove the element.
                    args.splice(i, 1)
                }
            }
        }

        // Autoconnect
        let isAutoconnectBroken
        try {
            isAutoconnectBroken = MinecraftUtil.isAutoconnectBroken(this.forgeData.id.split('-')[2])
        } catch (err) {
            logger.error(err)
            logger.error('Forge version format changed.. assuming autoconnect works.')
            logger.debug('Forge version:', this.forgeData.id)
        }

        if (isAutoconnectBroken) {
            logger.error('Server autoconnect disabled on Forge 1.15.2 for builds earlier than 31.2.15 due to OpenGL Stack Overflow issue.')
            logger.error('Please upgrade your Forge version to at least 31.2.15!')
        } else {
            this.processAutoConnectArg(args)
        }


        // Forge Specific Arguments
        args = args.concat(this.forgeData.arguments.game)

        // Filter null values
        args = args.filter(arg => typeof arg === 'string')

        return args as string[]
    }

    private lteMinorVersion(version: number) {
        return Number(this.forgeData.id.split('-')[0].split('.')[1]) <= version;
    }


    /**
     * Test to see if this version of forge requires the absolute: prefix
     * on the modListFile repository field.
     */
    private requiresAbsolute() {
        try {
            if (this.lteMinorVersion(9)) {
                return false
            }

            const ver = this.forgeData.id.split('-')[2]
            const pts = ver.split('.')
            const min = [14, 23, 3, 2655]
            for (let i = 0; i < pts.length; i++) {
                const parsed = Number.parseInt(pts[i])
                if (parsed < min[i]) {
                    return false
                } else if (parsed > min[i]) {
                    return true
                }
            }
        } catch (err) {
            // We know old forge versions follow this format.
            // Error must be caused by newer version.
        }

        // Equal or errored
        return true
    }

    /**
 * Resolve the arguments required by forge.
 * 
 * @returns {Array.<string>} An array containing the arguments required by forge.
 */
    private resolveForgeArgs() {
        const mcArgs = this.forgeData.minecraftArguments.split(' ')
        const argDiscovery = /\${*(.*)}/

        // Replace the declared variables with their proper values.
        for (let i = 0; i < mcArgs.length; ++i) {
            if (argDiscovery.test(mcArgs[i])) {
                const identifier = mcArgs[i].match(argDiscovery)[1]
                let val: string | null = null
                switch (identifier) {
                    case 'auth_player_name':
                        val = this.authUser.displayName.trim()
                        break
                    case 'version_name':
                        //val = versionData.id
                        val = this.server.id
                        break
                    case 'game_directory':
                        val = this.gameDir
                        break
                    case 'assets_root':
                        val = join(this.commonDir, 'assets')
                        break
                    case 'assets_index_name':
                        val = this.versionData.assets
                        break
                    case 'auth_uuid':
                        val = this.authUser.uuid.trim()
                        break
                    case 'auth_access_token':
                        val = this.authUser.accessToken
                        break
                    case 'user_type':
                        val = this.authUser.type === 'microsoft' ? 'msa' : 'mojang'
                        break
                    case 'user_properties': // 1.8.9 and below.
                        val = '{}'
                        break
                    case 'version_type':
                        val = this.versionData.type
                        break
                }
                if (val != null) {
                    mcArgs[i] = val
                }
            }
        }

        // Autoconnect to the selected server.
        this.processAutoConnectArg(mcArgs)

        // Prepare game resolution
        if (ConfigManager.getFullscreen()) {
            mcArgs.push('--fullscreen')
            mcArgs.push(true)
        } else {
            mcArgs.push('--width')
            mcArgs.push(ConfigManager.getGameWidth())
            mcArgs.push('--height')
            mcArgs.push(ConfigManager.getGameHeight())
        }

        // Mod List File Argument
        mcArgs.push('--modListFile')
        if (this.lteMinorVersion(9)) {
            mcArgs.push(basename(this.fmlDir))
        } else {
            mcArgs.push('absolute:' + this.fmlDir)
        }


        // LiteLoader
        if (this.usingLiteLoader) {
            mcArgs.push('--modRepo')
            mcArgs.push(this.llDir)

            // Set first arg to liteloader tweak class
            mcArgs.unshift('com.mumfrey.liteloader.launch.LiteLoaderTweaker')
            mcArgs.unshift('--tweakClass')
        }

        return mcArgs
    }

    //TODO: Not a huge fan of working by reference in Typescript/JS
    // Can be a bit shitty some times
    private processAutoConnectArg(args: any[]) {
        if (ConfigManager.getAutoConnect() && this.server.autoconnect) {
            const serverURL = new URL('my://' + this.server.address)
            args.push('--server')
            args.push(serverURL.hostname)
            if (serverURL.port) {
                args.push('--port')
                args.push(serverURL.port)
            }
        }
    }

}