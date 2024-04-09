const AdmZip                = require('adm-zip')
const child_process         = require('child_process')
const crypto                = require('crypto')
const fs                    = require('fs-extra')
const { LoggerUtil }        = require('limbo-core')
const { getMojangOS, isLibraryCompatible, mcVersionAtLeast }  = require('limbo-core/common')
const { Type }              = require('helios-distribution-types')
const os                    = require('os')
const path                  = require('path')

const ConfigManager            = require('./configmanager')


const logger = LoggerUtil.getLogger('ProcessBuilder')


/**
 * Only forge and fabric are top level mod loaders.
 * 
 * Forge 1.13+ launch logic is similar to fabrics, for now using usingFabricLoader flag to
 * change minor details when needed.
 * 
 * Rewrite of this module may be needed in the future.
 */
class ProcessBuilder {

    constructor(distroServer, vanillaManifest, modManifest, authUser, launcherVersion){
        this.gameDir = path.join(ConfigManager.getInstanceDirectory(), distroServer.rawServer.id)
        this.commonDir = ConfigManager.getCommonDirectory()
        this.server = distroServer
        this.vanillaManifest = vanillaManifest
        this.modManifest = modManifest
        this.authUser = authUser
        this.launcherVersion = launcherVersion
        this.forgeModListFile = path.join(this.gameDir, 'forgeMods.list') // 1.13+
        this.fmlDir = path.join(this.gameDir, 'forgeModList.json')
        this.llDir = path.join(this.gameDir, 'liteloaderModList.json')
        this.libPath = path.join(this.commonDir, 'libraries')

        this.usingLiteLoader = false
        this.usingFabricLoader = false
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
        logger.info('Using liteloader:', this.usingLiteLoader)
        this.usingFabricLoader = this.server.modules.some(mdl => mdl.rawModule.type === Type.Fabric)
        logger.info('Using fabric loader:', this.usingFabricLoader)
        const modObj = this.resolveModConfiguration(ConfigManager.getModConfiguration(this.server.rawServer.id).mods, this.server.modules)
        
        // Mod list below 1.13
        // Fabric only supports 1.14+
        if(!mcVersionAtLeast('1.13', this.server.rawServer.minecraftVersion)){
            this.constructJSONModList('forge', modObj.fMods, true)
            if(this.usingLiteLoader){
                this.constructJSONModList('liteloader', modObj.lMods, true)
            }
        }
        
        const uberModArr = modObj.fMods.concat(modObj.lMods)
        let args = this.constructJVMArguments(uberModArr, tempNativePath)

        if(mcVersionAtLeast('1.13', this.server.rawServer.minecraftVersion)){
            //args = args.concat(this.constructModArguments(modObj.fMods))
            args = args.concat(this.constructModList(modObj.fMods))
        }

        logger.info('Launch Arguments:', args)

        const child = child_process.spawn(ConfigManager.getJavaExecutable(this.server.rawServer.id), args, {
            cwd: this.gameDir,
            detached: ConfigManager.getLaunchDetached()
        })

        if(ConfigManager.getLaunchDetached()){
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
            fs.remove(tempNativePath, (err) => {
                if(err){
                    logger.warn('Error while deleting temp dir', err)
                } else {
                    logger.info('Temp dir deleted successfully.')
                }
            })
        })

