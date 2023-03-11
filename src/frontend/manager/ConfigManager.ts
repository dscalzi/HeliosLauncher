import { ensureDirSync, moveSync } from "fs-extra";
import { LoggerUtil } from "helios-core/.";
import { existsSync, readFileSync, writeFileSync } from "fs-extra";
import os from 'os';
import { join } from 'path';
import { MinecraftUtil } from "../util/MinecraftUtil";
import { resolveMaxRAM, resolveMinRAM } from "../util/System";

const logger = LoggerUtil.getLogger("ConfigManager");

type Config = {
    settings: {
        game: {
            resWidth: number,
            resHeight: number,
            fullscreen: boolean,
            autoConnect: boolean,
            launchDetached: boolean,
        },
        launcher: {
            allowPrerelease: boolean,
            dataDirectory: string,
        },

    },
    newsCache: {
        date?: any,
        content?: any,
        dismissed: boolean,
    },
    clientToken?: string,
    selectedServer?: any, // Resolved
    selectedAccount?: any,
    authenticationDatabase: any,
    modConfigurations: any[],
    javaConfig: any,
}


export class ConfigManager {

    private static sysRoot = process.env.APPDATA ?? (process.platform == "darwin" ? process.env.HOME + "/Library/Application Support" : process.env.HOME) ?? "";
    // TODO change
    private static dataPath = join(this.sysRoot, ".randomia");
    private static configPath = join(exports.getLauncherDirectory(), "config.json");
    private static configPathLEGACY = join(this.dataPath, "config.json");
    private static firstLaunch = !existsSync(this.configPath) && !existsSync(this.configPathLEGACY);
    // Forked processes do not have access to electron, so we have this workaround.
    private static launcherDir = process.env.CONFIG_DIRECT_PATH ?? require("@electron/remote").app.getPath("userData");
    public static readonly DistributionURL = 'http://mc.westeroscraft.com/WesterosCraftLauncher/distribution.json';
    public static readonly launcherName = 'Helios-Launcher'
    public static readonly azureClientId = '1ce6e35a-126f-48fd-97fb-54d143ac6d45'
    /**
     * Three types of values:
     * Static = Explicitly declared.
     * Dynamic = Calculated by a private static function.
     * Resolved = Resolved externally, defaults to null.
     */
    private static DEFAULT_CONFIG: Config = {
        settings: {
            game: {
                resWidth: 1280,
                resHeight: 720,
                fullscreen: false,
                autoConnect: true,
                launchDetached: true,
            },
            launcher: {
                allowPrerelease: false,
                dataDirectory: this.dataPath,
            },
        },
        newsCache: {
            date: undefined,
            content: undefined,
            dismissed: false,
        },
        clientToken: undefined,
        selectedServer: undefined, // Resolved
        selectedAccount: undefined,
        authenticationDatabase: {},
        modConfigurations: [],
        javaConfig: {},
    }

    private static config: Config;

    /**
     * Retrieve the absolute path of the launcher directory.
     *
     * @returns {string} The absolute path of the launcher directory.
     */
    public static getLauncherDirectory() {
        return this.launcherDir;
    };

    /**
     * Get the launcher's data directory. This is where all files related
     * to game launch are installed (common, instances, java, etc).
     *
     * @returns {string} The absolute path of the launcher's data directory.
     */
    public static getDataDirectory(def = false) {
        return !def ? this.config.settings.launcher.dataDirectory : this.DEFAULT_CONFIG.settings.launcher.dataDirectory;
    };

    /**
     * Set the new data directory.
     *
     * @param {string} dataDirectory The new data directory.
     */
    public static setDataDirectory(dataDirectory: string) {
        this.config.settings.launcher.dataDirectory = dataDirectory;
    };



    public static getAbsoluteMinRAM() {
        const mem = os.totalmem();
        return mem >= 6000000000 ? 3 : 2;
    };

    public static getAbsoluteMaxRAM() {
        const mem = os.totalmem();
        const gT16 = mem - 16000000000;
        return Math.floor((mem - 1000000000 - (gT16 > 0 ? gT16 / 8 + 16000000000 / 4 : mem / 4)) / 1000000000);
    };

    /**
 * Save the current configuration to a file.
 */
    public static save() {
        writeFileSync(this.configPath, JSON.stringify(this.config, null, 4), { encoding: "utf-8" });
    };

