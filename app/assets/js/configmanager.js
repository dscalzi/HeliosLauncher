const fs = require('fs')
const mkpath = require('mkdirp')
const os = require('os')
const path = require('path')
const uuidV4 = require('uuid/v4')

function resolveMaxRAM(){
    const mem = os.totalmem()
    return mem >= 8000000000 ? '4G' : (mem >= 6000000000 ? '3G' : '2G')
}

/**
 * Three types of values:
 * Static = Explicitly declared.
 * Dynamic = Calculated by a private function.
 * Resolved = Resolved externally, defaults to null.
 */
const DEFAULT_CONFIG = {
    settings: {
        java: {
            minRAM: '2G',
            maxRAM: resolveMaxRAM(), // Dynamic
            executable: 'C:\\Program Files\\Java\\jdk1.8.0_152\\bin\\javaw.exe', // TODO Resolve
            jvmOptions: [
                '-XX:+UseConcMarkSweepGC',
                '-XX:+CMSIncrementalMode',
                '-XX:-UseAdaptiveSizePolicy',
                '-Xmn128M'
            ],
        },
        game: {
            directory: path.join(__dirname, '..', '..', '..', 'target', 'test', 'mcfiles'),
            resWidth: 1280,
            resHeight: 720,
            fullscreen: false,
            autoConnect: true
        },
        launcher: {

        }
    },
    clientToken: uuidV4(),
    selectedServer: null, // Resolved
    selectedAccount: null,
    authenticationDatabase: []
}

let config = null;

// Persistance Utility Functions

/**
 * Save the current configuration to a file.
 */
exports.save = function(){
    const filePath = path.join(config.settings.game.directory, 'config.json')
    fs.writeFileSync(filePath, JSON.stringify(config, null, 4), 'UTF-8')
}

/**
 * Load the configuration into memory. If a configuration file exists,
 * that will be read and saved. Otherwise, a default configuration will
 * be generated. Note that "resolved" values default to null and will
 * need to be externally assigned.
 */
exports.load = function(){
    // Determine the effective configuration.
    const EFFECTIVE_CONFIG = config == null ? DEFAULT_CONFIG : config
    const filePath = path.join(EFFECTIVE_CONFIG.settings.game.directory, 'config.json')

    if(!fs.existsSync(filePath)){
        // Create all parent directories.
        mkpath.sync(path.join(filePath, '..'))
        config = DEFAULT_CONFIG
        exports.save()
    } else {
        config = JSON.parse(fs.readFileSync(filePath, 'UTF-8'))
    }
}

// System Settings (Unconfigurable on UI)

/**
 * Retrieve the launcher's Client Token.
 * 
 * @param {Boolean} def - optional. If true, the default value will be returned.
 * @returns {String} - the launcher's Client Token.
 */
exports.getClientToken = function(def = false){
    return !def ? config.clientToken : DEFAULT_CONFIG.clientToken
}

/**
 * Set the launcher's Client Token.
 * 
 * @param {String} clientToken - the launcher's new Client Token.
 */
exports.setClientToken = function(clientToken){
    config.clientToken = clientToken
}

/**
 * Retrieve the ID of the selected serverpack.
 * 
 * @param {Boolean} def - optional. If true, the default value will be returned.
 * @returns {String} - the ID of the selected serverpack.
 */
exports.getSelectedServer = function(def = false){
    return !def ? config.selectedServer : DEFAULT_CONFIG.clientToken
}

/**
 * Set the ID of the selected serverpack.
 * 
 * @param {String} serverID - the ID of the new selected serverpack.
 */
exports.setSelectedServer = function(serverID){
    config.selectedServer = serverID
}

//TODO Write Authentication Database/Selected Account accessors here

// User Configurable Settings

// Java Settings

/**
 * Retrieve the minimum amount of memory for JVM initialization. This value
 * contains the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
 * 1024 MegaBytes, etc.
 * 
 * @param {Boolean} def - optional. If true, the default value will be returned.
 * @returns {String} - the minimum amount of memory for JVM initialization.
 */
exports.getMinRAM = function(def = false){
    return !def ? config.settings.java.minRAM : DEFAULT_CONFIG.settings.java.minRAM
}

/**
 * Set the minimum amount of memory for JVM initialization. This value should
 * contain the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
 * 1024 MegaBytes, etc.
 * 
 * @param {String} minRAM - the new minimum amount of memory for JVM initialization.
 */
exports.setMinRAM = function(minRAM){
    config.settings.java.minRAM = minRAM
}

/**
 * Retrieve the maximum amount of memory for JVM initialization. This value
 * contains the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
 * 1024 MegaBytes, etc.
 * 
 * @param {Boolean} def - optional. If true, the default value will be returned.
 * @returns {String} - the maximum amount of memory for JVM initialization.
 */
