const fs = require('fs')
const mkpath = require('mkdirp')
const os = require('os')
const path = require('path')
const uuidV4 = require('uuid/v4')

const sysRoot = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : '/var/local')
const dataPath = path.join(sysRoot, '.westeroscraft')

const firstLaunch = !fs.existsSync(dataPath)

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
            executable: null,
            jvmOptions: [
                '-XX:+UseConcMarkSweepGC',
                '-XX:+CMSIncrementalMode',
                '-XX:-UseAdaptiveSizePolicy',
                '-Xmn128M'
            ],
        },
        game: {
            directory: path.join(dataPath, 'game'),
            resWidth: 1280,
            resHeight: 720,
            fullscreen: false,
            autoConnect: true
        },
        launcher: {}
    },
    clientToken: uuidV4().replace(/-/g, ''),
    selectedServer: null, // Resolved
    selectedAccount: null,
    authenticationDatabase: {}
}

let config = null;

// Persistance Utility Functions

/**
 * Save the current configuration to a file.
 */
exports.save = function(){
    const filePath = path.join(dataPath, 'config.json')
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
    //const EFFECTIVE_CONFIG = config == null ? DEFAULT_CONFIG : config
    const filePath = path.join(dataPath, 'config.json')

    if(!fs.existsSync(filePath)){
        // Create all parent directories.
        mkpath.sync(path.join(filePath, '..'))
        config = DEFAULT_CONFIG
        exports.save()
    } else {
        config = JSON.parse(fs.readFileSync(filePath, 'UTF-8'))
    }
}

/**
 * Retrieve the absolute path of the launcher directory.
 * 
 * @returns {string} The absolute path of the launcher directory.
 */
exports.getLauncherDirectory = function(){
    return dataPath
}

/**
 * Check to see if this is the first time the user has launched the
 * application. This is determined by the existance of the data path.
 * 
 * @returns {boolean} True if this is the first launch, otherwise false.
 */
exports.isFirstLaunch = function(){
    return firstLaunch
}

// System Settings (Unconfigurable on UI)

/**
 * Retrieve the launcher's Client Token.
 * There is no default client token.
 * 
 * @returns {string} The launcher's Client Token.
 */
exports.getClientToken = function(){
    return config.clientToken
}

/**
 * Set the launcher's Client Token.
 * 
 * @param {string} clientToken The launcher's new Client Token.
 */
exports.setClientToken = function(clientToken){
    config.clientToken = clientToken
}

/**
 * Retrieve the ID of the selected serverpack.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {string} The ID of the selected serverpack.
 */
exports.getSelectedServer = function(def = false){
    return !def ? config.selectedServer : DEFAULT_CONFIG.clientToken
}

/**
 * Set the ID of the selected serverpack.
 * 
 * @param {string} serverID The ID of the new selected serverpack.
 */
exports.setSelectedServer = function(serverID){
    config.selectedServer = serverID
}

/**
 * Get an array of each account currently authenticated by the launcher.
 * 
 * @returns {Array.<Object>} An array of each stored authenticated account.
 */
exports.getAuthAccounts = function(){
    return config.authenticationDatabase
}

/**
 * Returns the authenticated account with the given uuid. Value may
 * be null.
 * 
 * @param {string} uuid The uuid of the authenticated account.
 * @returns {Object} The authenticated account with the given uuid.
 */
exports.getAuthAccount = function(uuid){
    return config.authenticationDatabase[uuid]
}

/**
 * Update the access token of an authenticated account.
 * 
 * @param {string} uuid The uuid of the authenticated account.
 * @param {string} accessToken The new Access Token.
 * 
 * @returns {Object} The authenticated account object created by this action.
 */
exports.updateAuthAccount = function(uuid, accessToken){
    config.authenticationDatabase[uuid].accessToken = accessToken
    return config.authenticationDatabase[uuid]
}

/**
 * Adds an authenticated account to the database to be stored.
 * 
 * @param {string} uuid The uuid of the authenticated account.
 * @param {string} accessToken The accessToken of the authenticated account.
 * @param {string} username The username (usually email) of the authenticated account.
 * @param {string} displayName The in game name of the authenticated account.
 * 
 * @returns {Object} The authenticated account object created by this action.
 */
exports.addAuthAccount = function(uuid, accessToken, username, displayName){
    config.selectedAccount = uuid
    config.authenticationDatabase[uuid] = {
        accessToken,
        username,
        uuid,
        displayName
    }
    return config.authenticationDatabase[uuid]
}

/**
 * Get the currently selected authenticated account.
 * 
 * @returns {Object} The selected authenticated account.
 */
exports.getSelectedAccount = function(){
    return config.authenticationDatabase[config.selectedAccount]
}

// User Configurable Settings

// Java Settings

/**
 * Retrieve the minimum amount of memory for JVM initialization. This value
 * contains the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
 * 1024 MegaBytes, etc.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {string} The minimum amount of memory for JVM initialization.
 */
