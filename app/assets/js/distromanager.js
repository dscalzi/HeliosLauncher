const fs = require('fs')
const path = require('path')
const request = require('request')

const ConfigManager = require('./configmanager')
const logger        = require('./loggerutil')('%c[DistroManager]', 'color: #a02d2a; font-weight: bold')

/**
 * Represents the download information
 * for a specific module.
 */
class Artifact {
    
    /**
     * Parse a JSON object into an Artifact.
     * 
     * @param {Object} json A JSON object representing an Artifact.
     * 
     * @returns {Artifact} The parsed Artifact.
     */
    static fromJSON(json){
        return Object.assign(new Artifact(), json)
    }

    /**
     * Get the MD5 hash of the artifact. This value may
     * be undefined for artifacts which are not to be
     * validated and updated.
     * 
     * @returns {string} The MD5 hash of the Artifact or undefined.
     */
    getHash(){
        return this.MD5
    }

    /**
     * @returns {number} The download size of the artifact.
     */
    getSize(){
        return this.size
    }

    /**
     * @returns {string} The download url of the artifact.
     */
    getURL(){
        return this.url
    }

    /**
     * @returns {string} The artifact's destination path.
     */
    getPath(){
        return this.path
    }

}
exports.Artifact

/**
 * Represents a the requirement status
 * of a module.
 */
class Required {
    
    /**
     * Parse a JSON object into a Required object.
     * 
     * @param {Object} json A JSON object representing a Required object.
     * 
     * @returns {Required} The parsed Required object.
     */
    static fromJSON(json){
        if(json == null){
            return new Required(true, true)
        } else {
            return new Required(json.value == null ? true : json.value, json.def == null ? true : json.def)
        }
    }

    constructor(value, def){
        this.value = value
        this.default = def
    }

    /**
     * Get the default value for a required object. If a module
     * is not required, this value determines whether or not
     * it is enabled by default.
     * 
     * @returns {boolean} The default enabled value.
     */
    isDefault(){
        return this.default
    }

    /**
     * @returns {boolean} Whether or not the module is required.
     */
    isRequired(){
        return this.value
    }

}
exports.Required

/**
 * Represents a module.
 */
class Module {

    /**
     * Parse a JSON object into a Module.
     * 
     * @param {Object} json A JSON object representing a Module.
     * @param {string} serverid The ID of the server to which this module belongs.
     * 
     * @returns {Module} The parsed Module.
     */
    static fromJSON(json, serverid){
        return new Module(json.id, json.name, json.type, json.required, json.artifact, json.subModules, serverid)
    }

    /**
     * Resolve the default extension for a specific module type.
     * 
     * @param {string} type The type of the module.
     * 
     * @return {string} The default extension for the given type.
     */
    static _resolveDefaultExtension(type){
        switch (type) {
            case exports.Types.Library:
            case exports.Types.ForgeHosted:
            case exports.Types.LiteLoader:
            case exports.Types.ForgeMod:
                return 'jar'
            case exports.Types.LiteMod:
                return 'litemod'
            case exports.Types.File:
            default:
                return 'jar' // There is no default extension really.
        }
    }

    constructor(id, name, type, required, artifact, subModules, serverid) {
        this.identifier = id
        this.type = type
        this._resolveMetaData()
        this.name = name
        this.required = Required.fromJSON(required)
        this.artifact = Artifact.fromJSON(artifact)
        this._resolveArtifactPath(artifact.path, serverid)
        this._resolveSubModules(subModules, serverid)
    }

    _resolveMetaData(){
        try {

            const m0 = this.identifier.split('@')

            this.artifactExt = m0[1] || Module._resolveDefaultExtension(this.type)

            const m1 = m0[0].split(':')

            this.artifactClassifier = m1[3] || undefined
            this.artifactVersion = m1[2] || '???'
            this.artifactID = m1[1] || '???'
            this.artifactGroup = m1[0] || '???'

        } catch (err) {
            // Improper identifier
            logger.error('Improper ID for module', this.identifier, err)
        }
    }

