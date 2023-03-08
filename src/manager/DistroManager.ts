import { readFile, writeFile } from "fs-extra"
import { LoggerUtil } from "helios-core/.";
import { DevUtil } from '../util/isDev';
import request from "request";
import { ConfigManager } from "./ConfigManager";
import { join } from 'path';
import { DistroIndex } from '../models/DistroIndex';

const logger = LoggerUtil.getLogger('DistroManager')
export enum DistroTypes {
    Library,
    ForgeHosted,
    Forge, // Unimplemented
    LiteLoader,
    ForgeMod,
    LiteMod,
    File,
    VersionManifest,
}

export class DistroManager {

    public distribution!: DistroIndex;
    private readonly DISTRO_PATH = join(ConfigManager.getLauncherDirectory(), 'distribution.json')
    private readonly DEV_PATH = join(ConfigManager.getLauncherDirectory(), 'dev_distribution.json')

    /**
     * @returns {Promise.<DistroIndex>}
     */
    public pullRemote() {
        if (DevUtil.IsDev) {
            return exports.pullLocal()
        }
        return new Promise((resolve, reject) => {
            const opts = {
                url: ConfigManager.DistributionURL,
                timeout: 2500
            }
            const distroDest = join(ConfigManager.getLauncherDirectory(), 'distribution.json')
            request(opts, (error: Error, _resp: any, body: string) => {
                if (!error) {

                    try {
                        this.distribution = DistroIndex.fromJSON(JSON.parse(body))
                    } catch (e) {
                        reject(e)
                        return
                    }

                    writeFile(distroDest, body, 'utf-8', (err) => {
                        if (!err) {
                            resolve(this.distribution)
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
    public pullLocal() {
        return new Promise((resolve, reject) => {
            readFile(DevUtil.IsDev ? this.DEV_PATH : this.DISTRO_PATH, 'utf-8', (err, d) => {
                if (!err) {
                    this.distribution = DistroIndex.fromJSON(JSON.parse(d))
                    resolve(this.distribution)
                    return
                } else {
                    reject(err)
                    return
                }
            })
        })
    }

    public setDevMode(value: boolean) {
        if (value) {
            logger.info('Developer mode enabled.')
            logger.info('If you don\'t know what that means, revert immediately.')
        } else {
            logger.info('Developer mode disabled.')
        }
        DevUtil.IsDev = value
    }
}