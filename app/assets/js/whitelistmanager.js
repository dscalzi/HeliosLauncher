/**
 * Système de Whitelist pour Helios Launcher
 * Vérifie si un joueur est dans la whitelist via l'API Mojang
 * Configuration par distribution.json
 * 
 * @author Helios Launcher Whitelist System
 * @version 1.0.0
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class WhitelistManager {
    constructor() {
        this.whitelistCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes de cache
        this.loggerWhitelist = LoggerUtil.getLogger('Whitelist');
    }

    /**
     * Récupère l'UUID d'un joueur via l'API Mojang
     * @param {string} username - Nom d'utilisateur Minecraft
     * @returns {Promise<string|null>} UUID du joueur ou null
     */
    async getMojangUUID(username) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.mojang.com',
                path: `/users/profiles/minecraft/${username}`,
                method: 'GET',
                headers: {
                    'User-Agent': 'HeliosLauncher/1.0'
                }
            };

            this.loggerWhitelist.info(`Fetching UUID for ${username} from Mojang API...`);

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const json = JSON.parse(data);
                            this.loggerWhitelist.info(`UUID found for ${username}: ${json.id}`);
                            resolve(json.id);
                        } catch (e) {
                            this.loggerWhitelist.error('Invalid JSON response from Mojang API', e);
                            reject(new Error('Invalid JSON response from Mojang API'));
                        }
                    } else if (res.statusCode === 204 || res.statusCode === 404) {
                        this.loggerWhitelist.warn(`Player ${username} not found on Mojang servers (status ${res.statusCode})`);
                        resolve(null);
                    } else if (res.statusCode === 429) {
                        this.loggerWhitelist.error('Mojang API rate limit exceeded');
                        reject(new Error('Rate limit dépassé. Veuillez réessayer dans quelques instants.'));
                    } else {
                        this.loggerWhitelist.error(`Mojang API returned status ${res.statusCode}`);
                        reject(new Error(`Mojang API returned status ${res.statusCode}`));
                    }
                });
            });

            req.on('error', (error) => {
                this.loggerWhitelist.error('Error contacting Mojang API', error);
                reject(new Error(`Impossible de contacter l'API Mojang: ${error.message}`));
            });

            req.setTimeout(10000, () => {
                req.destroy();
                this.loggerWhitelist.error('Mojang API request timeout');
                reject(new Error('Délai d\'attente dépassé lors de la connexion à l\'API Mojang'));
            });

            req.end();
        });
    }

    /**
     * Vérifie si un joueur est whitelisté pour une instance
     * @param {string} username - Nom d'utilisateur
     * @param {Object} serverConfig - Configuration du serveur depuis distribution.json
     * @returns {Promise<Object>} Résultat de la vérification
     */
    async checkWhitelist(username, serverConfig) {
        this.loggerWhitelist.info(`Checking whitelist for ${username} on server ${serverConfig.id}`);

        if (!serverConfig.whitelist || !serverConfig.whitelist.enabled) {
            this.loggerWhitelist.info('Whitelist is disabled for this server');
            return { 
                allowed: true, 
                reason: 'Whitelist désactivée' 
            };
        }

        const whitelistType = serverConfig.whitelist.type || 'username';
        const whitelistEntries = serverConfig.whitelist.entries || [];

        this.loggerWhitelist.info(`Whitelist type: ${whitelistType}, entries count: ${whitelistEntries.length}`);

        if (whitelistType === 'username') {
            const isWhitelisted = whitelistEntries.some(
                entry => entry.toLowerCase() === username.toLowerCase()
            );

            if (isWhitelisted) {
                this.loggerWhitelist.info(`✓ ${username} is whitelisted (by username)`);
            } else {
                this.loggerWhitelist.warn(`✗ ${username} is NOT whitelisted (by username)`);
            }

            return {
                allowed: isWhitelisted,
                reason: isWhitelisted 
                    ? 'Joueur autorisé' 
                    : 'Vous n\'êtes pas dans la whitelist de cette instance'
            };
        }

        if (whitelistType === 'uuid') {
            try {
                const cacheKey = `uuid_${username}`;
                const cached = this.whitelistCache.get(cacheKey);
                
                let uuid;
                if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                    this.loggerWhitelist.info(`Using cached UUID for ${username}`);
                    uuid = cached.uuid;
                } else {
                    this.loggerWhitelist.info(`Fetching fresh UUID for ${username}`);
                    uuid = await this.getMojangUUID(username);
                    if (uuid) {
                        this.whitelistCache.set(cacheKey, {
                            uuid: uuid,
                            timestamp: Date.now()
                        });
                        this.loggerWhitelist.info(`Cached UUID for ${username}: ${uuid}`);
                    }
                }

                if (!uuid) {
                    this.loggerWhitelist.error(`Minecraft account not found: ${username}`);
                    return {
                        allowed: false,
                        reason: 'Compte Minecraft introuvable sur les serveurs Mojang'
                    };
                }

                const isWhitelisted = whitelistEntries.some(
                    entry => entry.replace(/-/g, '').toLowerCase() === uuid.toLowerCase()
                );

                if (isWhitelisted) {
                    this.loggerWhitelist.info(`✓ ${username} (${uuid}) is whitelisted (by UUID)`);
                } else {
                    this.loggerWhitelist.warn(`✗ ${username} (${uuid}) is NOT whitelisted (by UUID)`);
                }

                return {
                    allowed: isWhitelisted,
                    uuid: uuid,
                    reason: isWhitelisted 
                        ? 'Joueur autorisé' 
                        : 'Vous n\'êtes pas dans la whitelist de cette instance'
                };

            } catch (error) {
                this.loggerWhitelist.error('Error during UUID whitelist check:', error);
                return {
                    allowed: false,
                    reason: `Erreur de vérification: ${error.message}`
                };
            }
        }

        this.loggerWhitelist.error(`Unsupported whitelist type: ${whitelistType}`);
        return {
            allowed: false,
            reason: 'Type de whitelist non supporté (utilisez "username" ou "uuid")'
        };
    }

    cleanCache() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, value] of this.whitelistCache.entries()) {
            if (now - value.timestamp >= this.cacheExpiry) {
                this.whitelistCache.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            this.loggerWhitelist.info(`Cleaned ${cleanedCount} expired cache entries`);
        }
    }

    clearCache() {
        const size = this.whitelistCache.size;
        this.whitelistCache.clear();
        this.loggerWhitelist.info(`Cache cleared (${size} entries removed)`);
    }

    getCacheStats() {
        const stats = {
            totalEntries: this.whitelistCache.size,
            entries: []
        };

        const now = Date.now();
        for (const [key, value] of this.whitelistCache.entries()) {
            const age = now - value.timestamp;
            const remaining = Math.max(0, this.cacheExpiry - age);
            
            stats.entries.push({
                key: key,
                uuid: value.uuid,
                age: Math.round(age / 1000) + 's',
                expiresIn: Math.round(remaining / 1000) + 's'
            });
        }

        return stats;
    }
}

module.exports = {
    WhitelistManager
};