const AdmZip = require('adm-zip')
const child_process = require('child_process')
const crypto = require('crypto')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const { URL } = require('url')

const { Library } = require('./assetguard')
const ConfigManager = require('./configmanager')
const DistroManager = require('./distromanager')
const LoggerUtil = require('./loggerutil')

const logger = LoggerUtil('%c[ProcessBuilder]', 'color: #003996; font-weight: bold')

class ProcessBuilder {

    constructor(distroServer, versionData, authUser, launcherVersion) {
        this.gameDir = path.join(ConfigManager.getInstanceDirectory(), distroServer.getID())
        this.commonDir = ConfigManager.getCommonDirectory()
        this.server = distroServer
        this.versionData = versionData
        this.authUser = authUser
        this.launcherVersion = launcherVersion
        this.libPath = path.join(this.commonDir, 'libraries')

    }



    /**
     * Convienence method to run the functions typically used to build a process.
     */
    build() {
        fs.ensureDirSync(this.gameDir)
        const tempNativePath = path.join(os.tmpdir(), ConfigManager.getTempNativeFolder(), crypto.pseudoRandomBytes(16).toString('hex'))
        process.throwDeprecation = true
        this.setupLiteLoader()
        logger.log('Using liteloader:', this.usingLiteLoader)



        let args = this.constructJVMArguments(tempNativePath)


        logger.log('Launch Arguments:', args)
        let exists = false
        for (let i = 0; i < args.length; i++) {
            if (args[i] == '--tweakClass') {
                args[i + 1] = 'optifine.OptiFineTweaker'
                exists = true
            }
        }
        if (!exists) {
            args.push('--tweakClass')
            args.push('optifine.OptiFineTweaker')
        }

        const child = child_process.spawn(ConfigManager.getJavaExecutable(), args, {
            cwd: this.gameDir,
            detached: ConfigManager.getLaunchDetached()
        })

        if (ConfigManager.getLaunchDetached()) {
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
                if (err) {
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
    static isModEnabled(modCfg, required = null) {
        return modCfg != null ? ((typeof modCfg === 'boolean' && modCfg) || (typeof modCfg === 'object' && (typeof modCfg.value !== 'undefined' ? modCfg.value : true))) : required != null ? required.isDefault() : true
    }

    /**
     * Function which performs a preliminary scan of the top level
     * mods. If liteloader is present here, we setup the special liteloader
     * launch options. Note that liteloader is only allowed as a top level
     * mod. It must not be declared as a submodule.
     */
    setupLiteLoader() {
        for (let ll of this.server.getModules()) {
            if (ll.getType() === DistroManager.Types.LiteLoader) {
                if (!ll.getRequired().isRequired()) {
                    const modCfg = ConfigManager.getModConfiguration(this.server.getID()).mods
                    if (ProcessBuilder.isModEnabled(modCfg[ll.getVersionlessID()], ll.getRequired())) {
                        if (fs.existsSync(ll.getArtifact().getPath())) {
                            this.usingLiteLoader = true
                            this.llPath = ll.getArtifact().getPath()
                        }
                    }
                } else {
                    if (fs.existsSync(ll.getArtifact().getPath())) {
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




    /**
     * Construct a mod list json object.
     * 
     * @param {'forge' | 'liteloader'} type The mod list type to construct.
     * @param {Array.<Object>} mods An array of mods to add to the mod list.
     * @param {boolean} save Optional. Whether or not we should save the mod list file.
     */


    _processAutoConnectArg(args) {
        if (ConfigManager.getAutoConnect() && this.server.isAutoConnect()) {
            const serverURL = new URL('my://' + this.server.getAddress())
            args.push('--server')
            args.push(serverURL.hostname)
            if (serverURL.port) {
                args.push('--port')
                args.push(serverURL.port)
            }
        }
    }

    /**
     * Construct the argument array that will be passed to the JVM process.
     * 
     * @param {Array.<Object>} mods An array of enabled mods which will be launched with this process.
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {Array.<string>} An array containing the full JVM arguments for this process.
     */
    constructJVMArguments(tempNativePath) {

        return this._constructJVMArguments113(tempNativePath)

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
    _constructJVMArguments113(tempNativePath) {

        const argDiscovery = /\${*(.*)}/

        // JVM Arguments First
        let args = this.versionData.arguments.jvm

        //args.push('-Dlog4j.configurationFile=D:\\WesterosCraft\\game\\common\\assets\\log_configs\\client-1.12.xml')

        // Java Arguments
        if (process.platform === 'darwin') {
            args.push('-Xdock:name=NexusLauncher')
            args.push('-Xdock:icon=' + path.join(__dirname, '..', 'images', 'minecraft.icns'))
        }
        args.push('-Xmx' + ConfigManager.getMaxRAM())
        args.push('-Xms' + ConfigManager.getMinRAM())
        args = args.concat(ConfigManager.getJVMOptions())

        // Main Java Class
        args.push('net.minecraft.launchwrapper.Launch')

        // Vanilla Arguments
        args = args.concat(this.versionData.arguments.game)

        for (let i = 0; i < args.length; i++) {
            if (typeof args[i] === 'object' && args[i].rules != null) {

                let checksum = 0
                for (let rule of args[i].rules) {
                    if (rule.os != null) {
                        if (rule.os.name === Library.mojangFriendlyOS()
                            && (rule.os.version == null || new RegExp(rule.os.version).test(os.release))) {
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
                        if (rule.features.has_custom_resolution != null && rule.features.has_custom_resolution === true) {
                            if (ConfigManager.getFullscreen()) {
                                args[i].value = [
                                    '--fullscreen',
                                    'true'
                                ]
                            }
                            checksum++
                        }
                    }
                }

                // TODO splice not push
                if (checksum === args[i].rules.length) {
                    if (typeof args[i].value === 'string') {
                        args[i] = args[i].value
                    } else if (typeof args[i].value === 'object') {
                        //args = args.concat(args[i].value)
                        args.splice(i, 1, ...args[i].value)
                    }

                    // Decrement i to reprocess the resolved value
                    i--
                } else {
                    args[i] = null
                }

            } else if (typeof args[i] === 'string') {
                if (argDiscovery.test(args[i])) {
                    const identifier = args[i].match(argDiscovery)[1]
                    let val = null
                    switch (identifier) {
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
                            val = args[i].replace(argDiscovery, tempNativePath)
                            break
                        case 'launcher_name':
                            val = args[i].replace(argDiscovery, 'Helios-Launcher')
                            break
                        case 'launcher_version':
                            val = args[i].replace(argDiscovery, this.launcherVersion)
                            break
                        case 'classpath':
                            val = this.classpathArg(tempNativePath).join(process.platform === 'win32' ? ';' : ':')
                            break
                    }
                    if (val != null) {
                        args[i] = val
                    }
                }
            }
        }



        // Filter null values
        args = args.filter(arg => {
            return arg != null
        })

        return args
    }

    /**
     * Resolve the arguments required by forge.
     * 
     * @returns {Array.<string>} An array containing the arguments required by forge.
     */


    /**
     * Ensure that the classpath entries all point to jar files.
     * 
     * @param {Array.<String>} list Array of classpath entries.
     */
    _processClassPathList(list) {

        const ext = '.jar'
        const extLen = ext.length
        for (let i = 0; i < list.length; i++) {
            const extIndex = list[i].indexOf(ext)
            if (extIndex > -1 && extIndex !== list[i].length - extLen) {
                list[i] = list[i].substring(0, extIndex + extLen)
            }
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
    classpathArg(tempNativePath) {
        let cpArgs = []

        // Add the version.jar to the classpath.
        const version = this.versionData.id
        // cpArgs.push(path.join(this.commonDir, 'versions', version, version + '.jar'))

        // Resolve the Mojang declared libraries.
        const mojangLibs = this._resolveMojangLibraries(tempNativePath, version)
        const optifineLibs = this._resolveOptifineLibs(this.server)


        // Resolve the server declared libraries.


        // Merge libraries, server libs with the same
        // maven identifier will override the mojang ones.
        // Ex. 1.7.10 forge overrides mojang's guava with newer version.

        cpArgs = cpArgs.concat(Object.values(optifineLibs), Object.values(mojangLibs))
        cpArgs.push(path.join(this.commonDir, 'versions', version, version + '.jar'))


        this._processClassPathList(cpArgs)

        return cpArgs
    }
    _resolveOptifineLibs(server) {
        let paths = []

        // console.log(this.commonDir, 'libraries', 'optifine', 'Optifine', server.getOptifineVersion(), 'Optifine-' + server.getOptifineVersion() + '.jar')
        // console.log(this.commonDir, 'libraries', 'optifine', 'launchwrapper-of', server.getLaunchWrapperVersion(), 'laucnhwrapper-of-' + server.getLaunchWrapperVersion() + '.jar')
        paths.push(path.join(this.commonDir, 'libraries/optifine/launchwrapper-of/' + server.getLaunchWrapperVersion() +  '/launchwrapper-of-' + server.getLaunchWrapperVersion() + '.jar'))
        paths.push(path.join(this.commonDir, 'libraries/optifine/Optifine/' + server.getOptifineVersion() + '/Optifine-' + server.getOptifineVersion() + '.jar'))
        return paths
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
    _resolveMojangLibraries(tempNativePath, version) {
        const libs = {}
        // path.join(this.commonDir, 'versions', version, version + '.jar')libs.push(path.join(this.commonDir, 'versions', version, version + '.jar'))
        const libArr = this.versionData.libraries
        fs.ensureDirSync(tempNativePath)
        for (let i = 0; i < libArr.length; i++) {
            const lib = libArr[i]
            if (Library.validateRules(lib.rules, lib.natives)) {
                if (lib.natives == null) {
                    const dlInfo = lib.downloads
                    const artifact = dlInfo.artifact
                    const to = path.join(this.libPath, artifact.path)
                    const versionIndependentId = lib.name.substring(0, lib.name.lastIndexOf(':'))
                    libs[versionIndependentId] = to
                } else {
                    // Extract the native library.
                    const exclusionArr = lib.extract != null ? lib.extract.exclude : ['META-INF/']
                    const artifact = lib.downloads.classifiers[lib.natives[Library.mojangFriendlyOS()].replace('${arch}', process.arch.replace('x', ''))]

                    // Location of native zip.
                    const to = path.join(this.libPath, artifact.path)

                    let zip = new AdmZip(to)
                    let zipEntries = zip.getEntries()

                    // Unzip the native zip.
                    for (let i = 0; i < zipEntries.length; i++) {
                        const fileName = zipEntries[i].entryName

                        let shouldExclude = false

                        // Exclude noted files.
                        exclusionArr.forEach(function (exclusion) {
                            if (fileName.indexOf(exclusion) > -1) {
                                shouldExclude = true
                            }
                        })

                        // Extract the file.
                        if (!shouldExclude) {
                            fs.writeFile(path.join(tempNativePath, fileName), zipEntries[i].getData(), (err) => {
                                if (err) {
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
     * @returns {{[id: string]: string}} An object containing the paths of each library this server requires.
     */

    /**
     * Recursively resolve the path of each library required by this module.
     * 
     * @param {Object} mdl A module object from the server distro index.
     * @returns {Array.<string>} An array containing the paths of each library this module requires.
     */
    _resolveModuleLibraries(mdl) {
        if (!mdl.hasSubModules()) {
            return []
        }
        let libs = []
        for (let sm of mdl.getSubModules()) {
            if (sm.getType() === DistroManager.Types.Library) {
                libs.push(sm.getArtifact().getPath())
            }
            // If this module has submodules, we need to resolve the libraries for those.
            // To avoid unnecessary recursive calls, base case is checked here.
            if (mdl.hasSubModules()) {
                const res = this._resolveModuleLibraries(sm)
                if (res.length > 0) {
                    libs = libs.concat(res)
                }
            }
        }
        return libs
    }

}

module.exports = ProcessBuilder