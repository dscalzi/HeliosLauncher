import AdmZip from 'adm-zip'
import { pathExistsSync, writeFile, ensureDirSync, writeFileSync, remove } from 'fs-extra'
import { join, basename } from 'path'
import { ModuleWrapper, ServerWrapper } from './distromanager'
import { Type, Required } from 'helios-distribution-types'
import { LoggerUtil } from './loggerutil'
import { ConfigManager } from '../config/configmanager'
import { spawn } from 'child_process'
import { SavedAccount } from '../config/model/SavedAccount'
import { tmpdir, release } from 'os'
import { SubModConfig } from '../config/model/ModConfig'
import { pseudoRandomBytes } from 'crypto'
import { Util, LibraryInternal } from './assetguard'
import { VersionJson, Rule } from '../asset/model/mojang/VersionJson'
import { URL } from 'url'

const logger = new LoggerUtil('%c[ProcessBuilder]', 'color: #003996; font-weight: bold')

export class ProcessBuilder {

    private gameDir: string
    private commonDir: string
    private fmlDir: string
    private llDir: string
    private libPath: string
    
    private usingLiteLoader: boolean
    private llPath: string | null

    constructor(
        private wrappedServer: ServerWrapper,
        private versionData: VersionJson,
        private forgeData: any, // TODO type
        private authUser: SavedAccount,
        private launcherVersion: string
    ){
        this.gameDir = join(ConfigManager.getInstanceDirectory(), wrappedServer.server.id)
        this.commonDir = ConfigManager.getCommonDirectory()
        this.authUser = authUser
        this.launcherVersion = launcherVersion
        this.fmlDir = join(this.gameDir, 'forgeModList.json')
        this.llDir = join(this.gameDir, 'liteloaderModList.json')
        this.libPath = join(this.commonDir, 'libraries')

        this.usingLiteLoader = false
        this.llPath = null
    }
    
    /**
     * Convienence method to run the functions typically used to build a process.
     */
    build(){
        ensureDirSync(this.gameDir)
        const tempNativePath = join(tmpdir(), ConfigManager.getTempNativeFolder(), pseudoRandomBytes(16).toString('hex'))
        process.throwDeprecation = true
        this.setupLiteLoader()
        logger.log('Using liteloader:', this.usingLiteLoader)
        const modObj = this.resolveModConfiguration(ConfigManager.getModConfiguration(this.wrappedServer.server.id)!.mods, this.wrappedServer.getWrappedModules())
        
        // Mod list below 1.13
        if(!Util.mcVersionAtLeast('1.13', this.wrappedServer.server.minecraftVersion)){
            this.constructModList('forge', modObj.fMods, true)
            if(this.usingLiteLoader){
                this.constructModList('liteloader', modObj.lMods, true)
            }
        }
        
        const uberModArr = modObj.fMods.concat(modObj.lMods)
        let args = this.constructJVMArguments(uberModArr, tempNativePath)

        if(Util.mcVersionAtLeast('1.13', this.wrappedServer.server.minecraftVersion)){
            args = args.concat(this.constructModArguments(modObj.fMods))
        }

        logger.log('Launch Arguments:', args)

        const child = spawn(ConfigManager.getJavaExecutable()!, args, {
            cwd: this.gameDir,
            detached: ConfigManager.getLaunchDetached()
        })

        if(ConfigManager.getLaunchDetached()){
            child.unref()
        }

        child.stdout.setEncoding('utf8')
        child.stderr.setEncoding('utf8')

        const loggerMCstdout = new LoggerUtil('%c[Minecraft]', 'color: #36b030; font-weight: bold')
        const loggerMCstderr = new LoggerUtil('%c[Minecraft]', 'color: #b03030; font-weight: bold')

        child.stdout.on('data', (data) => {
            loggerMCstdout.log(data)
        })
        child.stderr.on('data', (data) => {
            loggerMCstderr.log(data)
        })
        child.on('close', (code, signal) => {
            logger.log('Exited with code', code)
            remove(tempNativePath, (err) => {
                if(err){
                    logger.warn('Error while deleting temp dir', err)
                } else {
                    logger.log('Temp dir deleted successfully.')
                }
            })
        })

        return child
    }

