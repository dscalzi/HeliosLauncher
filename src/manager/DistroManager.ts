import { readFile, writeFile } from "fs-extra"
import { LoggerUtil } from "helios-core/.";
import { DevUtil } from '../util/DevUtil';
import { ConfigManager } from "./ConfigManager";
import { join } from 'path';
import { DistroIndex, IDistroIndex } from '../models/DistroIndex';
import fetch from 'node-fetch';

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

    public static distribution?: DistroIndex;
    private static readonly DISTRO_PATH = join(ConfigManager.getLauncherDirectory(), 'distribution.json')
    private static readonly DEV_PATH = join(ConfigManager.getLauncherDirectory(), 'dev_distribution.json')

    /**
     * @returns {Promise.<DistroIndex>}
     */
    public static async pullRemote() {
        if (DevUtil.IsDev) return this.pullLocal();

        const distroDest = join(ConfigManager.getLauncherDirectory(), 'distribution.json')
        const response = await fetch(ConfigManager.DistributionURL, { signal: AbortSignal.timeout(2500) });

        this.distribution = DistroIndex.fromJSON(await response.json() as IDistroIndex);

        writeFile(distroDest, JSON.stringify(this.distribution), 'utf-8').catch(e => {
            logger.warn("Failed to save local distribution.json")
            logger.warn(e);
        });

        return this.distribution;
    }

    /**
     * @returns {Promise.<DistroIndex>}
     */
    public static async pullLocal() {
        const file = await readFile(DevUtil.IsDev ? this.DEV_PATH : this.DISTRO_PATH, 'utf-8');
        this.distribution = DistroIndex.fromJSON(JSON.parse(file));
        return this.distribution;

    }

    public static setDevMode(value: boolean) {
        if (value) {
            logger.info('Developer mode enabled.')
            logger.info('If you don\'t know what that means, revert immediately.')
        } else {
            logger.info('Developer mode disabled.')
        }
        DevUtil.IsDev = value
    }
}