exports.getMinRAM = function(def = false){
    return !def ? config.settings.java.minRAM : DEFAULT_CONFIG.settings.java.minRAM
}

/**
 * Set the minimum amount of memory for JVM initialization. This value should
 * contain the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
 * 1024 MegaBytes, etc.
 * 
 * @param {string} minRAM The new minimum amount of memory for JVM initialization.
 */
exports.setMinRAM = function(minRAM){
    config.settings.java.minRAM = minRAM
}

/**
 * Retrieve the maximum amount of memory for JVM initialization. This value
 * contains the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
 * 1024 MegaBytes, etc.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {string} The maximum amount of memory for JVM initialization.
 */
exports.getMaxRAM = function(def = false){
    return !def ? config.settings.java.maxRAM : resolveMaxRAM()
}

/**
 * Set the maximum amount of memory for JVM initialization. This value should
 * contain the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
 * 1024 MegaBytes, etc.
 * 
 * @param {string} maxRAM The new maximum amount of memory for JVM initialization.
 */
exports.setMaxRAM = function(maxRAM){
    config.settings.java.maxRAM = maxRAM
}

/**
 * Retrieve the path of the Java Executable.
 * 
 * This is a resolved configuration value and defaults to null until externally assigned.
 * 
 * @returns {string} The path of the Java Executable.
 */
exports.getJavaExecutable = function(){
    return config.settings.java.executable
}

/**
 * Set the path of the Java Executable.
 * 
 * @param {string} executable The new path of the Java Executable.
 */
exports.setJavaExecutable = function(executable){
    config.settings.java.executable = executable
}

/**
 * Retrieve the additional arguments for JVM initialization. Required arguments,
 * such as memory allocation, will be dynamically resolved and will not be included
 * in this value.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {Array.<string>} An array of the additional arguments for JVM initialization.
 */
exports.getJVMOptions = function(def = false){
    return !def ? config.settings.java.jvmOptions : DEFAULT_CONFIG.settings.java.jvmOptions
}

/**
 * Set the additional arguments for JVM initialization. Required arguments,
 * such as memory allocation, will be dynamically resolved and should not be
 * included in this value.
 * 
 * @param {Array.<string>} jvmOptions An array of the new additional arguments for JVM 
 * initialization.
 */
exports.setJVMOptions = function(jvmOptions){
    config.settings.java.jvmOptions = jvmOptions
}

// Game Settings

/**
 * Retrieve the absolute path of the game directory.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {string} The absolute path of the game directory.
 */
exports.getGameDirectory = function(def = false){
    return !def ? config.settings.game.directory : DEFAULT_CONFIG.settings.game.directory
}

/**
 * Set the absolute path of the game directory.
 * 
 * @param {string} directory The absolute path of the new game directory.
 */
exports.setGameDirectory = function(directory){
    config.settings.game.directory = directory
}

/**
 * Retrieve the width of the game window.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {number} The width of the game window.
 */
exports.getGameWidth = function(def = false){
    return !def ? config.settings.game.resWidth : DEFAULT_CONFIG.settings.game.resWidth
}

/**
 * Set the width of the game window.
 * 
 * @param {number} resWidth The new width of the game window.
 */
exports.setGameWidth = function(resWidth){
    config.settings.game.resWidth = resWidth
}

/**
 * Retrieve the height of the game window.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {number} The height of the game window.
 */
exports.getGameHeight = function(def = false){
    return !def ? config.settings.game.resHeight : DEFAULT_CONFIG.settings.game.resHeight
}

/**
 * Set the height of the game window.
 * 
 * @param {number} resHeight The new height of the game window.
 */
exports.setGameHeight = function(resHeight){
    config.settings.game.resHeight = resHeight
}

/**
 * Check if the game should be launched in fullscreen mode.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {boolean} Whether or not the game is set to launch in fullscreen mode.
 */
exports.isFullscreen = function(def = false){
    return !def ? config.settings.game.fullscreen : DEFAULT_CONFIG.settings.game.fullscreen
}

/**
 * Change the status of if the game should be launched in fullscreen mode.
 * 
 * @param {boolean} fullscreen Whether or not the game should launch in fullscreen mode.
 */
exports.setFullscreen = function(fullscreen){
    config.settings.game.fullscreen = fullscreen
}

/**
 * Check if the game should auto connect to servers.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {boolean} Whether or not the game should auto connect to servers.
 */
exports.isAutoConnect = function(def = false){
    return !def ? config.settings.game.autoConnect : DEFAULT_CONFIG.settings.game.autoConnect
}

/**
 * Change the status of whether or not the game should auto connect to servers.
 * 
 * @param {boolean} autoConnect Whether or not the game should auto connect to servers.
 */
exports.setAutoConnect = function(autoConnect){
    config.settings.game.autoConnect = autoConnect
}