    /**
     * Load the configuration into memory. If a configuration file exists,
     * that will be read and saved. Otherwise, a default configuration will
     * be generated. Note that "resolved" values default to null and will
     * need to be externally assigned.
     */
    public static load() {
        let doLoad = true;

        if (!existsSync(this.configPath)) {
            // Create all parent directories.
            ensureDirSync(join(this.configPath, ".."));
            if (existsSync(this.configPathLEGACY)) {
                moveSync(this.configPathLEGACY, this.configPath);
            } else {
                doLoad = false;
                this.config = this.DEFAULT_CONFIG;
                exports.save();
            }
        }
        if (doLoad) {
            let doValidate = false;
            try {
                this.config = JSON.parse(readFileSync(this.configPath, { encoding: "utf-8" }));
                doValidate = true;
            } catch (err) {
                logger.error(err);
                logger.info("Configuration file contains malformed JSON or is corrupt.");
                logger.info("Generating a new configuration file.");
                ensureDirSync(join(this.configPath, ".."));
                this.config = this.DEFAULT_CONFIG;
                exports.save();
            }
            if (doValidate) {
                this.config = this.validateKeySet(this.DEFAULT_CONFIG, this.config);
                exports.save();
            }
        }
        logger.info("Successfully Loaded");
    };

    /**
     * @returns {boolean} Whether or not the manager has been loaded.
     */
    public static get isLoaded() {
        return this.config != null;
    };



    /**
     * Check to see if this is the first time the user has launched the
     * application. This is determined by the existance of the data 
     *
     * @returns {boolean} True if this is the first launch, otherwise false.
     */
    public static get isFirstLaunch() {
        return this.firstLaunch;
    };

    /**
     * Returns the name of the folder in the OS temp directory which we
     * will use to extract and store native dependencies for game launch.
     *
     * @returns {string} The name of the folder.
     */
    public static get tempNativeFolder() {
        return "WCNatives";
    };

    // System Settings (Unconfigurable on UI)

    /**
     * Retrieve the news cache to determine
     * whether or not there is newer news.
     *
     * @returns {Object} The news cache object.
     */
    public static get getNewsCache() {
        return this.config.newsCache;
    };

    /**
     * Set the new news cache object.
     *
     * @param {Object} newsCache The new news cache object.
     */
    public static setNewsCache(newsCache: {
        date?: any;
        content?: any;
        dismissed: boolean;
    }) {
        this.config.newsCache = newsCache;
    };

    /**
     * Set whether or not the news has been dismissed (checked)
     *
     * @param {boolean} dismissed Whether or not the news has been dismissed (checked).
     */
    public static setNewsCacheDismissed(dismissed: boolean) {
        this.config.newsCache.dismissed = dismissed;
    };

    /**
     * Retrieve the common directory for shared
     * game files (assets, libraries, etc).
     *
     * @returns {string} The launcher's common directory.
     */
    public static get commonDirectory() {
        return join(exports.getDataDirectory(), "common");
    };

    /**
     * Retrieve the instance directory for the per
     * server game directories.
     *
     * @returns {string} The launcher's instance directory.
     */
    public static get instanceDirectory() {
        return join(exports.getDataDirectory(), "instances");
    };

    /**
     * Retrieve the launcher's Client Token.
     * There is no default client token.
     *
     * @returns {string} The launcher's Client Token.
     */
    public static get clientToken() {
        return this.config.clientToken;
    };

    /**
     * Set the launcher's Client Token.
     *
     * @param {string} clientToken The launcher's new Client Token.
     */
    public static set clientToken(clientToken) {
        this.config.clientToken = clientToken;
    };

    /**
     * Retrieve the ID of the selected serverpack.
     *
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {string} The ID of the selected serverpack.
     */
    public static getSelectedServer(def = false) {
        return !def ? this.config.selectedServer : this.DEFAULT_CONFIG.clientToken;
    };

    /**
     * Set the ID of the selected serverpack.
     *
     * @param {string} serverID The ID of the new selected serverpack.
     */
    public static set selectedServer(serverID: string) {
        this.config.selectedServer = serverID;
    };

    /**
     * Get an array of each account currently authenticated by the launcher.
     *
     * @returns {Array.<Object>} An array of each stored authenticated account.
     */
    public static get authAccounts() {
        return this.config.authenticationDatabase;
    };

