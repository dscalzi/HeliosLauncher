const fs = require('fs')
const mkpath = require('mkdirp')
const os = require('os')
const path = require('path')
const uuidV4 = require('uuid/v4')

class ConfigManager {

    constructor(path){
        this.path = path
        this.config = null
        this.load()
    }

    /* Private functions to resolve default settings based on system specs. */

    static _resolveMaxRAM(){
        const mem = os.totalmem()
        return mem >= 8000000000 ? '4G' : (mem >= 6000000000 ? '3G' : '2G')
    }

    /**
     * Generates a default configuration object and saves it.
     * 
     * @param {Boolean} save - optional. If true, the default config will be saved after being generated.
     */
    _generateDefault(save = true){
        this.config = {
            settings: {
                java: {
                    minRAM: '2G',
                    maxRAM: ConfigManager._resolveMaxRAM(),
                    executable: 'C:\\Program Files\\Java\\jdk1.8.0_152\\bin\\javaw.exe', //TODO Resolve
                    jvmOptions: [
                        '-XX:+UseConcMarkSweepGC',
                        '-XX:+CMSIncrementalMode',
                        '-XX:-UseAdaptiveSizePolicy',
                        '-Xmn128M'
                    ],
                },
                game: {
                    resWidth: 1280,
                    resHeight: 720,
                    fullscreen: false,
                    autoConnect: true
                },
                launcher: {

                }
            },
            clientToken: uuidV4(),
            selectedServer: null,
            selectedAccount: null,
            authenticationDatabase: [],
            discord: {
                clientID: 385581240906022916
            }
        }
        if(save){
            this.save()
        }
    }

    /**
     * Load the launcher configuration into memory. If the specified file does
     * not exist, a default configuration will be generated and saved.
     */
    load(){
        if(!fs.existsSync(this.path)){
            mkpath.sync(path.join(this.path, '..'))
            this._generateDefault()
        } else {
            this.config = JSON.parse(fs.readFileSync(this.path, 'UTF-8'))
        }
    }

    /**
     * Save the launcher configuration to the specified file.
     */
    save(){
        fs.writeFileSync(this.path, JSON.stringify(this.config, null, 4), 'UTF-8')
    }

    /**
     * Retrieve the launcher's Client Token.
     */
    getClientToken(){
        return this.config.clientToken
    }

    /**
     * Retrieve the selected server configuration value.
     */
    getSelectedServer(){
        return this.config.selectedServer
    }

    /**
     * Set the selected server configuration value.
     * 
     * @param {String} serverID - the id of the new selected server.
     */
    setSelectedServer(serverID){
        this.config.selectedServer = serverID
        this.save()
    }

    /**
     * Retrieve the launcher's Discord Client ID.
     */
    getDiscordClientID(){
        return this.config.discord.clientID
    }

    /**
     * Retrieve the minimum amount of memory for JVM initialization.
     */
    getMinRAM(){
        return this.config.settings.java.minRAM
    }

    /**
     * Retrieve the maximum amount of memory for JVM initialization.
     */
    getMaxRAM(){
        return this.config.settings.java.maxRAM
    }

    /**
     * Retrieve the path of the java executable.
     */
    getJavaExecutable(){
        return this.config.settings.java.executable
    }

    /**
     * Retrieve the additional arguments for JVM initialization. Required arguments,
     * such as memory allocation, will be dynamically resolved.
     */
    getJVMOptions(){
        return this.config.settings.java.jvmOptions
    }

    /**
     * Retrieve the width of the game window.
     */
    getGameWidth(){
        return this.config.settings.game.resWidth
    }

    /**
     * Retrieve the height of the game window.
     */
    getGameHeight(){
        return this.config.settings.game.resHeight
    }

    /**
     * Check if the game should be launched in fullscreen mode.
     */
    isFullscreen(){
        return this.config.settings.game.fullscreen
    }

    /**
     * Check if auto connect is enabled.
     */
    isAutoConnect(){
        return this.config.settings.game.autoConnect
    }

}

module.exports = ConfigManager