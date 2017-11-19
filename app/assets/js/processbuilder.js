/**
 * The initial iteration of this file will not support optional submodules.
 * Support will be added down the line, only top-level modules will recieve optional support.
 * 
 * 
 * TODO why are logs not working??????
 */
const AdmZip = require('adm-zip')
const ag = require('./assetguard.js')
const child_process = require('child_process')
const fs = require('fs')
const mkpath = require('mkdirp')
const path = require('path')

class ProcessBuilder {

    constructor(gameDirectory, distroServer, versionData, forgeData, authUser){
        this.dir = gameDirectory
        this.server = distroServer
        this.versionData = versionData
        this.forgeData = forgeData
        this.authUser = authUser
        this.fmlDir = path.join(this.dir, 'versions', this.server.id + '.json')
        this.libPath = path.join(this.dir, 'libraries')
    }

    static shouldInclude(mdle){
        //If the module should be included by default
        return mdle.required == null || mdle.required.value == null || mdle.required.value === true || (mdle.required.value === false && (mdle.required.def == null || mdle.required.def === true))
    }
    
    /**
     * Convienence method to run the functions typically used to build a process.
     */
    build(){
        const mods = this.resolveDefaultMods()
        this.constructFMLModList(mods, true)
        const args = this.constructJVMArguments(mods)

        //console.log(args)

        const child = child_process.spawn('C:\\Program Files\\Java\\jdk1.8.0_152\\bin\\javaw.exe', args)

        child.stdout.on('data', (data) => {
            console.log('Minecraft:', data.toString('utf8'))
        })
        child.stderr.on('data', (data) => {
            console.log('Minecraft:', data.toString('utf8'))
        })
        child.on('close', (code, signal) => {
            console.log('Exited with code', code)
        })

        return child
    }

    resolveDefaultMods(options = {type: 'forgemod'}){
        //Returns array of default forge mods to load.
        const mods = []
        const mdles = this.server.modules
    
        for(let i=0; i<mdles.length; ++i){
            if(mdles[i].type != null && mdles[i].type === options.type){
                if(ProcessBuilder.shouldInclude(mdles[i])){
                    mods.push(mdles[i])
                }
            }
        }

        return mods
    }

    constructFMLModList(mods, save = false){
        const modList = {}
        modList.repositoryRoot = path.join(this.dir, 'modstore')
        const ids = []
        for(let i=0; i<mods.length; ++i){
            ids.push(mods[i].id)
        }
        modList.modRef = ids
        
        if(save){
            const json = JSON.stringify(modList, null, 4)
            fs.writeFileSync(this.fmlDir, json, 'UTF-8')
        }

        return modList
    }

    /**
     * Construct the argument array that will be passed to the JVM process.
     * 
     * @param {Array.<Object>} mods - An array of enabled mods which will be launched with this process.
     * @returns {Array.<String>} - An array containing the full JVM arguments for this process.
     */
    constructJVMArguments(mods){
        
        let args = ['-Xmx4G',
        '-XX:+UseConcMarkSweepGC',
        '-XX:+CMSIncrementalMode',
        '-XX:-UseAdaptiveSizePolicy',
        '-Xmn128M',
        '-Djava.library.path=' + path.join(this.dir, 'natives'),
        '-cp',
        this.classpathArg(mods).join(';'),
        this.forgeData.mainClass]

        args = args.concat(this._resolveForgeArgs())

        return args
    }

    /**
     * Resolve the arguments required by forge.
     * 
     * @returns {Array.<String>} - An array containing the arguments required by forge.
     */
    _resolveForgeArgs(){
        const mcArgs = this.forgeData.minecraftArguments.split(' ')
        const argDiscovery = /\${*(.*)}/

        // Replace the declared variables with their proper values.
        for(let i=0; i<mcArgs.length; ++i){
            if(argDiscovery.test(mcArgs[i])){
                const identifier = mcArgs[i].match(argDiscovery)[1]
                let val = null;
                switch(identifier){
                    case 'auth_player_name':
                        val = this.authUser.selectedProfile.name
                        break
                    case 'version_name':
                        //val = versionData.id
                        val = this.server.id
                        break
                    case 'game_directory':
                        val = this.dir
                        break
                    case 'assets_root':
                        val = path.join(this.dir, 'assets')
                        break
                    case 'assets_index_name':
                        val = this.versionData.assets
                        break
                    case 'auth_uuid':
                        val = this.authUser.selectedProfile.id
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
                    mcArgs[i] = val;
                }
            }
        }
        mcArgs.push('--modListFile')
        mcArgs.push('absolute:' + this.fmlDir)
        return mcArgs
    }