    /**
     * Returns the authenticated account with the given uuid. Value may
     * be null.
     *
     * @param {string} uuid The uuid of the authenticated account.
     * @returns {Object} The authenticated account with the given uuid.
     */
    public static getAuthAccountByUuid(uuid: string) {
        return this.config.authenticationDatabase[uuid];
    };

    /**
     * Update the access token of an authenticated mojang account.
     *
     * @param {string} uuid The uuid of the authenticated account.
     * @param {string} accessToken The new Access Token.
     *
     * @returns {Object} The authenticated account object created by this action.
     */
    public static updateMojangAuthAccount(uuid: string, accessToken: string) {
        this.config.authenticationDatabase[uuid].accessToken = accessToken;
        this.config.authenticationDatabase[uuid].type = "mojang"; // For gradual conversion.
        return this.config.authenticationDatabase[uuid];
    };

    /**
     * Adds an authenticated mojang account to the database to be stored.
     *
     * @param {string} uuid The uuid of the authenticated account.
     * @param {string} accessToken The accessToken of the authenticated account.
     * @param {string} username The username (usually email) of the authenticated account.
     * @param {string} displayName The in game name of the authenticated account.
     *
     * @returns {Object} The authenticated account object created by this action.
     */
    public static addMojangAuthAccount(uuid: string, accessToken: string, username: string, displayName: string) {
        this.config.selectedAccount = uuid;
        this.config.authenticationDatabase[uuid] = {
            type: "mojang",
            accessToken,
            username: username.trim(),
            uuid: uuid.trim(),
            displayName: displayName.trim(),
        };
        return this.config.authenticationDatabase[uuid];
    };

    /**
     * Update the tokens of an authenticated microsoft account.
     *
     * @param {string} uuid The uuid of the authenticated account.
     * @param {string} accessToken The new Access Token.
     * @param {string} msAccessToken The new Microsoft Access Token
     * @param {string} msRefreshToken The new Microsoft Refresh Token
     * @param {date} msExpires The date when the microsoft access token expires
     * @param {date} mcExpires The date when the mojang access token expires
     *
     * @returns {Object} The authenticated account object created by this action.
     */
    public static updateMicrosoftAuthAccount(uuid: string, accessToken: string, msAccessToken: string, msRefreshToken: string, msExpires: string, mcExpires: string) {
        this.config.authenticationDatabase[uuid].accessToken = accessToken;
        this.config.authenticationDatabase[uuid].expiresAt = mcExpires;
        this.config.authenticationDatabase[uuid].microsoft.access_token = msAccessToken;
        this.config.authenticationDatabase[uuid].microsoft.refresh_token = msRefreshToken;
        this.config.authenticationDatabase[uuid].microsoft.expires_at = msExpires;
        return this.config.authenticationDatabase[uuid];
    };

    /**
     * Adds an authenticated microsoft account to the database to be stored.
     *
     * @param {string} uuid The uuid of the authenticated account.
     * @param {string} accessToken The accessToken of the authenticated account.
     * @param {string} name The in game name of the authenticated account.
     * @param {date} mcExpires The date when the mojang access token expires
     * @param {string} msAccessToken The microsoft access token
     * @param {string} msRefreshToken The microsoft refresh token
     * @param {date} msExpires The date when the microsoft access token expires
     *
     * @returns {Object} The authenticated account object created by this action.
     */
    public static addMicrosoftAuthAccount(
        uuid: string,
        accessToken: string,
        name: string,
        mcExpires: string,
        msAccessToken: string,
        msRefreshToken: string,
        msExpires: string
    ) {
        this.config.selectedAccount = uuid;
        this.config.authenticationDatabase[uuid] = {
            type: "microsoft",
            accessToken,
            username: name.trim(),
            uuid: uuid.trim(),
            displayName: name.trim(),
            expiresAt: mcExpires,
            microsoft: {
                access_token: msAccessToken,
                refresh_token: msRefreshToken,
                expires_at: msExpires,
            },
        };
        return this.config.authenticationDatabase[uuid];
    };

