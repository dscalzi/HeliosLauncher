import { resolve } from 'path'
import { Distribution } from 'helios-distribution-types'
import got from 'got'
import { LoggerUtil } from 'common/logging/loggerutil'
import { RestResponse, handleGotError, RestResponseStatus } from 'common/got/RestResponse'
import { pathExists, readFile, writeFile } from 'fs-extra'

// TODO Option to check endpoint for hash of distro for local compare
// Useful if distro is large (MBs)

export class DistributionAPI {

    private static readonly logger = LoggerUtil.getLogger('DistributionAPI')

    private readonly REMOTE_URL = 'http://mc.westeroscraft.com/WesterosCraftLauncher/distribution.json'

    private readonly DISTRO_FILE = 'distribution.json'
    private readonly DISTRO_FILE_DEV = 'distribution_dev.json'

    private readonly DEV_MODE = false // placeholder

    private distroPath: string
    private distroDevPath: string

    private rawDistribution!: Distribution

    constructor(
        private launcherDirectory: string
    ) {
        this.distroPath = resolve(launcherDirectory, this.DISTRO_FILE)
        this.distroDevPath = resolve(launcherDirectory, this.DISTRO_FILE_DEV)
    }

    public async testLoad(): Promise<Distribution> {
        await this.loadDistribution()
        return this.rawDistribution
    }

    protected async loadDistribution(): Promise<void> {

        let distro

        if(!this.DEV_MODE) {

            distro = (await this.pullRemote()).data
            if(distro == null) {
                distro = await this.pullLocal(false)
            } else {
                this.writeDistributionToDisk(distro)
            }

        } else {
            distro = await this.pullLocal(true)
        }

        if(distro == null) {
            // TODO Bubble this up nicer
            throw new Error('FATAL: Unable to load distribution from remote server or local disk.')
        }

        this.rawDistribution = distro
    }

    protected async pullRemote(): Promise<RestResponse<Distribution | null>> {

        try {

            const res = await got.get<Distribution>(this.REMOTE_URL, { responseType: 'json' })

            return {
                data: res.body,
                responseStatus: RestResponseStatus.SUCCESS
            }

        } catch(error) {

            return handleGotError('Pull Remote', error, DistributionAPI.logger, () => null)

        }
        
    }

    protected async writeDistributionToDisk(distribution: Distribution): Promise<void> {
        await writeFile(this.distroPath, distribution)
    }

    protected async pullLocal(dev: boolean): Promise<Distribution | null> {
        return await this.readDistributionFromFile(!dev ? this.distroPath : this.distroDevPath)
    }


    protected async readDistributionFromFile(path: string): Promise<Distribution | null> {

        if(await pathExists(path)) {
            const raw = await readFile(path, 'utf-8')
            try {
                return JSON.parse(raw)
            } catch(error) {
                DistributionAPI.logger.error(`Malformed distribution file at ${path}`)
                return null
            }
        } else {
            DistributionAPI.logger.error(`No distribution file found at ${path}!`)
            return null
        }

    }

}