    /**
     * Determine if an optional mod is enabled from its configuration value. If the
     * configuration value is null, the required object will be used to
     * determine if it is enabled.
     * 
     * A mod is enabled if:
     *   * The configuration is not null and one of the following:
     *     * The configuration is a boolean and true.
     *     * The configuration is an object and its 'value' property is true.
     *   * The configuration is null and one of the following:
     *     * The required object is null.
     *     * The required object's 'def' property is null or true.
     * 
     * @param {SubModConfig | boolean} modCfg The mod configuration object.
     * @param {Required | undefined} required Optional. The required object from the mod's distro declaration.
     * @returns {boolean} True if the mod is enabled, false otherwise.
     */
    public static isModEnabled(modCfg: SubModConfig | boolean, required?: Required){
        return modCfg != null ? ((typeof modCfg === 'boolean' && modCfg) || (typeof modCfg === 'object' && (typeof modCfg.value !== 'undefined' ? modCfg.value : true))) : required != null ? required.def : true
    }

    /**
     * Function which performs a preliminary scan of the top level
     * mods. If liteloader is present here, we setup the special liteloader
     * launch options. Note that liteloader is only allowed as a top level
     * mod. It must not be declared as a submodule.
     */
    private setupLiteLoader(): void {
        for(const ll of this.wrappedServer.getWrappedModules()){
            if(ll.module.type === Type.LiteLoader){
                if(!ll.module.required!.value!){
                    const modCfg = ConfigManager.getModConfiguration(this.wrappedServer.server.id)!.mods
                    if(ProcessBuilder.isModEnabled(modCfg[ll.getVersionlessID()], ll.module.required)){
                        if(pathExistsSync(ll.module.artifact.path!)){
                            this.usingLiteLoader = true
                            this.llPath = ll.module.artifact.path!
                        }
                    }
                } else {
                    if(pathExistsSync(ll.module.artifact.path!)){
                        this.usingLiteLoader = true
                        this.llPath = ll.module.artifact.path!
                    }
                }
            }
        }
    }

    /**
     * Resolve an array of all enabled mods. These mods will be constructed into
     * a mod list format and enabled at launch.
     * 
     * @param {{[id: string]: boolean | SubModConfig}} modCfg The mod configuration object.
     * @param {Array.<ModuleWrapper>} mdls An array of modules to parse.
     * @returns {{fMods: Array.<ModuleWrapper>, lMods: Array.<ModuleWrapper>}} An object which contains
     * a list of enabled forge mods and litemods.
     */
    resolveModConfiguration(modCfg: {[id: string]: boolean | SubModConfig}, mdls: ModuleWrapper[]): {fMods: ModuleWrapper[], lMods: ModuleWrapper[]}{
        let fMods: ModuleWrapper[] = []
        let lMods: ModuleWrapper[] = []

        for(const mdl of mdls){
            const type = mdl.module.type
            if(type === Type.ForgeMod || type === Type.LiteMod || type === Type.LiteLoader){
                const o = !mdl.module.required!.value!
                const e = ProcessBuilder.isModEnabled(modCfg[mdl.getVersionlessID()], mdl.module.required)
                if(!o || (o && e)){
                    if(mdl.hasSubModules()){
                        const v = this.resolveModConfiguration((modCfg[mdl.getVersionlessID()] as SubModConfig).mods, mdl.getWrappedSubmodules())
                        fMods = fMods.concat(v.fMods)
                        lMods = lMods.concat(v.lMods)
                        if(mdl.module.type === Type.LiteLoader){
                            continue
                        }
                    }
                    if(mdl.module.type === Type.ForgeMod){
                        fMods.push(mdl)
                    } else {
                        lMods.push(mdl)
                    }
                }
            }
        }

        return {
            fMods,
            lMods
        }
    }

    _isBelowOneDotSeven() {
        return Number(this.forgeData.id.split('-')[0].split('.')[1]) <= 7
    }