    /**
     * Remove an authenticated account from the database. If the account
     * was also the selected account, a new one will be selected. If there
     * are no accounts, the selected account will be null.
     *
     * @param {string} uuid The uuid of the authenticated account.
     *
     * @returns {boolean} True if the account was removed, false if it never existed.
     */
    public static removeAuthAccount(uuid: string) {
        if (this.config.authenticationDatabase[uuid] != null) {
            delete this.config.authenticationDatabase[uuid];
            if (this.config.selectedAccount === uuid) {
                const keys = Object.keys(this.config.authenticationDatabase);
                if (keys.length > 0) {
                    this.config.selectedAccount = keys[0];
                } else {
                    this.config.selectedAccount = null;
                    this.config.clientToken = undefined;
                }
            }
            return true;
        }
        return false;
    };

    /**
     * Get the currently selected authenticated account.
     *
     * @returns {Object} The selected authenticated account.
     */
    public static getSelectedAccount() {
        return this.config.authenticationDatabase[this.config.selectedAccount];
    };

    /**
     * Set the selected authenticated account.
     *
     * @param {string} uuid The UUID of the account which is to be set
     * as the selected account.
     *
     * @returns {Object} The selected authenticated account.
     */
    public static setSelectedAccount(uuid: string) {
        const authAcc = this.config.authenticationDatabase[uuid];
        if (authAcc != null) {
            this.config.selectedAccount = uuid;
        }
        return authAcc;
    };

    /**
     * Get an array of each mod configuration currently stored.
     *
     * @returns {Array.<Object>} An array of each stored mod configuration.
     */
    public static get modConfigurations() {
        return this.config.modConfigurations;
    };

    /**
     * Set the array of stored mod configurations.
     *
     * @param {Array.<Object>} configurations An array of mod configurations.
     */
    public static set modConfigurations(configurations) {
        this.config.modConfigurations = configurations;
    };

    /**
     * Get the mod configuration for a specific server.
     *
     * @param {string} serverid The id of the server.
     * @returns {Object} The mod configuration for the given server.
     */
    public static getModConfigurationForServer(serverid: string) {
        const cfgs = this.config.modConfigurations;
        for (let i = 0; i < cfgs.length; i++) {
            if (cfgs[i].id === serverid) {
                return cfgs[i];
            }
        }
        return null;
    };

    /**
     * Set the mod configuration for a specific server. This overrides any existing value.
     *
     * @param {string} serverid The id of the server for the given mod configuration.
     * @param {Object} configuration The mod configuration for the given server.
     */
    public static setModConfigurationForServer(serverid: string, configuration) {
        const cfgs = this.config.modConfigurations;
        for (let i = 0; i < cfgs.length; i++) {
            if (cfgs[i].id === serverid) {
                cfgs[i] = configuration;
                return;
            }
        }
        cfgs.push(configuration);
    };


    ///////////////////////////////////// JAVA CONFIG ////////////////////////////////////////////


    // User Configurable Settings

    // Java Settings

    /**
     * Ensure a java config property is set for the given server.
     *
     * @param {string} serverid The server id.
     * @param {*} mcVersion The minecraft version of the server.
     */
    public static ensureJavaConfig(serverid: string, mcVersion: string) {
        if (!Object.prototype.hasOwnProperty.call(this.config.javaConfig, serverid)) {
            this.config.javaConfig[serverid] = this.defaultJavaConfig(mcVersion);
        }
    };

    /**
     * Retrieve the minimum amount of memory for JVM initialization. This value
     * contains the units of memory. For example, '5G' = 5 GigaBytes, '1024M' =
     * 1024 MegaBytes, etc.
     *
     * @param {string} serverid The server id.
     * @returns {string} The minimum amount of memory for JVM initialization.
     */
    public static getMinRAM(serverid: string) {
        return this.config.javaConfig[serverid].minRAM;
    };

    /**
     * Set the minimum amount of memory for JVM initialization. This value should
     * contain the units of memory. For example, '5G' = 5 GigaBytes, '1024M' =
     * 1024 MegaBytes, etc.
     *
     * @param {string} serverid The server id.
     * @param {string} minRAM The new minimum amount of memory for JVM initialization.
     */
    public static setMinRAM(serverid: string, minRAM: string) {
        this.config.javaConfig[serverid].minRAM = minRAM;
    };

    /**
     * Retrieve the maximum amount of memory for JVM initialization. This value
     * contains the units of memory. For example, '5G' = 5 GigaBytes, '1024M' =
     * 1024 MegaBytes, etc.
     *
     * @param {string} serverid The server id.
     * @returns {string} The maximum amount of memory for JVM initialization.
     */
    public static getMaxRAM(serverid: string) {
        return this.config.javaConfig[serverid].maxRAM;
    };