        return child
    }

    /**
     * Get the platform specific classpath separator. On windows, this is a semicolon.
     * On Unix, this is a colon.
     * 
     * @returns {string} The classpath separator for the current operating system.
     */
    static getClasspathSeparator() {
        return process.platform === 'win32' ? ';' : ':'
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
        return modCfg != null ? ((typeof modCfg === 'boolean' && modCfg) || (typeof modCfg === 'object' && (typeof modCfg.value !== 'undefined' ? modCfg.value : true))) : required != null ? required.def : true
    }

    /**
     * Function which performs a preliminary scan of the top level
     * mods. If liteloader is present here, we setup the special liteloader
     * launch options. Note that liteloader is only allowed as a top level
     * mod. It must not be declared as a submodule.
     */
    setupLiteLoader(){
        for(let ll of this.server.modules){
            if(ll.rawModule.type === Type.LiteLoader){
                if(!ll.getRequired().value){
                    const modCfg = ConfigManager.getModConfiguration(this.server.rawServer.id).mods
                    if(ProcessBuilder.isModEnabled(modCfg[ll.getVersionlessMavenIdentifier()], ll.getRequired())){
                        if(fs.existsSync(ll.getPath())){
                            this.usingLiteLoader = true
                            this.llPath = ll.getPath()
                        }
                    }
                } else {
                    if(fs.existsSync(ll.getPath())){
                        this.usingLiteLoader = true
                        this.llPath = ll.getPath()
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
            const type = mdl.rawModule.type
            if(type === Type.ForgeMod || type === Type.LiteMod || type === Type.LiteLoader || type === Type.FabricMod){
                const o = !mdl.getRequired().value
                const e = ProcessBuilder.isModEnabled(modCfg[mdl.getVersionlessMavenIdentifier()], mdl.getRequired())
                if(!o || (o && e)){
                    if(mdl.subModules.length > 0){
                        const v = this.resolveModConfiguration(modCfg[mdl.getVersionlessMavenIdentifier()].mods, mdl.subModules)
                        fMods = fMods.concat(v.fMods)
                        lMods = lMods.concat(v.lMods)
                        if(type === Type.LiteLoader){
                            continue
                        }
                    }
                    if(type === Type.ForgeMod || type === Type.FabricMod){
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

    _lteMinorVersion(version) {
        return Number(this.modManifest.id.split('-')[0].split('.')[1]) <= Number(version)
    }

    /**
     * Test to see if this version of forge requires the absolute: prefix
     * on the modListFile repository field.
     */
    _requiresAbsolute(){
        try {
            if(this._lteMinorVersion(9)) {
                return false
            }
            const ver = this.modManifest.id.split('-')[2]
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
     * @param {Array.<Object>} mods An array of mods to add to the mod list.
     * @param {boolean} save Optional. Whether or not we should save the mod list file.
     */
    constructJSONModList(type, mods, save = false){
        const modList = {
            repositoryRoot: ((type === 'forge' && this._requiresAbsolute()) ? 'absolute:' : '') + path.join(this.commonDir, 'modstore')
        }

        const ids = []
        if(type === 'forge'){
            for(let mod of mods){
                ids.push(mod.getExtensionlessMavenIdentifier())
            }
        } else {
            for(let mod of mods){
                ids.push(mod.getMavenIdentifier())
            }
        }
        modList.modRef = ids
        
        if(save){
            const json = JSON.stringify(modList, null, 4)
            fs.writeFileSync(type === 'forge' ? this.fmlDir : this.llDir, json, 'UTF-8')
        }

        return modList
    }

    // /**
    //  * Construct the mod argument list for forge 1.13
    //  * 
    //  * @param {Array.<Object>} mods An array of mods to add to the mod list.
    //  */
    // constructModArguments(mods){
    //     const argStr = mods.map(mod => {
    //         return mod.getExtensionlessMavenIdentifier()
    //     }).join(',')

    //     if(argStr){
    //         return [
    //             '--fml.mavenRoots',
    //             path.join('..', '..', 'common', 'modstore'),
    //             '--fml.mods',
    //             argStr
    //         ]
    //     } else {
    //         return []
    //     }
        
    // }

    /**
     * Construct the mod argument list for forge 1.13 and Fabric
     * 
     * @param {Array.<Object>} mods An array of mods to add to the mod list.
     */
    constructModList(mods) {
        const writeBuffer = mods.map(mod => {
            return this.usingFabricLoader ? mod.getPath() : mod.getExtensionlessMavenIdentifier()
        }).join('\n')

        if(writeBuffer) {
            fs.writeFileSync(this.forgeModListFile, writeBuffer, 'UTF-8')
            return this.usingFabricLoader ? [
                '--fabric.addMods',
                `@${this.forgeModListFile}`
            ] : [
                '--fml.mavenRoots',
                path.join('..', '..', 'common', 'modstore'),
                '--fml.modLists',
                this.forgeModListFile
            ]
        } else {
            return []
        }

    }

    _processAutoConnectArg(args){
        if(ConfigManager.getAutoConnect() && this.server.rawServer.autoconnect){
            if(mcVersionAtLeast('1.20', this.server.rawServer.minecraftVersion)){
                args.push('--quickPlayMultiplayer')
                args.push(`${this.server.hostname}:${this.server.port}`)
            } else {
                args.push('--server')
                args.push(this.server.hostname)
                args.push('--port')
                args.push(this.server.port)
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
    constructJVMArguments(mods, tempNativePath){
        if(mcVersionAtLeast('1.13', this.server.rawServer.minecraftVersion)){
            return this._constructJVMArguments113(mods, tempNativePath)
        } else {
            return this._constructJVMArguments112(mods, tempNativePath)
        }
    }

    /**
     * Construct the argument array that will be passed to the JVM process.
     * This function is for 1.12 and below.
     * 
     * @param {Array.<Object>} mods An array of enabled mods which will be launched with this process.
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {Array.<string>} An array containing the full JVM arguments for this process.
     */
    _constructJVMArguments112(mods, tempNativePath){

        let args = []

        // Classpath Argument
        args.push('-cp')
        args.push(this.classpathArg(mods, tempNativePath).join(ProcessBuilder.getClasspathSeparator()))

        // Java Arguments
        if(process.platform === 'darwin'){
            args.push('-Xdock:name=LimboLauncher')
            args.push('-Xdock:icon=' + path.join(__dirname, '..', 'images', 'minecraft.icns'))
        }
        args.push('-Xmx' + ConfigManager.getMaxRAM(this.server.rawServer.id))
        args.push('-Xms' + ConfigManager.getMinRAM(this.server.rawServer.id))
        args = args.concat(ConfigManager.getJVMOptions(this.server.rawServer.id))
        args.push('-Djava.library.path=' + tempNativePath)
        args.push(`-javaagent:${path.join(process.cwd(), 'resources', 'libraries', 'java', 'LimboAuth.jar')}=https://auth.lsmp.site/authlib-injector`)
        args.push('-Dauthlibinjector.side=client')
        args.push('-Dauthlibinjector.yggdrasil.prefetched=eyJtZXRhIjp7ImltcGxlbWVudGF0aW9uTmFtZSI6IkRyYXNsIiwiaW1wbGVtZW50YXRpb25WZXJzaW9uIjoiMS4wLjEiLCJsaW5rcyI6eyJob21lcGFnZSI6Imh0dHBzOi8vYXV0aC5sc21wLnNpdGUiLCJyZWdpc3RlciI6Imh0dHBzOi8vYXV0aC5sc21wLnNpdGUvZHJhc2wvcmVnaXN0cmF0aW9uIn0sInNlcnZlck5hbWUiOiJMaW1ibyIsImZlYXR1cmUuZW5hYmxlX3Byb2ZpbGVfa2V5Ijp0cnVlfSwic2lnbmF0dXJlUHVibGlja2V5IjoiLS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS1cbk1JSUNJakFOQmdrcWhraUc5dzBCQVFFRkFBT0NBZzhBTUlJQ0NnS0NBZ0VBeEpjeUkySlZ2YnoydVEzWGtuTm1cbmkzR1FhMHFVUmxxV2FsdGgzNEcreTMyeUJSWlFiVUVuM05HV0hFOVcrdGs3OG95WGQ2bHduWngyMlJJeVJjRlNcbnhPeFhDcW1DUTJpWmFWZi9KVE4vNG1VWmJnaWk4RU9DeVptT3dwZmp5RTJQZXFkQ1BaaHlVdExLYS82djhxVnlcbmRNSGZhMzV4Uml3UGtQdkdaQ3FJcmhRaktLcGxLaWJ1MzRzR1hDNy9hQXlBMXpqRXZoeFoyRjJLS0gwbzc5c2Jcbk16cmtML1N0alZDbnlnMVhCQUJ2ZDdBUENlTkViaytOamlTY0JLNExBTmpSZ2tqV2RQZjZRZ0lSRWJNN05TbTBcbk8yZGI3VmlWYVI3Q1FhMTlUa1Z2MHRTR3hCY1EyYmZiWk9teWtKK2ZtMDdBdUp2ek5qekRmMDZPNEdCckZVOUhcbjFkaWN4Q0wrM2grZzZvL0JiNUk3LzBGaVdId2xrUDNsRzhhQVk5clFhcm5OakxsZENrakN5Rmw4Y24zNENnWDBcbnNhNnN3Mkh2YUdqaEd1bldsazQvUjU0UUw4YVVVcGsrVzh2YzFaV2JOL3VONVRRNWZ6NDQyWmF5QnlJNkxqUlZcbjRXMXhnaS9adVNsc0dKZlgrdEdkTXNyTmNpbVZUakpNQUlIMUEwM2kyTWl3dmJsbmI1ZzRLM0hoZWtOakRUZ05cbmxKUXlGR1BQZmN6dkNwSFdITk5NODlaWlBweVhOZmZBbjltV21VaXFOTjM2WHR1SkxyTTFnTnJ5K3hwMnJic3dcbnduNEthUlpTcGFpencvUzd3cnlLN0lvNXpXb1R6aVZoM0RJblovUXZrb1NPMThMVWdBekpheVNvdWd5UFRWRnhcblNQY1ZoOWVEcit4aVoydit2RlFLMFJNQ0F3RUFBUT09XG4tLS0tLUVORCBQVUJMSUMgS0VZLS0tLS1cbiIsInNpZ25hdHVyZVB1YmxpY2tleXMiOlsiLS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS1cbk1JSUNJakFOQmdrcWhraUc5dzBCQVFFRkFBT0NBZzhBTUlJQ0NnS0NBZ0VBeEpjeUkySlZ2YnoydVEzWGtuTm1cbmkzR1FhMHFVUmxxV2FsdGgzNEcreTMyeUJSWlFiVUVuM05HV0hFOVcrdGs3OG95WGQ2bHduWngyMlJJeVJjRlNcbnhPeFhDcW1DUTJpWmFWZi9KVE4vNG1VWmJnaWk4RU9DeVptT3dwZmp5RTJQZXFkQ1BaaHlVdExLYS82djhxVnlcbmRNSGZhMzV4Uml3UGtQdkdaQ3FJcmhRaktLcGxLaWJ1MzRzR1hDNy9hQXlBMXpqRXZoeFoyRjJLS0gwbzc5c2Jcbk16cmtML1N0alZDbnlnMVhCQUJ2ZDdBUENlTkViaytOamlTY0JLNExBTmpSZ2tqV2RQZjZRZ0lSRWJNN05TbTBcbk8yZGI3VmlWYVI3Q1FhMTlUa1Z2MHRTR3hCY1EyYmZiWk9teWtKK2ZtMDdBdUp2ek5qekRmMDZPNEdCckZVOUhcbjFkaWN4Q0wrM2grZzZvL0JiNUk3LzBGaVdId2xrUDNsRzhhQVk5clFhcm5OakxsZENrakN5Rmw4Y24zNENnWDBcbnNhNnN3Mkh2YUdqaEd1bldsazQvUjU0UUw4YVVVcGsrVzh2YzFaV2JOL3VONVRRNWZ6NDQyWmF5QnlJNkxqUlZcbjRXMXhnaS9adVNsc0dKZlgrdEdkTXNyTmNpbVZUakpNQUlIMUEwM2kyTWl3dmJsbmI1ZzRLM0hoZWtOakRUZ05cbmxKUXlGR1BQZmN6dkNwSFdITk5NODlaWlBweVhOZmZBbjltV21VaXFOTjM2WHR1SkxyTTFnTnJ5K3hwMnJic3dcbnduNEthUlpTcGFpencvUzd3cnlLN0lvNXpXb1R6aVZoM0RJblovUXZrb1NPMThMVWdBekpheVNvdWd5UFRWRnhcblNQY1ZoOWVEcit4aVoydit2RlFLMFJNQ0F3RUFBUT09XG4tLS0tLUVORCBQVUJMSUMgS0VZLS0tLS1cbiIsIi0tLS0tQkVHSU4gUFVCTElDIEtFWS0tLS0tXG5NSUlDSWpBTkJna3Foa2lHOXcwQkFRRUZBQU9DQWc4QU1JSUNDZ0tDQWdFQXlsQjRCNm01bHo3andyY0Z6NkZkXG4vZm5mVWhjdmx4c1RTbjVrSUsvMmFHRzFDM2tNeTRWamh3bHhGNkJGVVNuZnhoTnN3UGpoM1ppdGtCeEVBRlkyXG41dXprSkZSd0h3VkE5bWR3amFzaFhJTHRSNk9xZExYWEZWeVVQSVVSTE9TV3FHTkJ0YjA4RU41Zk1uRzhpRkxnXG5FSklCTXhzOUJ2RjNzMy9GaHVIeVBLaVZUWm1YWTBXWTRaeVlxdm9LUitYamFUUlBQdkJzRGE0V0kydTF6eFhNXG5lSGxvZFQzbG5DelZ2eU9ZQkxYTDZDSmdCeXVPeGNjSjhoblhmRjl5WTRGMGFlTDA4MEp6LzMrRUJORzhSTzRCXG55aHRCZjROeThOUTZzdFdzamZlVUl2SDdiVS80ekNZY1lPcTRXckluWEhxUzhxcnVEbUlsN1A1WFhHY2FidXpRXG5zdFBmL2gyQ1JBVXBQL1BsSFhjTWx2ZXdqbUdVNk1mREsrbGlmU2NOWXdqUHhSbzRuS1RHRlpmLzBhcUhDaC9FXG5Bc1F5TEtyT0lZUkUwbERHM2J6Qmg4b2dJTUxBdWdzQWZCYjZNM21xQ3FLYVRNQWYvVkFqaDVGRkpualMrN2JFXG4rYlpFVjBxd2F4MUNFb1BQSkwxZklRak9TOHpqMDg2Z2pwR1JDdFN5OStiVFBUZlRSL1NKK1ZVQjVHMkllQ0l0XG5rTkhwSlgyeWdvakZaOW41Rm5qN1I5Wm5PTStMOG55SWpQdTNhZVB2dGNyWGx5TGhIL2h2T2ZJT2pQeE9scVcrXG5PNVF3U0ZQNE9FY3lMQVVnRGRVZ3lXMzZaNW1CMjg1dUtXL2lnaHpac09UZXZWVUcyUXdESXRPYklWNmk4UkN4XG5GYk4yb0RIeVBhTzVqMXRUYUJOeVZ0OENBd0VBQVE9PVxuLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tXG4iLCItLS0tLUJFR0lOIFBVQkxJQyBLRVktLS0tLVxuTUlJQ0lqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FnOEFNSUlDQ2dLQ0FnRUFyYTRZMnd1M3JXRVc3Y0RURFJSZFxuNEl2VUQxNDBZMTJTYUczazRWM1V3VC9wRG5uWDVpdE9jWWlaQTBxZjRWQ3BKRHAyUGlmT0wrUHIvcGgvRzkvNlxuWm9JeGtCZUdFTm8rUzdpOUJxaXpKeTljbVpvY3B5eCtSa1phdzkrZnJDR05MdVlMcnh6aU5XaVhGQUNKU2cybVxuSEFDUjcrNk5rR044ZC8xNi8zUHhNbnZHU3lMVDdKS0dVZ3FqMVEzb1c3aytOTFhSOXN3Nm9SRUxPY25VdlpWYVxuMmJjZ2x2OHZsY3lQcXFuQmh5ZExmSEk4NVo1V25JWVp2aVozQmI0ZHY1Rm1lNzI2QkdPdEVZN2t6NDBSZml3alxuVDN4WUtZS1BKVVMzL2NyUFg2ZXVnbVd5cldkZGRLYWVQclc4OGJwMTdaNU5JU3RsSjVLSkprNGNvaGE4TytQN1xub25EcW1iSHdMcVBUZVI1MW5qa2daK0RKV1Q2Zno4a3U5T1dRbjZJL0Z4cU4xNGlZSWdoREppam1LdkV3c0k3RlxuSjVYMnR0UFhFdkJZTG1wajJqMGxRUWNVSXFIN2hraVorbUNXMEdZYXdKZ2JBZU5BcmFNOXNQKzc2TXlBR0lUdFxuQXNYdjFJUW1haCs3T2VESk9Ub0cyS2IxRGwwVmErSGlQOU1QcGNuTzdrYm42ZHFBeWhOdlJObUhuc1VPaUVjTFxuaFc5Ums3eHo4N0lCVi9jR0tiVURneHU4Y1lZMFA1MTJEV3Q1K0ptcjhXMTBGREZkTG1rSnQxdGFXeE54QXBNMlxuQ2lGUENpbWswMmtveUxaRFc5bnFwV053NnFTL1RPWVBkejQzOHFFdWFtdFlVSit1NldoQmpLOHhBSkVBdDVrM1xuZ0RLWCtubFRpRzNONnNlMDlENjJmUzhDQXdFQUFRPT1cbi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLVxuIl0sInNraW5Eb21haW5zIjpbImF1dGgubHNtcC5zaXRlIiwidGV4dHVyZXMubWluZWNyYWZ0Lm5ldCJdfQ==')

        // Main Java Class
        args.push(this.modManifest.mainClass)

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
     * @param {Array.<Object>} mods An array of enabled mods which will be launched with this process.
     * @param {string} tempNativePath The path to store the native libraries.
     * @returns {Array.<string>} An array containing the full JVM arguments for this process.
     */
    _constructJVMArguments113(mods, tempNativePath){

        const argDiscovery = /\${*(.*)}/

        // JVM Arguments First
        let args = this.vanillaManifest.arguments.jvm

        // Debug securejarhandler
        // args.push('-Dbsl.debug=true')

        if(this.modManifest.arguments.jvm != null) {
            for(const argStr of this.modManifest.arguments.jvm) {
                args.push(argStr
                    .replaceAll('${library_directory}', this.libPath)
                    .replaceAll('${classpath_separator}', ProcessBuilder.getClasspathSeparator())
                    .replaceAll('${version_name}', this.modManifest.id)
                )
            }
        }

        //args.push('-Dlog4j.configurationFile=D:\\WesterosCraft\\game\\common\\assets\\log_configs\\client-1.12.xml')

        // Java Arguments
        if(process.platform === 'darwin'){
            args.push('-Xdock:name=LimboLauncher')
            args.push('-Xdock:icon=' + path.join(__dirname, '..', 'images', 'minecraft.icns'))
        }

        const current = ConfigManager.getSelectedAccount()
        if (current.type === 'microsoft') {
            args.push('-Xmx' + ConfigManager.getMaxRAM(this.server.rawServer.id))
            args.push('-Xms' + ConfigManager.getMinRAM(this.server.rawServer.id))
            args = args.concat(ConfigManager.getJVMOptions(this.server.rawServer.id))
        } else {
            args.push('-Xmx' + ConfigManager.getMaxRAM(this.server.rawServer.id))
            args.push('-Xms' + ConfigManager.getMinRAM(this.server.rawServer.id))
            args = args.concat(ConfigManager.getJVMOptions(this.server.rawServer.id))
            args.push('-Duser.language=es')
            args.push('-Dminecraft.api.env=custom')
            args.push('-Dminecraft.api.auth.host=https://auth.lsmp.site/authlib-injector/authserver')
            args.push('-Dminecraft.api.account.host=https://auth.lsmp.site/authlib-injector/api')
            args.push('-Dminecraft.api.session.host=https://auth.lsmp.site/authlib-injector/sessionserver')
            args.push('-Dminecraft.api.services.host=https://auth.lsmp.site/authlib-injector/minecraftservices')
            args.push(`-javaagent:${path.join(process.cwd(), 'resources', 'libraries', 'java', 'LimboAuth.jar')}=https://auth.lsmp.site/authlib-injector`)
            args.push('-Dauthlibinjector.yggdrasil.prefetched=eyJtZXRhIjp7ImltcGxlbWVudGF0aW9uTmFtZSI6IkRyYXNsIiwiaW1wbGVtZW50YXRpb25WZXJzaW9uIjoiMS4wLjEiLCJsaW5rcyI6eyJob21lcGFnZSI6Imh0dHBzOi8vYXV0aC5sc21wLnNpdGUiLCJyZWdpc3RlciI6Imh0dHBzOi8vYXV0aC5sc21wLnNpdGUvZHJhc2wvcmVnaXN0cmF0aW9uIn0sInNlcnZlck5hbWUiOiJMaW1ibyIsImZlYXR1cmUuZW5hYmxlX3Byb2ZpbGVfa2V5Ijp0cnVlfSwic2lnbmF0dXJlUHVibGlja2V5IjoiLS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS1cbk1JSUNJakFOQmdrcWhraUc5dzBCQVFFRkFBT0NBZzhBTUlJQ0NnS0NBZ0VBeEpjeUkySlZ2YnoydVEzWGtuTm1cbmkzR1FhMHFVUmxxV2FsdGgzNEcreTMyeUJSWlFiVUVuM05HV0hFOVcrdGs3OG95WGQ2bHduWngyMlJJeVJjRlNcbnhPeFhDcW1DUTJpWmFWZi9KVE4vNG1VWmJnaWk4RU9DeVptT3dwZmp5RTJQZXFkQ1BaaHlVdExLYS82djhxVnlcbmRNSGZhMzV4Uml3UGtQdkdaQ3FJcmhRaktLcGxLaWJ1MzRzR1hDNy9hQXlBMXpqRXZoeFoyRjJLS0gwbzc5c2Jcbk16cmtML1N0alZDbnlnMVhCQUJ2ZDdBUENlTkViaytOamlTY0JLNExBTmpSZ2tqV2RQZjZRZ0lSRWJNN05TbTBcbk8yZGI3VmlWYVI3Q1FhMTlUa1Z2MHRTR3hCY1EyYmZiWk9teWtKK2ZtMDdBdUp2ek5qekRmMDZPNEdCckZVOUhcbjFkaWN4Q0wrM2grZzZvL0JiNUk3LzBGaVdId2xrUDNsRzhhQVk5clFhcm5OakxsZENrakN5Rmw4Y24zNENnWDBcbnNhNnN3Mkh2YUdqaEd1bldsazQvUjU0UUw4YVVVcGsrVzh2YzFaV2JOL3VONVRRNWZ6NDQyWmF5QnlJNkxqUlZcbjRXMXhnaS9adVNsc0dKZlgrdEdkTXNyTmNpbVZUakpNQUlIMUEwM2kyTWl3dmJsbmI1ZzRLM0hoZWtOakRUZ05cbmxKUXlGR1BQZmN6dkNwSFdITk5NODlaWlBweVhOZmZBbjltV21VaXFOTjM2WHR1SkxyTTFnTnJ5K3hwMnJic3dcbnduNEthUlpTcGFpencvUzd3cnlLN0lvNXpXb1R6aVZoM0RJblovUXZrb1NPMThMVWdBekpheVNvdWd5UFRWRnhcblNQY1ZoOWVEcit4aVoydit2RlFLMFJNQ0F3RUFBUT09XG4tLS0tLUVORCBQVUJMSUMgS0VZLS0tLS1cbiIsInNpZ25hdHVyZVB1YmxpY2tleXMiOlsiLS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS1cbk1JSUNJakFOQmdrcWhraUc5dzBCQVFFRkFBT0NBZzhBTUlJQ0NnS0NBZ0VBeEpjeUkySlZ2YnoydVEzWGtuTm1cbmkzR1FhMHFVUmxxV2FsdGgzNEcreTMyeUJSWlFiVUVuM05HV0hFOVcrdGs3OG95WGQ2bHduWngyMlJJeVJjRlNcbnhPeFhDcW1DUTJpWmFWZi9KVE4vNG1VWmJnaWk4RU9DeVptT3dwZmp5RTJQZXFkQ1BaaHlVdExLYS82djhxVnlcbmRNSGZhMzV4Uml3UGtQdkdaQ3FJcmhRaktLcGxLaWJ1MzRzR1hDNy9hQXlBMXpqRXZoeFoyRjJLS0gwbzc5c2Jcbk16cmtML1N0alZDbnlnMVhCQUJ2ZDdBUENlTkViaytOamlTY0JLNExBTmpSZ2tqV2RQZjZRZ0lSRWJNN05TbTBcbk8yZGI3VmlWYVI3Q1FhMTlUa1Z2MHRTR3hCY1EyYmZiWk9teWtKK2ZtMDdBdUp2ek5qekRmMDZPNEdCckZVOUhcbjFkaWN4Q0wrM2grZzZvL0JiNUk3LzBGaVdId2xrUDNsRzhhQVk5clFhcm5OakxsZENrakN5Rmw4Y24zNENnWDBcbnNhNnN3Mkh2YUdqaEd1bldsazQvUjU0UUw4YVVVcGsrVzh2YzFaV2JOL3VONVRRNWZ6NDQyWmF5QnlJNkxqUlZcbjRXMXhnaS9adVNsc0dKZlgrdEdkTXNyTmNpbVZUakpNQUlIMUEwM2kyTWl3dmJsbmI1ZzRLM0hoZWtOakRUZ05cbmxKUXlGR1BQZmN6dkNwSFdITk5NODlaWlBweVhOZmZBbjltV21VaXFOTjM2WHR1SkxyTTFnTnJ5K3hwMnJic3dcbnduNEthUlpTcGFpencvUzd3cnlLN0lvNXpXb1R6aVZoM0RJblovUXZrb1NPMThMVWdBekpheVNvdWd5UFRWRnhcblNQY1ZoOWVEcit4aVoydit2RlFLMFJNQ0F3RUFBUT09XG4tLS0tLUVORCBQVUJMSUMgS0VZLS0tLS1cbiIsIi0tLS0tQkVHSU4gUFVCTElDIEtFWS0tLS0tXG5NSUlDSWpBTkJna3Foa2lHOXcwQkFRRUZBQU9DQWc4QU1JSUNDZ0tDQWdFQXlsQjRCNm01bHo3andyY0Z6NkZkXG4vZm5mVWhjdmx4c1RTbjVrSUsvMmFHRzFDM2tNeTRWamh3bHhGNkJGVVNuZnhoTnN3UGpoM1ppdGtCeEVBRlkyXG41dXprSkZSd0h3VkE5bWR3amFzaFhJTHRSNk9xZExYWEZWeVVQSVVSTE9TV3FHTkJ0YjA4RU41Zk1uRzhpRkxnXG5FSklCTXhzOUJ2RjNzMy9GaHVIeVBLaVZUWm1YWTBXWTRaeVlxdm9LUitYamFUUlBQdkJzRGE0V0kydTF6eFhNXG5lSGxvZFQzbG5DelZ2eU9ZQkxYTDZDSmdCeXVPeGNjSjhoblhmRjl5WTRGMGFlTDA4MEp6LzMrRUJORzhSTzRCXG55aHRCZjROeThOUTZzdFdzamZlVUl2SDdiVS80ekNZY1lPcTRXckluWEhxUzhxcnVEbUlsN1A1WFhHY2FidXpRXG5zdFBmL2gyQ1JBVXBQL1BsSFhjTWx2ZXdqbUdVNk1mREsrbGlmU2NOWXdqUHhSbzRuS1RHRlpmLzBhcUhDaC9FXG5Bc1F5TEtyT0lZUkUwbERHM2J6Qmg4b2dJTUxBdWdzQWZCYjZNM21xQ3FLYVRNQWYvVkFqaDVGRkpualMrN2JFXG4rYlpFVjBxd2F4MUNFb1BQSkwxZklRak9TOHpqMDg2Z2pwR1JDdFN5OStiVFBUZlRSL1NKK1ZVQjVHMkllQ0l0XG5rTkhwSlgyeWdvakZaOW41Rm5qN1I5Wm5PTStMOG55SWpQdTNhZVB2dGNyWGx5TGhIL2h2T2ZJT2pQeE9scVcrXG5PNVF3U0ZQNE9FY3lMQVVnRGRVZ3lXMzZaNW1CMjg1dUtXL2lnaHpac09UZXZWVUcyUXdESXRPYklWNmk4UkN4XG5GYk4yb0RIeVBhTzVqMXRUYUJOeVZ0OENBd0VBQVE9PVxuLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tXG4iLCItLS0tLUJFR0lOIFBVQkxJQyBLRVktLS0tLVxuTUlJQ0lqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FnOEFNSUlDQ2dLQ0FnRUFyYTRZMnd1M3JXRVc3Y0RURFJSZFxuNEl2VUQxNDBZMTJTYUczazRWM1V3VC9wRG5uWDVpdE9jWWlaQTBxZjRWQ3BKRHAyUGlmT0wrUHIvcGgvRzkvNlxuWm9JeGtCZUdFTm8rUzdpOUJxaXpKeTljbVpvY3B5eCtSa1phdzkrZnJDR05MdVlMcnh6aU5XaVhGQUNKU2cybVxuSEFDUjcrNk5rR044ZC8xNi8zUHhNbnZHU3lMVDdKS0dVZ3FqMVEzb1c3aytOTFhSOXN3Nm9SRUxPY25VdlpWYVxuMmJjZ2x2OHZsY3lQcXFuQmh5ZExmSEk4NVo1V25JWVp2aVozQmI0ZHY1Rm1lNzI2QkdPdEVZN2t6NDBSZml3alxuVDN4WUtZS1BKVVMzL2NyUFg2ZXVnbVd5cldkZGRLYWVQclc4OGJwMTdaNU5JU3RsSjVLSkprNGNvaGE4TytQN1xub25EcW1iSHdMcVBUZVI1MW5qa2daK0RKV1Q2Zno4a3U5T1dRbjZJL0Z4cU4xNGlZSWdoREppam1LdkV3c0k3RlxuSjVYMnR0UFhFdkJZTG1wajJqMGxRUWNVSXFIN2hraVorbUNXMEdZYXdKZ2JBZU5BcmFNOXNQKzc2TXlBR0lUdFxuQXNYdjFJUW1haCs3T2VESk9Ub0cyS2IxRGwwVmErSGlQOU1QcGNuTzdrYm42ZHFBeWhOdlJObUhuc1VPaUVjTFxuaFc5Ums3eHo4N0lCVi9jR0tiVURneHU4Y1lZMFA1MTJEV3Q1K0ptcjhXMTBGREZkTG1rSnQxdGFXeE54QXBNMlxuQ2lGUENpbWswMmtveUxaRFc5bnFwV053NnFTL1RPWVBkejQzOHFFdWFtdFlVSit1NldoQmpLOHhBSkVBdDVrM1xuZ0RLWCtubFRpRzNONnNlMDlENjJmUzhDQXdFQUFRPT1cbi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLVxuIl0sInNraW5Eb21haW5zIjpbImF1dGgubHNtcC5zaXRlIiwidGV4dHVyZXMubWluZWNyYWZ0Lm5ldCJdfQ==')
        }
        //estoy hasta los uebos, saquenme de aquí :3
        // Main Java Class
        args.push(this.modManifest.mainClass)

        // Vanilla Arguments
        args = args.concat(this.vanillaManifest.arguments.game)

        for(let i=0; i<args.length; i++){
            if(typeof args[i] === 'object' && args[i].rules != null){
                
                let checksum = 0
                for(let rule of args[i].rules){
                    if(rule.os != null){
                        if(rule.os.name === getMojangOS()
                            && (rule.os.version == null || new RegExp(rule.os.version).test(os.release))){
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
                if(checksum === args[i].rules.length){
                    if(typeof args[i].value === 'string'){
                        args[i] = args[i].value
                    } else if(typeof args[i].value === 'object'){
                        //args = args.concat(args[i].value)
                        args.splice(i, 1, ...args[i].value)
                    }

                    // Decrement i to reprocess the resolved value
                    i--
                } else {
                    args[i] = null
                }

            } else if(typeof args[i] === 'string'){
                if(argDiscovery.test(args[i])){
                    const identifier = args[i].match(argDiscovery)[1]
                    let val = null
                    switch(identifier){
                        case 'auth_player_name':
                            val = this.authUser.displayName.trim()
                            break
                        case 'version_name':
                            //val = vanillaManifest.id
                            val = this.server.rawServer.id
                            break
                        case 'game_directory':
                            val = this.gameDir
                            break
                        case 'assets_root':
                            val = path.join(this.commonDir, 'assets')
                            break
                        case 'assets_index_name':
                            val = this.vanillaManifest.assets
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
                            val = this.vanillaManifest.type
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
                            val = this.classpathArg(mods, tempNativePath).join(ProcessBuilder.getClasspathSeparator())
                            break
                    }
                    if(val != null){
                        args[i] = val
                    }
                }
            }
        }

        // Autoconnect
        this._processAutoConnectArg(args)
        

        // Forge Specific Arguments
        args = args.concat(this.modManifest.arguments.game)

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
    _resolveForgeArgs(){
        const mcArgs = this.modManifest.minecraftArguments.split(' ')
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
                        //val = vanillaManifest.id
                        val = this.server.rawServer.id
                        break
                    case 'game_directory':
                        val = this.gameDir
                        break
                    case 'assets_root':
                        val = path.join(this.commonDir, 'assets')
                        break
                    case 'assets_index_name':
                        val = this.vanillaManifest.assets
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
                        val = this.vanillaManifest.type
                        break
                }
                if(val != null){
                    mcArgs[i] = val
                }
            }
        }

        // Autoconnect to the selected server.
        this._processAutoConnectArg(mcArgs)

        // Prepare game resolution
        if(ConfigManager.getFullscreen()){
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
        if(this._lteMinorVersion(9)) {
            mcArgs.push(path.basename(this.fmlDir))
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
     * Ensure that the classpath entries all point to jar files.
     * 
     * @param {Array.<String>} list Array of classpath entries.
     */
    _processClassPathList(list) {

        const ext = '.jar'
        const extLen = ext.length
        for(let i=0; i<list.length; i++) {
            const extIndex = list[i].indexOf(ext)
            if(extIndex > -1 && extIndex  !== list[i].length - extLen) {
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
    classpathArg(mods, tempNativePath){
        let cpArgs = []

        if(!mcVersionAtLeast('1.17', this.server.rawServer.minecraftVersion) || this.usingFabricLoader) {
            // Add the version.jar to the classpath.
            // Must not be added to the classpath for Forge 1.17+.
            const version = this.vanillaManifest.id
            cpArgs.push(path.join(this.commonDir, 'versions', version, version + '.jar'))
        }
        

        if(this.usingLiteLoader){
            cpArgs.push(this.llPath)
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

        this._processClassPathList(cpArgs)

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
    _resolveMojangLibraries(tempNativePath){
        const nativesRegex = /.+:natives-([^-]+)(?:-(.+))?/
        const libs = {}

        const libArr = this.vanillaManifest.libraries
        fs.ensureDirSync(tempNativePath)
        for(let i=0; i<libArr.length; i++){
            const lib = libArr[i]
            if(isLibraryCompatible(lib.rules, lib.natives)){

                // Pre-1.19 has a natives object.
                if(lib.natives != null) {
                    // Extract the native library.
                    const exclusionArr = lib.extract != null ? lib.extract.exclude : ['META-INF/']
                    const artifact = lib.downloads.classifiers[lib.natives[getMojangOS()].replace('${arch}', process.arch.replace('x', ''))]

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
                // 1.19+ logic
                else if(lib.name.includes('natives-')) {

                    const regexTest = nativesRegex.exec(lib.name)
                    // const os = regexTest[1]
                    const arch = regexTest[2] ?? 'x64'

                    if(arch != process.arch) {
                        continue
                    }

                    // Extract the native library.
                    const exclusionArr = lib.extract != null ? lib.extract.exclude : ['META-INF/', '.git', '.sha1']
                    const artifact = lib.downloads.artifact

                    // Location of native zip.
                    const to = path.join(this.libPath, artifact.path)

                    let zip = new AdmZip(to)
                    let zipEntries = zip.getEntries()

                    // Unzip the native zip.
                    for(let i=0; i<zipEntries.length; i++){
                        if(zipEntries[i].isDirectory) {
                            continue
                        }

                        const fileName = zipEntries[i].entryName

                        let shouldExclude = false

                        // Exclude noted files.
                        exclusionArr.forEach(function(exclusion){
                            if(fileName.indexOf(exclusion) > -1){
                                shouldExclude = true
                            }
                        })

                        const extractName = fileName.includes('/') ? fileName.substring(fileName.lastIndexOf('/')) : fileName

                        // Extract the file.
                        if(!shouldExclude){
                            fs.writeFile(path.join(tempNativePath, extractName), zipEntries[i].getData(), (err) => {
                                if(err){
                                    logger.error('Error while extracting native library:', err)
                                }
                            })
                        }

                    }
                }
                // No natives
                else {
                    const dlInfo = lib.downloads
                    const artifact = dlInfo.artifact
                    const to = path.join(this.libPath, artifact.path)
                    const versionIndependentId = lib.name.substring(0, lib.name.lastIndexOf(':'))
                    libs[versionIndependentId] = to
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
    _resolveServerLibraries(mods){
        const mdls = this.server.modules
        let libs = {}

        // Locate Forge/Fabric/Libraries
        for(let mdl of mdls){
            const type = mdl.rawModule.type
            if(type === Type.ForgeHosted || type === Type.Fabric || type === Type.Library){
                libs[mdl.getVersionlessMavenIdentifier()] = mdl.getPath()
                if(mdl.subModules.length > 0){
                    const res = this._resolveModuleLibraries(mdl)
                    if(res.length > 0){
                        libs = {...libs, ...res}
                    }
                }
            }
        }

        //Check for any libraries in our mod list.
        for(let i=0; i<mods.length; i++){
            if(mods.sub_modules != null){
                const res = this._resolveModuleLibraries(mods[i])
                if(res.length > 0){
                    libs = {...libs, ...res}
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
        if(!mdl.subModules.length > 0){
            return []
        }
        let libs = []
        for(let sm of mdl.subModules){
            if(sm.rawModule.type === Type.Library){

                if(sm.rawModule.classpath ?? true) {
                    libs.push(sm.getPath())
                }
            }
            // If this module has submodules, we need to resolve the libraries for those.
            // To avoid unnecessary recursive calls, base case is checked here.
            if(mdl.subModules.length > 0){
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