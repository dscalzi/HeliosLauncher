import request from 'request'
import { Distribution, Module, Type, TypeMetadata, Server } from 'helios-distribution-types'
import { readJson, writeJson } from 'fs-extra'
import { join } from 'path'
import { LoggerUtil } from './loggerutil'
import { ConfigManager } from '../../common/config/configmanager'

const logger = new LoggerUtil('%c[DistroManager]', 'color: #a02d2a; font-weight: bold')

interface ArtifactMeta {
    group: string
    artifact: string
    version: string
    classifier?: string
    extension: string
}

export class ModuleWrapper {
    
    private artifactMeta: ArtifactMeta
    private subModules: ModuleWrapper[] = []

    constructor(public module: Module, private serverId: string) {
        this.artifactMeta = this.resolveMetaData()
        this.resolveArtifactPath()
        this.resolveRequired()
        if (this.module.subModules != null) {
            this.subModules = this.module.subModules.map(mdl => new ModuleWrapper(mdl, serverId))
        }
    }

    private resolveMetaData(): ArtifactMeta {
        try {

            const m0 = this.module.id.split('@')
            const m1 = m0[0].split(':')

            return {
                group:  m1[0] || '???',
                artifact: m1[1] || '???',
                version: m1[2] || '???',
                classifier: m1[3] || undefined,
                extension: m0[1] || TypeMetadata[this.module.type].defaultExtension || 'undefined'
            }

        } catch (err) {
            logger.error('Improper ID for module', this.module.id, err)
            return {
                group: '???',
                artifact: '???',
                version: '???',
                classifier: undefined,
                extension: '???'
            }
        }
    }

    private resolveArtifactPath(): void {
        const relativePath = this.module.artifact.path == null ? join(
            ...this.artifactMeta.group.split('.'),
            this.artifactMeta.artifact,
            this.artifactMeta.version,
            `${this.artifactMeta.artifact}-${this.artifactMeta.version}${this.artifactMeta.classifier != undefined ? `-${this.artifactMeta.classifier}` : ''}.${this.artifactMeta.extension}`
        ) : this.module.artifact.path

        switch (this.module.type){
            case Type.Library:
            case Type.ForgeHosted:
            case Type.LiteLoader:
                this.module.artifact.path = join(ConfigManager.getCommonDirectory(), 'libraries', relativePath)
                break
            case Type.ForgeMod:
            case Type.LiteMod:
                this.module.artifact.path = join(ConfigManager.getCommonDirectory(), 'modstore', relativePath)
                break
            case Type.VersionManifest:
                this.module.artifact.path = join(ConfigManager.getCommonDirectory(), 'versions', this.module.id, `${this.module.id}.json`)
                break
            case Type.File:
            default:
                this.module.artifact.path = join(ConfigManager.getInstanceDirectory(), this.serverId, relativePath)
                break
        }

    }

    private resolveRequired(): void {
        if (this.module.required == null) {
            this.module.required = {
                value: true,
                def: true
            }
        } else {
            if (this.module.required.value == null) {
                this.module.required.value = true
            }
            if (this.module.required.def == null) {
                this.module.required.def = true
            }
        }
    }

    /**
     * @returns {string} The maven identifier of this module's artifact.
     */
    public getArtifact(): string {
        return this.artifactMeta.artifact
    }

    /**
     * @returns {string} The maven group of this module's artifact.
     */
    public getGroup(): string {
        return this.artifactMeta.group
    }

    /**
     * @returns {string} The version of this module's artifact.
     */
    public getVersion(): string {
        return this.artifactMeta.version
    }

    /**
     * @returns {string | undefined} The classifier of this module's artifact
     */
    public getClassifier(): string | undefined {
        return this.artifactMeta.classifier
    }

    /**
     * @returns {string} The extension of this module's artifact.
     */
    public getExtension(): string {
        return this.artifactMeta.extension
    }

