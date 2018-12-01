const AdmZip                = require('adm-zip')
const child_process         = require('child_process')
const crypto                = require('crypto')
const fs                    = require('fs-extra')
const os                    = require('os')
const path                  = require('path')
const {URL}                 = require('url')

const { Library }           = require('./assetguard')
const ConfigManager         = require('./configmanager')
const DistroManager         = require('./distromanager')
const LoggerUtil            = require('./loggerutil')

const logger = LoggerUtil('%c[ProcessBuilder]', 'color: #003996; font-weight: bold')

class ProcessBuilder {

    constructor(distroServer, versionData, forgeData, authUser){
        this.gameDir = path.join(ConfigManager.getInstanceDirectory(), distroServer.getID())
        this.commonDir = ConfigManager.getCommonDirectory()
        this.server = distroServer
        this.versionData = versionData
        this.forgeData = forgeData
        this.authUser = authUser
        this.fmlDir = path.join(this.gameDir, 'forgeModList.json')
        this.llDir = path.join(this.gameDir, 'liteloaderModList.json')
        this.libPath = path.join(this.commonDir, 'libraries')

        this.usingLiteLoader = false
        this.llPath = null
    }
    
    /**
     * Convienence method to run the functions typically used to build a process.
     */
    build(){
        fs.ensureDirSync(this.gameDir)
        const tempNativePath = path.join(os.tmpdir(), ConfigManager.getTempNativeFolder(), crypto.pseudoRandomBytes(16).toString('hex'))
        process.throwDeprecation = true
        this.setupLiteLoader()
        logger.log('Using liteloader:', this.usingLiteLoader)
        const modObj = this.resolveModConfiguration(ConfigManager.getModConfiguration(this.server.getID()).mods, this.server.getModules())
        this.constructModList('forge', modObj.fMods, true)
        if(this.usingLiteLoader){
            this.constructModList('liteloader', modObj.lMods, true)
        }
        const uberModArr = modObj.fMods.concat(modObj.lMods)
        const args = this.constructJVMArguments(uberModArr, tempNativePath)

        logger.log('Launch Arguments:', args)

        const child = child_process.spawn(ConfigManager.getJavaExecutable(), args, {
            cwd: this.gameDir,
            detached: ConfigManager.getLaunchDetached()
        })

        if(ConfigManager.getLaunchDetached()){
            child.unref()
        }

        child.stdout.setEncoding('utf8')
        child.stderr.setEncoding('utf8')

        const loggerMCstdout = LoggerUtil('%c[Minecraft]', 'color: #36b030; font-weight: bold')
        const loggerMCstderr = LoggerUtil('%c[Minecraft]', 'color: #b03030; font-weight: bold')

        child.stdout.on('data', (data) => {
            loggerMCstdout.log(data)
        })
        child.stderr.on('data', (data) => {
            loggerMCstderr.log(data)
        })
        child.on('close', (code, signal) => {
            logger.log('Exited with code', code)
            fs.remove(tempNativePath, (err) => {
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
     * @param {Object | boolean} modCfg The mod configuration object.
     * @param {Object} required Optional. The required object from the mod's distro declaration.
     * @returns {boolean} True if the mod is enabled, false otherwise.
     */
    static isModEnabled(modCfg, required = null){
        return modCfg != null ? ((typeof modCfg === 'boolean' && modCfg) || (typeof modCfg === 'object' && (typeof modCfg.value !== 'undefined' ? modCfg.value : true))) : required != null ? required.isDefault() : true
    }

    /**
     * Function which performs a preliminary scan of the top level
     * mods. If liteloader is present here, we setup the special liteloader
     * launch options. Note that liteloader is only allowed as a top level
     * mod. It must not be declared as a submodule.
     */
    setupLiteLoader(){
        for(let ll of this.server.getModules()){
            if(ll.getType() === DistroManager.Types.LiteLoader){
                if(!ll.getRequired().isRequired()){
                    const modCfg = ConfigManager.getModConfiguration(this.server.getID()).mods
                    if(ProcessBuilder.isModEnabled(modCfg[ll.getVersionlessID()], ll.getRequired())){
                        if(fs.existsSync(ll.getArtifact().getPath())){
                            this.usingLiteLoader = true
                            this.llPath = ll.getArtifact().getPath()
                        }
                    }
                } else {
                    if(fs.existsSync(ll.getArtifact().getPath())){
                        this.usingLiteLoader = true
                        this.llPath = ll.getArtifact().getPath()
                    }
                }
            }
        }
    }

    /**
     * Resolve an array of all enabled mods. These mods will be constructed into
     * a mod list format and enabled at launch.
     * 
     * @param {Object} modCfg The mod configuration object.
     * @param {Array.<Object>} mdls An array of modules to parse.
     * @returns {{fMods: Array.<Object>, lMods: Array.<Object>}} An object which contains
     * a list of enabled forge mods and litemods.
     */
    resolveModConfiguration(modCfg, mdls){
        let fMods = []
        let lMods = []

        for(let mdl of mdls){
            const type = mdl.getType()
            if(type === DistroManager.Types.ForgeMod || type === DistroManager.Types.LiteMod || type === DistroManager.Types.LiteLoader){
                const o = !mdl.getRequired().isRequired()
                const e = ProcessBuilder.isModEnabled(modCfg[mdl.getVersionlessID()], mdl.getRequired())
                if(!o || (o && e)){
                    if(mdl.hasSubModules()){
                        const v = this.resolveModConfiguration(modCfg[mdl.getVersionlessID()].mods, mdl.getSubModules())
                        fMods = fMods.concat(v.fMods)
                        lMods = lMods.concat(v.lMods)
                        if(mdl.type === DistroManager.Types.LiteLoader){
                            continue
                        }
                    }
                    if(mdl.type === DistroManager.Types.ForgeMod){
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

    /**
     * Construct a mod list json object.
     * 
     * @param {'forge' | 'liteloader'} type The mod list type to construct.
     * @param {Array.<Object>} mods An array of mods to add to the mod list.
     * @param {boolean} save Optional. Whether or not we should save the mod list file.
     */
    constructModList(type, mods, save = false){
        const modList = {
            repositoryRoot: path.join(this.commonDir, 'modstore')
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
            fs.writeFileSync(type === 'forge' ? this.fmlDir : this.llDir, json, 'UTF-8')
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
    constructJVMArguments(mods, tempNativePath){

        let args = ['-Xmx' + ConfigManager.getMaxRAM(),
            '-Xms' + ConfigManager.getMinRAM(),
            '-Djava.library.path=' + tempNativePath,
            '-cp',
            this.classpathArg(mods, tempNativePath).join(process.platform === 'win32' ? ';' : ':'),
            this.forgeData.mainClass]

        if(process.platform === 'darwin'){
            args.unshift('-Xdock:name=WesterosCraft')
            args.unshift('-Xdock:icon=' + path.join(__dirname, '..', 'images', 'minecraft.icns'))
        }

        args.splice(2, 0, ...ConfigManager.getJVMOptions())

        args = args.concat(this._resolveForgeArgs())

        return args
    }

    /**
     * Resolve the arguments required by forge.
     * 
     * @returns {Array.<string>} An array containing the arguments required by forge.
     */
    _resolveForgeArgs(){
        const mcArgs = this.forgeData.minecraftArguments.split(' ')
        const argDiscovery = /\${*(.*)}/

        // Replace the declared variables with their proper values.
        for(let i=0; i<mcArgs.length; ++i){
            if(argDiscovery.test(mcArgs[i])){
                const identifier = mcArgs[i].match(argDiscovery)[1]
                let val = null
                switch(identifier){
                    case 'auth_player_name':
                        val = this.authUser.displayName.trim()
                        break
                    case 'version_name':
                        //val = versionData.id
                        val = this.server.getID()
                        break
                    case 'game_directory':
                        val = this.gameDir
                        break
                    case 'assets_root':
                        val = path.join(this.commonDir, 'assets')
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
                        val = 'MOJANG'
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
        mcArgs.push('--modListFile')
        mcArgs.push('absolute:' + this.fmlDir)

        if(this.usingLiteLoader){
            mcArgs.push('--modRepo')
            mcArgs.push(this.llDir)

            mcArgs.unshift('com.mumfrey.liteloader.launch.LiteLoaderTweaker')
            mcArgs.unshift('--tweakClass')
        }

        // Prepare game resolution
        if(ConfigManager.getFullscreen()){
            mcArgs.unshift('--fullscreen')
        } else {
            mcArgs.unshift(ConfigManager.getGameWidth())
            mcArgs.unshift('--width')
            mcArgs.unshift(ConfigManager.getGameHeight())
            mcArgs.unshift('--height')
        }

        // Prepare autoconnect
        if(ConfigManager.getAutoConnect() && this.server.isAutoConnect()){
            const serverURL = new URL('my://' + this.server.getAddress())
            mcArgs.unshift(serverURL.hostname)
            mcArgs.unshift('--server')
            if(serverURL.port){
                mcArgs.unshift(serverURL.port)
                mcArgs.unshift('--port')
            }
        }

        return mcArgs
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
    classpathArg(mods, tempNativePath){
        let cpArgs = []

        // Add the version.jar to the classpath.
        const version = this.versionData.id
        cpArgs.push(path.join(this.commonDir, 'versions', version, version + '.jar'))

        if(this.usingLiteLoader){
            cpArgs.push(this.llPath)
        }

        // Resolve the Mojang declared libraries.
        const mojangLibs = this._resolveMojangLibraries(tempNativePath)
        cpArgs = cpArgs.concat(mojangLibs)

        // Resolve the server declared libraries.
        const servLibs = this._resolveServerLibraries(mods)
        cpArgs = cpArgs.concat(servLibs)

        return cpArgs
    }

    /**
     * Resolve the libraries defined by Mojang's version data. This method will also extract
     * native libraries and point to the correct location for its classpath.
     * 
     * TODO - clean up function
     * 
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {Array.<string>} An array containing the paths of each library mojang declares.
     */
    _resolveMojangLibraries(tempNativePath){
        const libs = []

        const libArr = this.versionData.libraries
        fs.ensureDirSync(tempNativePath)
        for(let i=0; i<libArr.length; i++){
            const lib = libArr[i]
            if(Library.validateRules(lib.rules)){
                if(lib.natives == null){
                    const dlInfo = lib.downloads
                    const artifact = dlInfo.artifact
                    const to = path.join(this.libPath, artifact.path)
                    libs.push(to)
                } else {
                    // Extract the native library.
                    const extractInst = lib.extract
                    const exclusionArr = extractInst.exclude
                    const artifact = lib.downloads.classifiers[lib.natives[Library.mojangFriendlyOS()].replace('${arch}', process.arch.replace('x', ''))]
    
                    // Location of native zip.
                    const to = path.join(this.libPath, artifact.path)
    
                    let zip = new AdmZip(to)
                    let zipEntries = zip.getEntries()
    
                    // Unzip the native zip.
                    for(let i=0; i<zipEntries.length; i++){
                        const fileName = zipEntries[i].entryName
    
                        let shouldExclude = false

                        // Exclude noted files.
                        exclusionArr.forEach(function(exclusion){
                            if(fileName.indexOf(exclusion) > -1){
                                shouldExclude = true
                            }
                        })

                        // Extract the file.
                        if(!shouldExclude){
                            fs.writeFile(path.join(tempNativePath, fileName), zipEntries[i].getData(), (err) => {
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
     * @param {Array.<Object>} mods An array of enabled mods which will be launched with this process.
     * @returns {Array.<string>} An array containing the paths of each library this server requires.
     */
    _resolveServerLibraries(mods){
        const mdls = this.server.getModules()
        let libs = []

        // Locate Forge/Libraries
        for(let mdl of mdls){
            const type = mdl.getType()
            if(type === DistroManager.Types.ForgeHosted || type === DistroManager.Types.Library){
                libs.push(mdl.getArtifact().getPath())
                if(mdl.hasSubModules()){
                    const res = this._resolveModuleLibraries(mdl)
                    if(res.length > 0){
                        libs = libs.concat(res)
                    }
                }
            }
        }

        //Check for any libraries in our mod list.
        for(let i=0; i<mods.length; i++){
            if(mods.sub_modules != null){
                const res = this._resolveModuleLibraries(mods[i])
                if(res.length > 0){
                    libs = libs.concat(res)
                }
            }
        }

        return libs
    }

    /**
     * Recursively resolve the path of each library required by this module.
     * 
     * @param {Object} mdl A module object from the server distro index.
     * @returns {Array.<string>} An array containing the paths of each library this module requires.
     */
    _resolveModuleLibraries(mdl){
        if(!mdl.hasSubModules()){
            return []
        }
        let libs = []
        for(let sm of mdl.getSubModules()){
            if(sm.getType() === DistroManager.Types.Library){
                libs.push(sm.getArtifact().getPath())
            }
            // If this module has submodules, we need to resolve the libraries for those.
            // To avoid unnecessary recursive calls, base case is checked here.
            if(mdl.hasSubModules()){
                const res = this._resolveModuleLibraries(sm)
                if(res.length > 0){
                    libs = libs.concat(res)
                }
            }
        }
        return libs
    }
}

module.exports = ProcessBuilder