    /**
     * Set the maximum amount of memory for JVM initialization. This value should
     * contain the units of memory. For example, '5G' = 5 GigaBytes, '1024M' =
     * 1024 MegaBytes, etc.
     *
     * @param {string} serverid The server id.
     * @param {string} maxRAM The new maximum amount of memory for JVM initialization.
     */
    public static setMaxRAM(serverid: string, maxRAM: string) {
        this.config.javaConfig[serverid].maxRAM = maxRAM;
    };

    /**
     * Retrieve the path of the Java Executable.
     *
     * This is a resolved configuration value and defaults to null until externally assigned.
     *
     * @param {string} serverid The server id.
     * @returns {string} The path of the Java Executable.
     */
    public static getJavaExecutable(serverid: string) {
        return this.config.javaConfig[serverid].executable;
    };

    /**
     * Set the path of the Java Executable.
     *
     * @param {string} serverid The server id.
     * @param {string} executable The new path of the Java Executable.
     */
    public static setJavaExecutable(serverid: string, executable: string) {
        this.config.javaConfig[serverid].executable = executable;
    };

    /**
     * Retrieve the additional arguments for JVM initialization. Required arguments,
     * such as memory allocation, will be dynamically resolved and will not be included
     * in this value.
     *
     * @param {string} serverid The server id.
     * @returns {Array.<string>} An array of the additional arguments for JVM initialization.
     */
    public static getJVMOptions(serverid: string) {
        return this.config.javaConfig[serverid].jvmOptions;
    };

    /**
     * Set the additional arguments for JVM initialization. Required arguments,
     * such as memory allocation, will be dynamically resolved and should not be
     * included in this value.
     *
     * @param {string} serverid The server id.
     * @param {Array.<string>} jvmOptions An array of the new additional arguments for JVM
     * initialization.
     */
    public static setJVMOptions(serverid: string, jvmOptions: string[]) {
        this.config.javaConfig[serverid].jvmOptions = jvmOptions;
    };

    // Game Settings

    /**
     * Retrieve the width of the game window.
     *
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {number} The width of the game window.
     */
    public static getGameWidth(def = false) {
        return !def ? this.config.settings.game.resWidth : this.DEFAULT_CONFIG.settings.game.resWidth;
    };

    /**
     * Set the width of the game window.
     *
     * @param {number} resWidth The new width of the game window.
     */
    public static setGameWidth(resWidth: number) {
        if (typeof resWidth !== "number") throw new Error("Only Accept Number")
        this.config.settings.game.resWidth = resWidth;
    };

    /**
     * Validate a potential new width value.
     *
     * @param {number} resWidth The width value to validate.
     * @returns {boolean} Whether or not the value is valid.
     */
    public static validateGameWidth(resWidth: number) {
        if (typeof resWidth !== "number") throw new Error("Only Accept Number")
        return Number.isInteger(resWidth) && resWidth >= 0;
    };

    /**
     * Retrieve the height of the game window.
     *
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {number} The height of the game window.
     */
    public static getGameHeight(def = false) {
        return !def ? this.config.settings.game.resHeight : this.DEFAULT_CONFIG.settings.game.resHeight;
    };

    /**
     * Set the height of the game window.
     *
     * @param {number} resHeight The new height of the game window.
     */
    public static setGameHeight(resHeight: number) {
        if (typeof resHeight !== "number") throw new Error("Only Accept Number")
        this.config.settings.game.resHeight = resHeight;
    };

    /**
     * Validate a potential new height value.
     *
     * @param {number} resHeight The height value to validate.
     * @returns {boolean} Whether or not the value is valid.
     */
    public static validateGameHeight(resHeight: number) {
        if (typeof resHeight !== "number") throw new Error("Only Accept Number")
        return Number.isInteger(resHeight) && resHeight >= 0;
    };

    /**
     * Check if the game should be launched in fullscreen mode.
     *
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {boolean} Whether or not the game is set to launch in fullscreen mode.
     */
    public static getFullscreen(def = false) {
        return !def ? this.config.settings.game.fullscreen : this.DEFAULT_CONFIG.settings.game.fullscreen;
    };