    /**
     * @returns {string} The identifier without he version or extension.
     */
    public getVersionlessID(): string {
        return this.artifactMeta.group + ':' + this.artifactMeta.artifact
    }

    /**
     * @returns {string} The identifier without the extension.
     */
    public getExtensionlessID(): string {
        return this.module.id.split('@')[0]
    }

    /**
     * @returns {boolean} Whether or not this module has sub modules.
     */
    public hasSubModules(): boolean {
        return this.module.subModules != null
    }

    public getWrappedSubmodules(): ModuleWrapper[] {
        return this.subModules
    }

}

export class ServerWrapper {

    private modules: ModuleWrapper[] = []

    constructor(public server: Server) {
        this.server.modules.map(mdl => new ModuleWrapper(mdl, server.id))
    }

    public getWrappedModules() {
        return this.modules
    }

}

export class DistributionWrapper {

    private mainServer: ServerWrapper | null = null
    private servers: ServerWrapper[]

    constructor(public distro: Distribution) {
        this.servers = this.distro.servers.map(serv => new ServerWrapper(serv))
        this.resolveMainServer()
    }

    private resolveMainServer(): void {

        for(const serv of this.servers){
            if(serv.server.mainServer){
                this.mainServer = serv
                return
            }
        }

        // If no server declares default_selected, default to the first one declared.
        this.mainServer = (this.servers.length > 0) ? this.servers[0] : null
    }
    
    public getServer(id: string): ServerWrapper | null {
        for(const serv of this.servers){
            if(serv.server.id === id){
                return serv
            }
        }
        return null
    }

    public getMainServer(): ServerWrapper | null {
        return this.mainServer
    }

}


export class DistroManager {

    private static readonly DISTRO_PATH = join(ConfigManager.getLauncherDirectory(), 'distribution.json')
    private static readonly DEV_PATH = join(ConfigManager.getLauncherDirectory(), 'dev_distribution.json')

    private static readonly DISTRIBUTION_URL = 'http://mc.westeroscraft.com/WesterosCraftLauncher/distribution.json'
    // private static readonly DISTRIBUTION_URL = 'https://gist.githubusercontent.com/dscalzi/53b1ba7a11d26a5c353f9d5ae484b71b/raw/'

    private static DEV_MODE = false

    private static distro: DistributionWrapper

    public static isDevMode() {
        return DistroManager.DEV_MODE
    }

    public static setDevMode(value: boolean) {
        if(value){
            logger.log('Developer mode enabled.')
            logger.log('If you don\'t know what that means, revert immediately.')
        } else {
            logger.log('Developer mode disabled.')
        }
        DistroManager.DEV_MODE = value
    }


    public static pullRemote(): Promise<DistributionWrapper> {
        if(DistroManager.DEV_MODE){
            return DistroManager.pullLocal()
        }
        return new Promise((resolve, reject) => {
            const opts = {
                url: DistroManager.DISTRIBUTION_URL,
                timeout: 2500
            }
            const distroDest = join(ConfigManager.getLauncherDirectory(), 'distribution.json')
            request(opts, async (error, resp, body) => {
                if(!error){
                    
                    let data: Distribution

                    try {
                        data = JSON.parse(body) as Distribution

                        DistroManager.distro = new DistributionWrapper(data)
                    } catch (e) {
                        reject(e)
                        return;
                    }

                    try {
                        await writeJson(distroDest, DistroManager.distro)
                        resolve(DistroManager.distro)
                    } catch (err) {
                        reject(err)
                    }
                    
                } else {
                    reject(error)
                }
            })
        })
    }

    public static async pullLocal(): Promise<DistributionWrapper> {
        const data = await readJson(DistroManager.DEV_MODE ? DistroManager.DEV_PATH : DistroManager.DISTRO_PATH) as Distribution

        DistroManager.distro = new DistributionWrapper(data)

        return DistroManager.distro
    }

    public static getDistribution(): DistributionWrapper {
        return DistroManager.distro
    }

}