    _resolveArtifactPath(artifactPath, serverid){
        const pth = artifactPath == null ? path.join(...this.getGroup().split('.'), this.getID(), this.getVersion(), `${this.getID()}-${this.getVersion()}${this.artifactClassifier != undefined ? `-${this.artifactClassifier}` : ''}.${this.getExtension()}`) : artifactPath

        switch (this.type){
            case exports.Types.Library:
            case exports.Types.ForgeHosted:
            case exports.Types.LiteLoader:
                this.artifact.path = path.join(ConfigManager.getCommonDirectory(), 'libraries', pth)
                break
            case exports.Types.ForgeMod:
            case exports.Types.LiteMod:
                this.artifact.path = path.join(ConfigManager.getCommonDirectory(), 'modstore', pth)
                break
            case exports.Types.VersionManifest:
                this.artifact.path = path.join(ConfigManager.getCommonDirectory(), 'versions', this.getIdentifier(), `${this.getIdentifier()}.json`)
                break
            case exports.Types.File:
            default:
                this.artifact.path = path.join(ConfigManager.getInstanceDirectory(), serverid, pth)
                break
        }

    }

    _resolveSubModules(json, serverid){
        const arr = []
        if(json != null){
            for(let sm of json){
                arr.push(Module.fromJSON(sm, serverid))
            }
        }
        this.subModules = arr.length > 0 ? arr : null
    }

    /**
     * @returns {string} The full, unparsed module identifier.
     */
    getIdentifier(){
        return this.identifier
    }

    /**
     * @returns {string} The name of the module.
     */
    getName(){
        return this.name
    }

    /**
     * @returns {Required} The required object declared by this module.
     */
    getRequired(){
        return this.required
    }

    /**
     * @returns {Artifact} The artifact declared by this module.
     */
    getArtifact(){
        return this.artifact
    }

    /**
     * @returns {string} The maven identifier of this module's artifact.
     */
    getID(){
        return this.artifactID
    }

    /**
     * @returns {string} The maven group of this module's artifact.
     */
    getGroup(){
        return this.artifactGroup
    }

    /**
     * @returns {string} The identifier without he version or extension.
     */
    getVersionlessID(){
        return this.getGroup() + ':' + this.getID()
    }

    /**
     * @returns {string} The identifier without the extension.
     */
    getExtensionlessID(){
        return this.getIdentifier().split('@')[0]
    }

    /**
     * @returns {string} The version of this module's artifact.
     */
    getVersion(){
        return this.artifactVersion
    }

    /**
     * @returns {string} The classifier of this module's artifact
     */
    getClassifier(){
        return this.artifactClassifier
    }

    /**
     * @returns {string} The extension of this module's artifact.
     */
    getExtension(){
        return this.artifactExt
    }

    /**
     * @returns {boolean} Whether or not this module has sub modules.
     */
    hasSubModules(){
        return this.subModules != null
    }

    /**
     * @returns {Array.<Module>} An array of sub modules.
     */
    getSubModules(){
        return this.subModules
    }

    /**
     * @returns {string} The type of the module.
     */
    getType(){
        return this.type
    }

}
exports.Module

/**
 * Represents a server configuration.
 */
class Server {

    /**
     * Parse a JSON object into a Server.
     * 
     * @param {Object} json A JSON object representing a Server.
     * 
     * @returns {Server} The parsed Server object.
     */
    static fromJSON(json){

        const mdls = json.modules
        json.modules = []

        const serv = Object.assign(new Server(), json)
        serv._resolveModules(mdls)

        return serv
    }

    _resolveModules(json){
        const arr = []
        for(let m of json){
            arr.push(Module.fromJSON(m, this.getID()))
        }
        this.modules = arr
    }

    /**
     * @returns {string} The ID of the server.
     */
    getID(){
        return this.id
    }

    /**
     * @returns {string} The name of the server.
     */
    getName(){
        return this.name
    }

    /**
     * @returns {string} The description of the server.
     */
    getDescription(){
        return this.description
    }

    /**
     * @returns {string} The URL of the server's icon.
     */
    getIcon(){
        return this.icon
    }

    /**
     * @returns {string} The version of the server configuration.
     */
    getVersion(){
        return this.version
    }

    /**
     * @returns {string} The IP address of the server.
     */
    getAddress(){
        return this.address
    }

    /**
     * @returns {string} The minecraft version of the server.
     */
    getMinecraftVersion(){
        return this.minecraftVersion
    }

    /**
     * @returns {boolean} Whether or not this server is the main
     * server. The main server is selected by the launcher when
     * no valid server is selected.
     */
    isMainServer(){
        return this.mainServer
    }

    /**
     * @returns {boolean} Whether or not the server is autoconnect.
     * by default.
     */
    isAutoConnect(){
        return this.autoconnect
    }

    /**
     * @returns {Array.<Module>} An array of modules for this server.
     */
    getModules(){
        return this.modules
    }

}
exports.Server