    /**
     * Change the status of if the game should be launched in fullscreen mode.
     *
     * @param {boolean} fullscreen Whether or not the game should launch in fullscreen mode.
     */
    public static setFullscreen(fullscreen: boolean) {
        this.config.settings.game.fullscreen = fullscreen;
    };

    /**
     * Check if the game should auto connect to servers.
     *
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {boolean} Whether or not the game should auto connect to servers.
     */
    public static getAutoConnect(def = false) {
        return !def ? this.config.settings.game.autoConnect : this.DEFAULT_CONFIG.settings.game.autoConnect;
    };

    /**
     * Change the status of whether or not the game should auto connect to servers.
     *
     * @param {boolean} autoConnect Whether or not the game should auto connect to servers.
     */
    public static setAutoConnect(autoConnect: boolean) {
        this.config.settings.game.autoConnect = autoConnect;
    };

    /**
     * Check if the game should launch as a detached process.
     *
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {boolean} Whether or not the game will launch as a detached process.
     */
    public static getLaunchDetached(def = false) {
        return !def ? this.config.settings.game.launchDetached : this.DEFAULT_CONFIG.settings.game.launchDetached;
    };

    /**
     * Change the status of whether or not the game should launch as a detached process.
     *
     * @param {boolean} launchDetached Whether or not the game should launch as a detached process.
     */
    public static setLaunchDetached(launchDetached: boolean) {
        this.config.settings.game.launchDetached = launchDetached;
    };

    // Launcher Settings

    /**
     * Check if the launcher should download prerelease versions.
     *
     * @param {boolean} def Optional. If true, the default value will be returned.
     * @returns {boolean} Whether or not the launcher should download prerelease versions.
     */
    public static getAllowPrerelease(def = false) {
        return !def ? this.config.settings.launcher.allowPrerelease : this.DEFAULT_CONFIG.settings.launcher.allowPrerelease;
    };

    /**
     * Change the status of Whether or not the launcher should download prerelease versions.
     *
     * @param {boolean} launchDetached Whether or not the launcher should download prerelease versions.
     */
    public static setAllowPrerelease(allowPrerelease: boolean) {
        this.config.settings.launcher.allowPrerelease = allowPrerelease;
    };

    private static defaultJavaConfig(mcVersion: string) {
        if (MinecraftUtil.mcVersionAtLeast("1.17", mcVersion)) {
            return this.defaultJavaConfig117();
        } else {
            return this.defaultJavaConfigBelow117();
        }
    }

    private static defaultJavaConfigBelow117() {
        return {
            minRAM: resolveMinRAM(),
            maxRAM: resolveMaxRAM(), // Dynamic
            executable: null,
            jvmOptions: ["-XX:+UseConcMarkSweepGC", "-XX:+CMSIncrementalMode", "-XX:-UseAdaptiveSizePolicy", "-Xmn128M"],
        };
    }

    private static defaultJavaConfig117() {
        return {
            minRAM: resolveMinRAM(),
            maxRAM: resolveMaxRAM(), // Dynamic
            executable: null,
            jvmOptions: ["-XX:+UnlockExperimentalVMOptions", "-XX:+UseG1GC", "-XX:G1NewSizePercent=20", "-XX:G1ReservePercent=20", "-XX:MaxGCPauseMillis=50", "-XX:G1HeapRegionSize=32M"],
        };
    }

    /**
     * Validate that the destination object has at least every field
     * present in the source object. Assign a default value otherwise.
     *
     * @param {Object} srcObj The source object to reference against.
     * @param {Object} destObj The destination object.
     * @returns {Object} A validated destination object.
     */
    private static validateKeySet(srcObj, destObj) {
        if (srcObj == null) {
            srcObj = {};
        }
        const validationBlacklist = ["authenticationDatabase", "javaConfig"];
        const keys = Object.keys(srcObj);
        for (let i = 0; i < keys.length; i++) {
            if (typeof destObj[keys[i]] === "undefined") {
                destObj[keys[i]] = srcObj[keys[i]];
            } else if (typeof srcObj[keys[i]] === "object" && srcObj[keys[i]] != null && !(srcObj[keys[i]] instanceof Array) && validationBlacklist.indexOf(keys[i]) === -1) {
                destObj[keys[i]] = this.validateKeySet(srcObj[keys[i]], destObj[keys[i]]);
            }
        }
        return destObj;
    }


}

