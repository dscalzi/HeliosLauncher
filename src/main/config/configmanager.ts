import { join } from 'path'
import { pathExistsSync, writeFileSync, ensureDirSync, readFileSync } from 'fs-extra'
import { totalmem } from 'os'
import { SavedAccount } from './model/SavedAccount'
import { LauncherConfig } from './model/LauncherConfig'
import { ModConfig } from './model/ModConfig'
import { NewsCache } from './model/NewsCache'
import { LoggerUtil } from '../logging/loggerutil'

// TODO final review upon usage in implementation.

export class ConfigManager {

    private static readonly logger = LoggerUtil.getLogger('ConfigManager')
    private static readonly sysRoot = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME)
    private static readonly dataPath = join(ConfigManager.sysRoot as string, '.helioslauncher')

    // Forked processes do not have access to electron, so we have this workaround.
    private static readonly launcherDir = process.env.CONFIG_DIRECT_PATH || require('electron').remote.app.getPath('userData')

    /**
     * Retrieve the absolute path of the launcher directory.
     * 
     * @returns {string} The absolute path of the launcher directory.
     */
    public static getLauncherDirectory(){
        return ConfigManager.launcherDir
    }

    /**
     * Get the launcher's data directory. This is where all files related
     * to game launch are installed (common, instances, java, etc).
     * 
     * @returns {string} The absolute path of the launcher's data directory.
     */
    public static getDataDirectory(def = false){
        return !def ? ConfigManager.config.settings.launcher.dataDirectory : ConfigManager.DEFAULT_CONFIG.settings.launcher.dataDirectory
    }

    /**
     * Set the new data directory.
     * 
     * @param {string} dataDirectory The new data directory.
     */
    public static setDataDirectory(dataDirectory: string){
        ConfigManager.config.settings.launcher.dataDirectory = dataDirectory
    }

    private static readonly configPath = join(ConfigManager.getLauncherDirectory(), 'config.json')
    private static readonly firstLaunch = !pathExistsSync(ConfigManager.configPath)

    /**
     * Three types of values:
     * Static = Explicitly declared.
     * Dynamic = Calculated by a private function.
     * Resolved = Resolved externally, defaults to null.
     */
    private static readonly DEFAULT_CONFIG: LauncherConfig = {
        settings: {
            java: {
                minRAM: ConfigManager.resolveMinRAM(),
                maxRAM: ConfigManager.resolveMaxRAM(), // Dynamic
                executable: null,
                jvmOptions: [
                    '-XX:+UseConcMarkSweepGC',
                    '-XX:+CMSIncrementalMode',
                    '-XX:-UseAdaptiveSizePolicy',
                    '-Xmn128M'
                ]
            },
            game: {
                resWidth: 1280,
                resHeight: 720,
                fullscreen: false,
                autoConnect: true,
                launchDetached: true
            },
            launcher: {
                allowPrerelease: false,
                dataDirectory: ConfigManager.dataPath
            }
        },
        newsCache: {
            date: null,
            content: null,
            dismissed: false
        },
        clientToken: null,
        selectedServer: null, // Resolved
        selectedAccount: null,
        authenticationDatabase: {},
        modConfigurations: []
    }

    private static config: LauncherConfig = null as unknown as LauncherConfig

    public static getAbsoluteMinRAM(){
        const mem = totalmem()
        return mem >= 6000000000 ? 3 : 2
    }
    
    public static getAbsoluteMaxRAM(){
        const mem = totalmem()
        const gT16 = mem-16000000000
        return Math.floor((mem-1000000000-(gT16 > 0 ? (Number.parseInt(gT16/8 as unknown as string) + 16000000000/4) : mem/4))/1000000000)
    }
    
    private static resolveMaxRAM(){
        const mem = totalmem()
        return mem >= 8000000000 ? '4G' : (mem >= 6000000000 ? '3G' : '2G')
    }
    
    private static resolveMinRAM(){
        return ConfigManager.resolveMaxRAM()
    }

    // Persistance Utility Functions

    /**
     * Save the current configuration to a file.
     */
    public static save(){
        writeFileSync(ConfigManager.configPath, JSON.stringify(ConfigManager.config, null, 4), 'UTF-8')
    }

    /**
     * Load the configuration into memory. If a configuration file exists,
     * that will be read and saved. Otherwise, a default configuration will
     * be generated. Note that "resolved" values default to null and will
     * need to be externally assigned.
     */
    public static load(){
        let doLoad = true

        if(!pathExistsSync(ConfigManager.configPath)){
            // Create all parent directories.
            ensureDirSync(join(ConfigManager.configPath, '..'))
            doLoad = false
            ConfigManager.config = ConfigManager.DEFAULT_CONFIG
            ConfigManager.save()
        }
        if(doLoad){
            let doValidate = false
            try {
                ConfigManager.config = JSON.parse(readFileSync(ConfigManager.configPath, 'UTF-8'))
                doValidate = true
            } catch (err){
                ConfigManager.logger.error(err)
                ConfigManager.logger.info('Configuration file contains malformed JSON or is corrupt.')
                ConfigManager.logger.info('Generating a new configuration file.')
                ensureDirSync(join(ConfigManager.configPath, '..'))
                ConfigManager.config = ConfigManager.DEFAULT_CONFIG
                ConfigManager.save()
            }
            if(doValidate){
                ConfigManager.config = ConfigManager.validateKeySet(ConfigManager.DEFAULT_CONFIG, ConfigManager.config)
                ConfigManager.save()
            }
        }
        ConfigManager.logger.info('Successfully Loaded')
    }

    /**
     * @returns {boolean} Whether or not the manager has been loaded.
     */
    public static isLoaded(): boolean {
        return ConfigManager.config != null
    }

    /**
     * Validate that the destination object has at least every field
     * present in the source object. Assign a default value otherwise.
     * 
     * @param {Object} srcObj The source object to reference against.
     * @param {Object} destObj The destination object.
     * @returns {Object} A validated destination object.
     */
    private static validateKeySet(srcObj: any, destObj: any){
        if(srcObj == null){
            srcObj = {}
        }
        const validationBlacklist = ['authenticationDatabase']
        const keys = Object.keys(srcObj)
        for(let i=0; i<keys.length; i++){
            if(typeof destObj[keys[i]] === 'undefined'){
                destObj[keys[i]] = srcObj[keys[i]]
            } else if(typeof srcObj[keys[i]] === 'object' && srcObj[keys[i]] != null && !(srcObj[keys[i]] instanceof Array) && validationBlacklist.indexOf(keys[i]) === -1){
                destObj[keys[i]] = ConfigManager.validateKeySet(srcObj[keys[i]], destObj[keys[i]])
            }
        }
        return destObj
    }

    /**
     * Check to see if this is the first time the user has launched the
     * application. This is determined by the existance of the data path.
     * 
     * @returns {boolean} True if this is the first launch, otherwise false.
     */
    public static isFirstLaunch(): boolean {
        return ConfigManager.firstLaunch
    }

    /**
     * Returns the name of the folder in the OS temp directory which we
     * will use to extract and store native dependencies for game launch.
     * 
     * @returns {string} The name of the folder.
     */
    public static getTempNativeFolder(): string {
        return 'HeliosLauncherNatives'
    }

    // System Settings (Unconfigurable on UI)

    /**
     * Retrieve the news cache to determine
     * whether or not there is newer news.
     * 
     * @returns {NewsCache} The news cache object.
     */
    public static getNewsCache(): NewsCache {
        return ConfigManager.config.newsCache
    }

    /**
     * Set the new news cache object.
     * 
     * @param {Object} newsCache The new news cache object.
     */
    public static setNewsCache(newsCache: any): void {
        ConfigManager.config.newsCache = newsCache
    }

    /**
     * Set whether or not the news has been dismissed (checked)
     * 
     * @param {boolean} dismissed Whether or not the news has been dismissed (checked).
     */
    public static setNewsCacheDismissed(dismissed: boolean): void {
        ConfigManager.config.newsCache.dismissed = dismissed
    }

    /**
     * Retrieve the common directory for shared
     * game files (assets, libraries, etc).
     * 
     * @returns {string} The launcher's common directory.
     */
    public static getCommonDirectory(): string {
        return join(ConfigManager.getDataDirectory(), 'common')
    }

    /**
     * Retrieve the instance directory for the per
     * server game directories.
     * 
     * @returns {string} The launcher's instance directory.
     */
    public static getInstanceDirectory(): string {
        return join(ConfigManager.getDataDirectory(), 'instances')
    }

    /**
     * Retrieve the launcher's Client Token.
     * There is no default client token.
     * 
     * @returns {string | null} The launcher's Client Token.
     */
    public static getClientToken(): string | null {
        return ConfigManager.config.clientToken
    }

    /**
     * Set the launcher's Client Token.
     * 
     * @param {string} clientToken The launcher's new Client Token.
     */
    public static setClientToken(clientToken: string): void {
        ConfigManager.config.clientToken = clientToken
    }

    /**
     * Retrieve the ID of the selected serverpack.
     * 
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {string | null} The ID of the selected serverpack.
     */
    public static getSelectedServer(def = false): string | null {
        return !def ? ConfigManager.config.selectedServer : ConfigManager.DEFAULT_CONFIG.selectedServer
    }

    /**
     * Set the ID of the selected serverpack.
     * 
     * @param {string} serverID The ID of the new selected serverpack.
     */
    public static setSelectedServer(serverID: string): void {
        ConfigManager.config.selectedServer = serverID
    }

    /**
     * Get an array of each account currently authenticated by the launcher.
     * 
     * @returns {Array.<SavedAccount>} An array of each stored authenticated account.
     */
    public static getAuthAccounts(): {[uuid: string]: SavedAccount} {
        return ConfigManager.config.authenticationDatabase
    }

    /**
     * Returns the authenticated account with the given uuid. Value may
     * be null.
     * 
     * @param {string} uuid The uuid of the authenticated account.
     * @returns {SavedAccount} The authenticated account with the given uuid.
     */
    public static getAuthAccount(uuid: string): SavedAccount {
        return ConfigManager.config.authenticationDatabase[uuid]
    }

    /**
     * Update the access token of an authenticated account.
     * 
     * @param {string} uuid The uuid of the authenticated account.
     * @param {string} accessToken The new Access Token.
     * 
     * @returns {SavedAccount} The authenticated account object created by this action.
     */
    public static updateAuthAccount(uuid: string, accessToken: string): SavedAccount {
        ConfigManager.config.authenticationDatabase[uuid].accessToken = accessToken
        return ConfigManager.config.authenticationDatabase[uuid]
    }

    /**
     * Adds an authenticated account to the database to be stored.
     * 
     * @param {string} uuid The uuid of the authenticated account.
     * @param {string} accessToken The accessToken of the authenticated account.
     * @param {string} username The username (usually email) of the authenticated account.
     * @param {string} displayName The in game name of the authenticated account.
     * 
     * @returns {SavedAccount} The authenticated account object created by this action.
     */
    public static addAuthAccount(
        uuid: string,
        accessToken: string,
        username: string,
        displayName: string
    ): SavedAccount {
        ConfigManager.config.selectedAccount = uuid
        ConfigManager.config.authenticationDatabase[uuid] = {
            accessToken,
            username: username.trim(),
            uuid: uuid.trim(),
            displayName: displayName.trim()
        }
        return ConfigManager.config.authenticationDatabase[uuid]
    }

    /**
     * Remove an authenticated account from the database. If the account
     * was also the selected account, a new one will be selected. If there
     * are no accounts, the selected account will be null.
     * 
     * @param {string} uuid The uuid of the authenticated account.
     * 
     * @returns {boolean} True if the account was removed, false if it never existed.
     */
    public static removeAuthAccount(uuid: string): boolean {
        if(ConfigManager.config.authenticationDatabase[uuid] != null){
            delete ConfigManager.config.authenticationDatabase[uuid]
            if(ConfigManager.config.selectedAccount === uuid){
                const keys = Object.keys(ConfigManager.config.authenticationDatabase)
                if(keys.length > 0){
                    ConfigManager.config.selectedAccount = keys[0]
                } else {
                    ConfigManager.config.selectedAccount = null
                    ConfigManager.config.clientToken = null
                }
            }
            return true
        }
        return false
    }

    /**
     * Get the currently selected authenticated account.
     * 
     * @returns {SavedAccount | null} The selected authenticated account.
     */
    public static getSelectedAccount(): SavedAccount | null {
        return ConfigManager.config.selectedAccount == null ? 
                null : 
                ConfigManager.config.authenticationDatabase[ConfigManager.config.selectedAccount]
    }

    /**
     * Set the selected authenticated account.
     * 
     * @param {string} uuid The UUID of the account which is to be set
     * as the selected account.
     * 
     * @returns {SavedAccount} The selected authenticated account.
     */
    public static setSelectedAccount(uuid: string): SavedAccount {
        const authAcc = ConfigManager.config.authenticationDatabase[uuid]
        if(authAcc != null) {
            ConfigManager.config.selectedAccount = uuid
        }
        return authAcc
    }

    /**
     * Get an array of each mod configuration currently stored.
     * 
     * @returns {Array.<ModConfig>} An array of each stored mod configuration.
     */
    public static getModConfigurations(): ModConfig[] {
        return ConfigManager.config.modConfigurations
    }

    /**
     * Set the array of stored mod configurations.
     * 
     * @param {Array.<ModConfig>} configurations An array of mod configurations.
     */
    public static setModConfigurations(configurations: ModConfig[]): void {
        ConfigManager.config.modConfigurations = configurations
    }

    /**
     * Get the mod configuration for a specific server.
     * 
     * @param {string} serverid The id of the server.
     * @returns {ModConfig | null} The mod configuration for the given server.
     */
    public static getModConfiguration(serverid: string): ModConfig | null {
        const cfgs = ConfigManager.config.modConfigurations
        for(let i=0; i<cfgs.length; i++){
            if(cfgs[i].id === serverid){
                return cfgs[i]
            }
        }
        return null
    }

    /**
     * Set the mod configuration for a specific server. This overrides any existing value.
     * 
     * @param {string} serverid The id of the server for the given mod configuration.
     * @param {ModConfig} configuration The mod configuration for the given server.
     */
    public static setModConfiguration(serverid: string, configuration: ModConfig): void {
        const cfgs = ConfigManager.config.modConfigurations
        for(let i=0; i<cfgs.length; i++){
            if(cfgs[i].id === serverid){
                cfgs[i] = configuration
                return
            }
        }
        cfgs.push(configuration)
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
    public static getMinRAM(def = false): string {
        return !def ? ConfigManager.config.settings.java.minRAM : ConfigManager.DEFAULT_CONFIG.settings.java.minRAM
    }

    /**
     * Set the minimum amount of memory for JVM initialization. This value should
     * contain the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
     * 1024 MegaBytes, etc.
     * 
     * @param {string} minRAM The new minimum amount of memory for JVM initialization.
     */
    public static setMinRAM(minRAM: string): void {
        ConfigManager.config.settings.java.minRAM = minRAM
    }

    /**
     * Retrieve the maximum amount of memory for JVM initialization. This value
     * contains the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
     * 1024 MegaBytes, etc.
     * 
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {string} The maximum amount of memory for JVM initialization.
     */
    public static getMaxRAM(def = false): string {
        return !def ? ConfigManager.config.settings.java.maxRAM : ConfigManager.resolveMaxRAM()
    }

    /**
     * Set the maximum amount of memory for JVM initialization. This value should
     * contain the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
     * 1024 MegaBytes, etc.
     * 
     * @param {string} maxRAM The new maximum amount of memory for JVM initialization.
     */
    public static setMaxRAM(maxRAM: string): void {
        ConfigManager.config.settings.java.maxRAM = maxRAM
    }

    /**
     * Retrieve the path of the Java Executable.
     * 
     * This is a resolved configuration value and defaults to null until externally assigned.
     * 
     * @returns {string | null} The path of the Java Executable.
     */
    public static getJavaExecutable(): string | null {
        return ConfigManager.config.settings.java.executable
    }

    /**
     * Set the path of the Java Executable.
     * 
     * @param {string} executable The new path of the Java Executable.
     */
    public static setJavaExecutable(executable: string): void {
        ConfigManager.config.settings.java.executable = executable
    }

    /**
     * Retrieve the additional arguments for JVM initialization. Required arguments,
     * such as memory allocation, will be dynamically resolved and will not be included
     * in this value.
     * 
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {Array.<string>} An array of the additional arguments for JVM initialization.
     */
    public static getJVMOptions(def = false): string[] {
        return !def ? ConfigManager.config.settings.java.jvmOptions : ConfigManager.DEFAULT_CONFIG.settings.java.jvmOptions
    }

    /**
     * Set the additional arguments for JVM initialization. Required arguments,
     * such as memory allocation, will be dynamically resolved and should not be
     * included in this value.
     * 
     * @param {Array.<string>} jvmOptions An array of the new additional arguments for JVM 
     * initialization.
     */
    public static setJVMOptions(jvmOptions: string[]): void {
        ConfigManager.config.settings.java.jvmOptions = jvmOptions
    }

    // Game Settings

    /**
     * Retrieve the width of the game window.
     * 
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {number} The width of the game window.
     */
    public static getGameWidth(def = false): number {
        return !def ? ConfigManager.config.settings.game.resWidth : ConfigManager.DEFAULT_CONFIG.settings.game.resWidth
    }

    /**
     * Set the width of the game window.
     * 
     * @param {number} resWidth The new width of the game window.
     */
    public static setGameWidth(resWidth: number): void {
        ConfigManager.config.settings.game.resWidth = Number.parseInt(resWidth as unknown as string)
    }

    /**
     * Validate a potential new width value.
     * 
     * @param {number} resWidth The width value to validate.
     * @returns {boolean} Whether or not the value is valid.
     */
    public static validateGameWidth(resWidth: number): boolean {
        const nVal = Number.parseInt(resWidth as unknown as string)
        return Number.isInteger(nVal) && nVal >= 0
    }

    /**
     * Retrieve the height of the game window.
     * 
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {number} The height of the game window.
     */
    public static getGameHeight(def = false): number {
        return !def ? ConfigManager.config.settings.game.resHeight : ConfigManager.DEFAULT_CONFIG.settings.game.resHeight
    }

    /**
     * Set the height of the game window.
     * 
     * @param {number} resHeight The new height of the game window.
     */
    public static setGameHeight(resHeight: number): void {
        ConfigManager.config.settings.game.resHeight = Number.parseInt(resHeight as unknown as string)
    }

    /**
     * Validate a potential new height value.
     * 
     * @param {number} resHeight The height value to validate.
     * @returns {boolean} Whether or not the value is valid.
     */
    public static validateGameHeight(resHeight: number): boolean {
        const nVal = Number.parseInt(resHeight as unknown as string)
        return Number.isInteger(nVal) && nVal >= 0
    }

    /**
     * Check if the game should be launched in fullscreen mode.
     * 
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {boolean} Whether or not the game is set to launch in fullscreen mode.
     */
    public static getFullscreen(def = false): boolean {
        return !def ? ConfigManager.config.settings.game.fullscreen : ConfigManager.DEFAULT_CONFIG.settings.game.fullscreen
    }

    /**
     * Change the status of if the game should be launched in fullscreen mode.
     * 
     * @param {boolean} fullscreen Whether or not the game should launch in fullscreen mode.
     */
    public static setFullscreen(fullscreen: boolean): void {
        ConfigManager.config.settings.game.fullscreen = fullscreen
    }

    /**
     * Check if the game should auto connect to servers.
     * 
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {boolean} Whether or not the game should auto connect to servers.
     */
    public static getAutoConnect(def = false): boolean {
        return !def ? ConfigManager.config.settings.game.autoConnect : ConfigManager.DEFAULT_CONFIG.settings.game.autoConnect
    }

    /**
     * Change the status of whether or not the game should auto connect to servers.
     * 
     * @param {boolean} autoConnect Whether or not the game should auto connect to servers.
     */
    public static setAutoConnect(autoConnect: boolean): void {
        ConfigManager.config.settings.game.autoConnect = autoConnect
    }

    /**
     * Check if the game should launch as a detached process.
     * 
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {boolean} Whether or not the game will launch as a detached process.
     */
    public static getLaunchDetached(def = false): boolean {
        return !def ? ConfigManager.config.settings.game.launchDetached : ConfigManager.DEFAULT_CONFIG.settings.game.launchDetached
    }

    /**
     * Change the status of whether or not the game should launch as a detached process.
     * 
     * @param {boolean} launchDetached Whether or not the game should launch as a detached process.
     */
    public static setLaunchDetached(launchDetached: boolean): void {
        ConfigManager.config.settings.game.launchDetached = launchDetached
    }

    // Launcher Settings

    /**
     * Check if the launcher should download prerelease versions.
     * 
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {boolean} Whether or not the launcher should download prerelease versions.
     */
    public static getAllowPrerelease(def = false): boolean {
        return !def ? ConfigManager.config.settings.launcher.allowPrerelease : ConfigManager.DEFAULT_CONFIG.settings.launcher.allowPrerelease
    }

    /**
     * Change the status of Whether or not the launcher should download prerelease versions.
     * 
     * @param {boolean} launchDetached Whether or not the launcher should download prerelease versions.
     */
    public static setAllowPrerelease(allowPrerelease: boolean): void {
        ConfigManager.config.settings.launcher.allowPrerelease = allowPrerelease
    }

}