/**
 * Represents the Distribution Index.
 */
class DistroIndex {

    /**
     * Parse a JSON object into a DistroIndex.
     * 
     * @param {Object} json A JSON object representing a DistroIndex.
     * 
     * @returns {DistroIndex} The parsed Server object.
     */
    static fromJSON(json){

        const servers = json.servers
        json.servers = []

        const distro = Object.assign(new DistroIndex(), json)
        distro._resolveServers(servers)
        distro._resolveMainServer()

        return distro
    }

    _resolveServers(json){
        const arr = []
        for(let s of json){
            arr.push(Server.fromJSON(s))
        }
        this.servers = arr
    }

    _resolveMainServer(){

        for(let serv of this.servers){
            if(serv.mainServer){
                this.mainServer = serv.id
                return
            }
        }

        // If no server declares default_selected, default to the first one declared.
        this.mainServer = (this.servers.length > 0) ? this.servers[0].getID() : null
    }

    /**
     * @returns {string} The version of the distribution index.
     */
    getVersion(){
        return this.version
    }

    /**
     * @returns {string} The URL to the news RSS feed.
     */
    getRSS(){
        return this.rss
    }

    /**
     * @returns {Array.<Server>} An array of declared server configurations.
     */
    getServers(){
        return this.servers
    }

    /**
     * Get a server configuration by its ID. If it does not
     * exist, null will be returned.
     * 
     * @param {string} id The ID of the server.
     * 
     * @returns {Server} The server configuration with the given ID or null.
     */
    getServer(id){
        for(let serv of this.servers){
            if(serv.id === id){
                return serv
            }
        }
        return null
    }

    /**
     * Get the main server.
     * 
     * @returns {Server} The main server.
     */
    getMainServer(){
        return this.mainServer != null ? this.getServer(this.mainServer) : null
    }

}
exports.DistroIndex

exports.Types = {
    Library: 'Library',
    ForgeHosted: 'ForgeHosted',
    Forge: 'Forge', // Unimplemented
    LiteLoader: 'LiteLoader',
    ForgeMod: 'ForgeMod',
    LiteMod: 'LiteMod',
    File: 'File',
    VersionManifest: 'VersionManifest'
}

let DEV_MODE = false

const DISTRO_PATH = path.join(ConfigManager.getLauncherDirectory(), 'distribution.json')
const DEV_PATH = path.join(ConfigManager.getLauncherDirectory(), 'dev_distribution.json')

let data = null

/**
 * @returns {Promise.<DistroIndex>}
 */
exports.pullRemote = function(){
    if(DEV_MODE){
        return exports.pullLocal()
    }
    return new Promise((resolve, reject) => {
        const distroURL = 'http://mc.westeroscraft.com/WesterosCraftLauncher/distribution.json'
        //const distroURL = 'https://gist.githubusercontent.com/dscalzi/53b1ba7a11d26a5c353f9d5ae484b71b/raw/'
        const opts = {
            url: distroURL,
            timeout: 2500
        }
        const distroDest = path.join(ConfigManager.getLauncherDirectory(), 'distribution.json')
        request(opts, (error, resp, body) => {
            if(!error){
                
                try {
                    data = DistroIndex.fromJSON(JSON.parse(body))
                } catch (e) {
                    reject(e)
                    return
                }

                fs.writeFile(distroDest, body, 'utf-8', (err) => {
                    if(!err){
                        resolve(data)
                        return
                    } else {
                        reject(err)
                        return
                    }
                })
            } else {
                reject(error)
                return
            }
        })
    })
}

/**
 * @returns {Promise.<DistroIndex>}
 */
exports.pullLocal = function(){
    return new Promise((resolve, reject) => {
        fs.readFile(DEV_MODE ? DEV_PATH : DISTRO_PATH, 'utf-8', (err, d) => {
            if(!err){
                data = DistroIndex.fromJSON(JSON.parse(d))
                resolve(data)
                return
            } else {
                reject(err)
                return
            }
        })
    })
}

exports.setDevMode = function(value){
    if(value){
        logger.log('Developer mode enabled.')
        logger.log('If you don\'t know what that means, revert immediately.')
    } else {
        logger.log('Developer mode disabled.')
    }
    DEV_MODE = value
}

exports.isDevMode = function(){
    return DEV_MODE
}

/**
 * @returns {DistroIndex}
 */
exports.getDistribution = function(){
    return data
}