    /**
     * Resolve the full classpath argument list for this process. This method will resolve all Mojang-declared
     * libraries as well as the libraries declared by the server. Since mods are permitted to declare libraries,
     * this method requires all enabled mods as an input
     * 
     * @param {Array.<Object>} mods - An array of enabled mods which will be launched with this process.
     * @returns {Array.<String>} - An array containing the paths of each library required by this process.
     */
    classpathArg(mods){
        let cpArgs = []

        // Add the version.jar to the classpath.
        const version = this.versionData.id
        cpArgs.push(path.join(this.dir, 'versions', version, version + '.jar'))

        // Resolve the Mojang declared libraries.
        const mojangLibs = this._resolveMojangLibraries()
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
     * @returns {Array.<String>} - An array containing the paths of each library mojang declares.
     */
    _resolveMojangLibraries(){
        const libs = []

        const libArr = this.versionData.libraries
        const nativePath = path.join(this.dir, 'natives')
        for(let i=0; i<libArr.length; i++){
            const lib = libArr[i]
            if(ag.Library.validateRules(lib.rules)){
                if(lib.natives == null){
                    const dlInfo = lib.downloads
                    const artifact = dlInfo.artifact
                    const to = path.join(this.libPath, artifact.path)
                    libs.push(to)
                } else {
                    // Extract the native library.
                    const natives = lib.natives
                    const extractInst = lib.extract
                    const exclusionArr = extractInst.exclude
                    const opSys = ag.Library.mojangFriendlyOS()
                    const indexId = natives[opSys]
                    const dlInfo = lib.downloads
                    const classifiers = dlInfo.classifiers
                    const artifact = classifiers[indexId]
    
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
                            if(exclusion.indexOf(fileName) > -1){
                                shouldExclude = true
                            }
                        })

                        // Extract the file.
                        if(!shouldExclude){
                            mkpath.sync(path.join(nativePath, fileName, '..'))
                            fs.writeFile(path.join(nativePath, fileName), zipEntries[i].getData())
                        }
    
                    }
    
                    libs.push(to)
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
     * @param {Array.<Object>} mods - An array of enabled mods which will be launched with this process.
     * @returns {Array.<String>} - An array containing the paths of each library this server requires.
     */
    _resolveServerLibraries(mods){
        const mdles = this.server.modules
        let libs = []

        // Locate Forge Libraries
        for(let i=0; i<mdles.length; i++){
            if(mdles[i].type != null && mdles[i].type === 'forge-hosted'){
                let forge = mdles[i]
                libs.push(path.join(this.libPath, forge.artifact.path == null ? ag._resolvePath(forge.id, forge.artifact.extension) : forge.artifact.path))
                const res = this._resolveModuleLibraries(forge)
                if(res.length > 0){
                    libs = libs.concat(res)
                }
                break
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
     * @param {Object} mdle - A module object from the server distro index.
     * @returns {Array.<String>} - An array containing the paths of each library this module requires.
     */
    _resolveModuleLibraries(mdle){
        if(mdle.sub_modules == null){
            return []
        }
        let libs = []
        for(let i=0; i<mdle.sub_modules.length; i++){
            const sm = mdle.sub_modules[i]
            if(sm.type != null && sm.type == 'library'){
                libs.push(path.join(this.libPath, sm.artifact.path == null ? ag._resolvePath(sm.id, sm.artifact.extension) : sm.artifact.path))
            }
            // If this module has submodules, we need to resolve the libraries for those.
            // To avoid unnecessary recursive calls, base case is checked here.
            if(mdle.sub_modules != null){
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