const fs = require('fs')
const mkpath = require('mkdirp')
const path = require('path')
const uuidV4 = require('uuid/v4')

class ConfigManager {

    constructor(path){
        this.path = path
        this.config = null
        this.load()
    }

    /**
     * Generates a default configuration object and saves it.
     * 
     * @param {Boolean} save - optional. If true, the default config will be saved after being generated.
     */
    _generateDefault(save = true){
        this.config = {
            settings: {},
            clientToken: uuidV4(),
            authenticationDatabase: []
        }
        if(save){
            this.save()
        }
    }

    load(){
        if(!fs.existsSync(this.path)){
            mkpath.sync(path.join(this.path, '..'))
            this._generateDefault()
        } else {
            this.config = JSON.parse(fs.readFileSync(this.path, 'UTF-8'))
        }
    }

    save(){
        fs.writeFileSync(this.path, JSON.stringify(this.config, null, 4), 'UTF-8')
    }

    getClientToken(){
        return this.config.clientToken
    }

}

module.exports = ConfigManager