exports.getMaxRAM = function(def = false){
    return !def ? config.settings.java.maxRAM : resolveMaxRAM()
}

/**
 * Set the maximum amount of memory for JVM initialization. This value should
 * contain the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
 * 1024 MegaBytes, etc.
 * 
 * @param {String} maxRAM - the new maximum amount of memory for JVM initialization.
 */
exports.setMaxRAM = function(maxRAM){
    config.settings.java.maxRAM = maxRAM
}

/**
 * Retrieve the path of the Java Executable.
 * 
 * This is a resolved configuration value and defaults to null until externally assigned.
 * 
 * @returns {String} - the path of the Java Executable.
 */
exports.getJavaExecutable = function(){
    return config.settings.java.executable
}

/**
 * Set the path of the Java Executable.
 * 
 * @param {String} executable - the new path of the Java Executable.
 */
exports.setJavaExecutable = function(executable){
    config.settings.java.executable = executable
}

/**
 * Retrieve the additional arguments for JVM initialization. Required arguments,
 * such as memory allocation, will be dynamically resolved and will not be included
 * in this value.
 * 
 * @param {Boolean} def - optional. If true, the default value will be returned.
 * @returns {Array.<String>} - an array of the additional arguments for JVM initialization.
 */
exports.getJVMOptions = function(def = false){
    return !def ? config.settings.java.jvmOptions : DEFAULT_CONFIG.settings.java.jvmOptions
}

/**
 * Set the additional arguments for JVM initialization. Required arguments,
 * such as memory allocation, will be dynamically resolved and should not be
 * included in this value.
 * 
 * @param {Array.<String>} jvmOptions - an array of the new additional arguments for JVM 
 * initialization.
 */
exports.setJVMOptions = function(jvmOptions){
    config.settings.java.jvmOptions = jvmOptions
}

// Game Settings

/**
 * Retrieve the absolute path of the game directory.
 * 
 * @param {Boolean} def - optional. If true, the default value will be returned.
 * @returns {String} - the absolute path of the game directory.
 */
exports.getGameDirectory = function(def = false){
    return !def ? config.settings.game.directory : DEFAULT_CONFIG.settings.game.directory
}

/**
 * Set the absolute path of the game directory.
 * 
 * @param {String} directory - the absolute path of the new game directory.
 */
exports.setGameDirectory = function(directory){
    config.settings.game.directory = directory
}

/**
 * Retrieve the width of the game window.
 * 
 * @param {Boolean} def - optional. If true, the default value will be returned.
 * @returns {Number} - the width of the game window.
 */
exports.getGameWidth = function(def = false){
    return !def ? config.settings.game.resWidth : DEFAULT_CONFIG.settings.game.resWidth
}

/**
 * Set the width of the game window.
 * 
 * @param {Number} resWidth - the new width of the game window.
 */
exports.setGameWidth = function(resWidth){
    config.settings.game.resWidth = resWidth
}

/**
 * Retrieve the height of the game window.
 * 
 * @param {Boolean} def - optional. If true, the default value will be returned.
 * @returns {Number} - the height of the game window.
 */
exports.getGameHeight = function(def = false){
    return !def ? config.settings.game.resHeight : DEFAULT_CONFIG.settings.game.resHeight
}

/**
 * Set the height of the game window.
 * 
 * @param {Number} resHeight - the new height of the game window.
 */
exports.setGameHeight = function(resHeight){
    config.settings.game.resHeight = resHeight
}

/**
 * Check if the game should be launched in fullscreen mode.
 * 
 * @param {Boolean} def - optional. If true, the default value will be returned.
 * @returns {Boolean} - whether or not the game is set to launch in fullscreen mode.
 */
exports.isFullscreen = function(def = false){
    return !def ? config.settings.game.fullscreen : DEFAULT_CONFIG.settings.game.fullscreen
}

/**
 * Change the status of if the game should be launched in fullscreen mode.
 * 
 * @param {Boolean} fullscreen - whether or not the game should launch in fullscreen mode.
 */
exports.setFullscreen = function(fullscreen){
    config.settings.game.fullscreen = fullscreen
}

/**
 * Check if the game should auto connect to servers.
 * 
 * @param {Boolean} def - optional. If true, the default value will be returned.
 * @returns {Boolean} - whether or not the game should auto connect to servers.
 */
exports.isAutoConnect = function(def = false){
    return !def ? config.settings.game.autoConnect : DEFAULT_CONFIG.settings.game.autoConnect
}

/**
 * Change the status of whether or not the game should auto connect to servers.
 * 
 * @param {Boolean} autoConnect - whether or not the game should auto connect to servers.
 */
exports.setAutoConnect = function(autoConnect){
    config.settings.game.autoConnect = autoConnect
}