    /**
     * Test to see if this version of forge requires the absolute: prefix
     * on the modListFile repository field.
     */
    _requiresAbsolute(){
        try {
            if(this._isBelowOneDotSeven()) {
                return false
            }
            const ver = this.forgeData.id.split('-')[2]
            const pts = ver.split('.')
            const min = [14, 23, 3, 2655]
            for(let i=0; i<pts.length; i++){
                const parsed = Number.parseInt(pts[i])
                if(parsed < min[i]){
                    return false
                } else if(parsed > min[i]){
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
     * Construct a mod list json object.
     * 
     * @param {'forge' | 'liteloader'} type The mod list type to construct.
     * @param {Array.<ModuleWrapper>} mods An array of mods to add to the mod list.
     * @param {boolean} save Optional. Whether or not we should save the mod list file.
     */
    constructModList(type: 'forge' | 'liteloader', mods: ModuleWrapper[], save = false){
        const modList = {
            repositoryRoot: ((type === 'forge' && this._requiresAbsolute()) ? 'absolute:' : '') + join(this.commonDir, 'modstore'),
            modRef: [] as string[]
        }

        const ids = []
        if(type === 'forge'){
            for(let mod of mods){
                ids.push(mod.getExtensionlessID())
            }
        } else {
            for(let mod of mods){
                ids.push(mod.getExtensionlessID() + '@' + mod.getExtension())
            }
        }
        modList.modRef = ids
        
        if(save){
            const json = JSON.stringify(modList, null, 4)
            writeFileSync(type === 'forge' ? this.fmlDir : this.llDir, json, 'UTF-8')
        }

        return modList
    }

    /**
     * Construct the mod argument list for forge 1.13
     * 
     * @param {Array.<ModuleWrapper>} mods An array of mods to add to the mod list.
     */
    constructModArguments(mods: ModuleWrapper[]){
        const argStr = mods.map(mod => {
            return mod.getExtensionlessID()
        }).join(',')

        if(argStr){
            return [
                '--fml.mavenRoots',
                join('..', '..', 'common', 'modstore'),
                '--fml.mods',
                argStr
            ]
        } else {
            return []
        }
        
    }

    /**
     * Construct the argument array that will be passed to the JVM process.
     * 
     * @param {Array.<ModuleWrapper>} mods An array of enabled mods which will be launched with this process.
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {Array.<string| number>} An array containing the full JVM arguments for this process.
     */
    constructJVMArguments(mods: ModuleWrapper[], tempNativePath: string): string[] {
        if(Util.mcVersionAtLeast('1.13', this.wrappedServer.server.minecraftVersion)){
            return this._constructJVMArguments113(mods, tempNativePath)
        } else {
            return this._constructJVMArguments112(mods, tempNativePath)
        }
    }

    /**
     * Construct the argument array that will be passed to the JVM process.
     * This function is for 1.12 and below.
     * 
     * @param {Array.<ModuleWrapper>} mods An array of enabled mods which will be launched with this process.
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {Array.<string>} An array containing the full JVM arguments for this process.
     */
    _constructJVMArguments112(mods: ModuleWrapper[], tempNativePath: string): string[] {

        let args = []

        // Classpath Argument
        args.push('-cp')
        args.push(this.classpathArg(mods, tempNativePath).join(process.platform === 'win32' ? ';' : ':'))

        // Java Arguments
        if(process.platform === 'darwin'){
            args.push('-Xdock:name=HeliosLauncher')
            args.push('-Xdock:icon=' + join(__dirname, '..', 'images', 'minecraft.icns'))
        }
        args.push('-Xmx' + ConfigManager.getMaxRAM())
        args.push('-Xms' + ConfigManager.getMinRAM())
        args = args.concat(ConfigManager.getJVMOptions())
        args.push('-Djava.library.path=' + tempNativePath)

        // Main Java Class
        args.push(this.forgeData.mainClass)

        // Forge Arguments
        args = args.concat(this._resolveForgeArgs())

        return args
    }

    /**
     * Construct the argument array that will be passed to the JVM process.
     * This function is for 1.13+
     * 
     * Note: Required Libs https://github.com/MinecraftForge/MinecraftForge/blob/af98088d04186452cb364280340124dfd4766a5c/src/fmllauncher/java/net/minecraftforge/fml/loading/LibraryFinder.java#L82
     * 
     * @param {Array.<ModuleWrapper>} mods An array of enabled mods which will be launched with this process.
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {Array.<string>} An array containing the full JVM arguments for this process.
     */
    _constructJVMArguments113(mods: ModuleWrapper[], tempNativePath: string): string[] {

        const argDiscovery = /\${*(.*)}/

        // JVM Arguments First
        let args: (string | { rules: Rule[], value: string[] })[] = this.versionData.arguments.jvm

        //args.push('-Dlog4j.configurationFile=D:\\WesterosCraft\\game\\common\\assets\\log_configs\\client-1.12.xml')

        // Java Arguments
        if(process.platform === 'darwin'){
            args.push('-Xdock:name=HeliosLauncher')
            args.push('-Xdock:icon=' + join(__dirname, '..', 'images', 'minecraft.icns'))
        }
        args.push('-Xmx' + ConfigManager.getMaxRAM())
        args.push('-Xms' + ConfigManager.getMinRAM())
        args = args.concat(ConfigManager.getJVMOptions())

        // Main Java Class
        args.push(this.forgeData.mainClass)

        // Vanilla Arguments
        args = args.concat(this.versionData.arguments.game)

        for(let i=0; i<args.length; i++){
            if(typeof args[i] === 'object' && (args[i] as any).rules != null){
                const arg = args[i] as { rules: Rule[], value: string[] }
                
                let checksum = 0
                for(let rule of arg.rules){
                    if(rule.os != null){
                        if(rule.os.name === LibraryInternal.mojangFriendlyOS()
                            && (rule.os.version == null || new RegExp(rule.os.version).test(release()))){
                            if(rule.action === 'allow'){
                                checksum++
                            }
                        } else {
                            if(rule.action === 'disallow'){
                                checksum++
                            }
                        }
                    } else if(rule.features != null){
                        // We don't have many 'features' in the index at the moment.
                        // This should be fine for a while.
                        if(rule.features.has_custom_resolution != null && rule.features.has_custom_resolution === true){
                            if(ConfigManager.getFullscreen()){
                                arg.value = [
                                    '--fullscreen',
                                    'true'
                                ]
                            }
                            checksum++
                        }
                    }
                }

                // TODO splice not push
                if(checksum === arg.rules.length){
                    if(typeof arg.value === 'string'){
                        args[i] = arg.value
                    } else if(typeof arg.value === 'object'){
                        //args = args.concat(args[i].value)
                        args.splice(i, 1, ...arg.value)
                    }

                    // Decrement i to reprocess the resolved value
                    i--
                } else {
                    args[i] = null! // TODO lol
                }

            } else if(typeof args[i] === 'string'){
                const arg = args[i] as string
                if(argDiscovery.test(arg)){
                    const identifier = arg.match(argDiscovery)![1]
                    let val = null
                    switch(identifier){
                        case 'auth_player_name':
                            val = this.authUser.displayName.trim()
                            break
                        case 'version_name':
                            //val = versionData.id
                            val = this.wrappedServer.server.id
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
                            val = 'mojang'
                            break
                        case 'version_type':
                            val = this.versionData.type
                            break
                        case 'resolution_width':
                            val = ConfigManager.getGameWidth()
                            break
                        case 'resolution_height':
                            val = ConfigManager.getGameHeight()
                            break
                        case 'natives_directory':
                            val = arg.replace(argDiscovery, tempNativePath)
                            break
                        case 'launcher_name':
                            val = arg.replace(argDiscovery, 'Helios-Launcher')
                            break
                        case 'launcher_version':
                            val = arg.replace(argDiscovery, this.launcherVersion)
                            break
                        case 'classpath':
                            val = this.classpathArg(mods, tempNativePath).join(process.platform === 'win32' ? ';' : ':')
                            break
                    }
                    if(val != null){
                        args[i] = val.toString()
                    }
                }
            }
        }

        // Forge Specific Arguments
        args = args.concat(this.forgeData.arguments.game)

        // Filter null values
        args = args.filter(arg => {
            return arg != null
        })

        return args as string[]
    }

    /**
     * Resolve the arguments required by forge.
     * 
     * @returns {Array.<string>} An array containing the arguments required by forge.
     */
    _resolveForgeArgs(): string[] {
        const mcArgs: string[] = this.forgeData.minecraftArguments.split(' ')
        const argDiscovery = /\${*(.*)}/

        // Replace the declared variables with their proper values.
        for(let i=0; i<mcArgs.length; ++i){
            if(argDiscovery.test(mcArgs[i])){
                const identifier = mcArgs[i].match(argDiscovery)![1]
                let val = null
                switch(identifier){
                    case 'auth_player_name':
                        val = this.authUser.displayName.trim()
                        break
                    case 'version_name':
                        //val = versionData.id
                        val = this.wrappedServer.server.id
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
                        val = 'mojang'
                        break
                    case 'user_properties': // 1.8.9 and below.
                        val = '{}'
                        break
                    case 'version_type':
                        val = this.versionData.type
                        break
                }
                if(val != null){
                    mcArgs[i] = val
                }
            }
        }

        // Autoconnect to the selected server.
        if(ConfigManager.getAutoConnect() && this.wrappedServer.server.autoconnect){
            const serverURL = new URL('my://' + this.wrappedServer.server.address)
            mcArgs.push('--server')
            mcArgs.push(serverURL.hostname)
            if(serverURL.port){
                mcArgs.push('--port')
                mcArgs.push(serverURL.port)
            }
        }

        // Prepare game resolution
        if(ConfigManager.getFullscreen()){
            mcArgs.push('--fullscreen')
            mcArgs.push('true')
        } else {
            mcArgs.push('--width')
            mcArgs.push(ConfigManager.getGameWidth().toString())
            mcArgs.push('--height')
            mcArgs.push(ConfigManager.getGameHeight().toString())
        }
        
        // Mod List File Argument
        mcArgs.push('--modListFile')
        if(this._isBelowOneDotSeven()) {
            mcArgs.push(basename(this.fmlDir))
        } else {
            mcArgs.push('absolute:' + this.fmlDir)
        }
        

        // LiteLoader
        if(this.usingLiteLoader){
            mcArgs.push('--modRepo')
            mcArgs.push(this.llDir)

            // Set first arg to liteloader tweak class
            mcArgs.unshift('com.mumfrey.liteloader.launch.LiteLoaderTweaker')
            mcArgs.unshift('--tweakClass')
        }

        return mcArgs
    }

    /**
     * Resolve the full classpath argument list for this process. This method will resolve all Mojang-declared
     * libraries as well as the libraries declared by the server. Since mods are permitted to declare libraries,
     * this method requires all enabled mods as an input
     * 
     * @param {Array.<ModuleWrapper>} mods An array of enabled mods which will be launched with this process.
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {Array.<string>} An array containing the paths of each library required by this process.
     */
    classpathArg(mods: ModuleWrapper[], tempNativePath: string): string[] {
        let cpArgs: string[] = []

        // Add the version.jar to the classpath.
        const version = this.versionData.id
        cpArgs.push(join(this.commonDir, 'versions', version, version + '.jar'))

        if(this.usingLiteLoader){
            cpArgs.push(this.llPath!)
        }

        // Resolve the Mojang declared libraries.
        const mojangLibs = this._resolveMojangLibraries(tempNativePath)

        // Resolve the server declared libraries.
        const servLibs = this._resolveServerLibraries(mods)

        // Merge libraries, server libs with the same
        // maven identifier will override the mojang ones.
        // Ex. 1.7.10 forge overrides mojang's guava with newer version.
        const finalLibs = {...mojangLibs, ...servLibs}
        cpArgs = cpArgs.concat(Object.values(finalLibs))

        return cpArgs
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
    _resolveMojangLibraries(tempNativePath: string): {[id: string]: string} {
        const libs: {[id: string]: string} = {}

        const libArr = this.versionData.libraries
        ensureDirSync(tempNativePath)
        for(let i=0; i<libArr.length; i++){
            const lib = libArr[i]
            if(LibraryInternal.validateRules(lib.rules, lib.natives)){
                if(lib.natives == null){
                    const dlInfo = lib.downloads
                    const artifact = dlInfo.artifact
                    const to = join(this.libPath, artifact.path)
                    const versionIndependentId: string = lib.name.substring(0, lib.name.lastIndexOf(':'))
                    libs[versionIndependentId] = to
                } else {
                    // Extract the native library.
                    const exclusionArr: string[] = lib.extract != null ? lib.extract.exclude : ['META-INF/']
                    // @ts-ignore
                    const artifact = lib.downloads.classifiers[lib.natives[LibraryInternal.mojangFriendlyOS()].replace('${arch}', process.arch.replace('x', ''))]
    
                    // Location of native zip.
                    const to = join(this.libPath, artifact.path)
    
                    let zip = new AdmZip(to)
                    let zipEntries = zip.getEntries()
    
                    // Unzip the native zip.
                    for(let i=0; i<zipEntries.length; i++){
                        const fileName = zipEntries[i].entryName
    
                        let shouldExclude = false

                        // Exclude noted files.
                        exclusionArr.forEach((exclusion: string) => {
                            if(fileName.indexOf(exclusion) > -1){
                                shouldExclude = true
                            }
                        })

                        // Extract the file.
                        if(!shouldExclude){
                            writeFile(join(tempNativePath, fileName), zipEntries[i].getData(), (err) => {
                                if(err){
                                    logger.error('Error while extracting native library:', err)
                                }
                            })
                        }
    
                    }
                }
            }
        }

        return libs
    }

    /**
     * Resolve the libraries declared by this server in order to add them to the classpath.
     * This method will also check each enabled mod for libraries, as mods are permitted to
     * declare libraries.
     * 
     * @param {Array.<ModuleWrapper>} mods An array of enabled mods which will be launched with this process.
     * @returns {{[id: string]: string}} An object containing the paths of each library this server requires.
     */
    _resolveServerLibraries(mods: ModuleWrapper[]): {[id: string]: string} {
        const mdls: ModuleWrapper[] = this.wrappedServer.getWrappedModules()
        let libs: {[id: string]: string} = {}

        // Locate Forge/Libraries
        for(let mdl of mdls){
            const type = mdl.module.type
            if(type === Type.ForgeHosted || type === Type.Library){
                libs[mdl.getVersionlessID()] = mdl.module.artifact.path as string
                if(mdl.hasSubModules()){
                    const res = this._resolveModuleLibraries(mdl)
                    if(Object.keys(res).length > 0){
                        libs = {...libs, ...res}
                    }
                }
            }
        }

        //Check for any libraries in our mod list.
        for(let i=0; i<mods.length; i++){
            if(mods[i].hasSubModules()){
                const res = this._resolveModuleLibraries(mods[i])
                if(Object.keys(res).length > 0){
                    libs = {...libs, ...res}
                }
            }
        }

        return libs
    }

    /**
     * Recursively resolve the path of each library required by this module.
     * 
     * @param {ModuleWrapper} mdl A module object from the server distro index.
     * @returns {Array.<string>} An array containing the paths of each library this module requires.
     */
    _resolveModuleLibraries(mdl: ModuleWrapper): {[id: string]: string} {
        if(!mdl.hasSubModules()){
            return {}
        }
        let libs: {[id: string]: string} = {}
        for(const sm of mdl.getWrappedSubmodules()){
            if(sm.module.type === Type.Library){
                libs[sm.getVersionlessID()] = sm.module.artifact.path as string
            }
            // If this module has submodules, we need to resolve the libraries for those.
            // To avoid unnecessary recursive calls, base case is checked here.
            if(mdl.hasSubModules()){
                const res = this._resolveModuleLibraries(sm)
                if(Object.keys(res).length > 0){
                    libs = {...libs, ...res}
                }
            }
        }
        return libs
    }
}