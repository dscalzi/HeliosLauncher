import { LoggerUtil } from "helios-core/.";
import * as EventEmitter from 'events';
import { DLTracker } from '../models/DLTracker';
import { createHash } from "crypto";
import { existsSync, readFileSync, readFile, ensureDirSync, writeFileSync, createWriteStream, unlink, createReadStream, remove, ensureDir, writeFile, pathExists, pathExistsSync } from 'fs-extra';
import AdmZip from 'adm-zip';
import { DevUtil } from '../util/DevUtil';
import { join } from 'path';
import { spawn } from 'child_process';
import request from 'request';
import asyncModule from "async";
import { Asset } from "../models/Asset";
import { Library } from '../models/Library';
import { DistroAsset } from '../models/DistroAsset';
import { Module } from '../models/Module';
import { Artifact } from '../models/Artifact';
import { Server } from '../models/Server';
import { DistroManager, DistroTypes } from '../manager/DistroManager';
import { MinecraftUtil } from "../util/MinecraftUtil";
import { createGunzip } from "zlib";
import { extract } from "tar-fs";
import { JavaGuard } from './JavaGuard';
import { StreamZipAsync } from "node-stream-zip";
import { ConfigManager } from "../manager/ConfigManager";
import fetch from 'node-fetch';
import { MinecraftGameManifest, MinecraftGameVersionManifest, MinecraftAssetJson } from '../dto/Minecraft';
const logger = LoggerUtil.getLogger('AssetGuard');

export class AssetGuard extends EventEmitter {


    // Static Utility Functions
    // #region

    // Static Hash Validation Functions
    // #region

    /**
     * Calculates the hash for a file using the specified algorithm.
     * 
     * @param {Buffer} buffer The buffer containing file data.
     * @param {string} algo The hash algorithm.
     * @returns {string} The calculated hash in hex.
     */
    private static calculateHash(buffer: Buffer, algo: string): string {
        return createHash(algo).update(buffer).digest('hex')
    }

    /**
     * Used to parse a checksums file. This is specifically designed for
     * the checksums.sha1 files found inside the forge scala dependencies.
     * 
     * @param {string} content The string content of the checksums file.
     * @returns { Record<string, string>} An object with keys being the file names, and values being the hashes.
     */
    private static parseChecksumsFile(content: string): Record<string, string> {
        let finalContent: Record<string, string> = {}
        let lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
            let bits = lines[i].split(' ')
            if (bits[1] == null) {
                continue
            }
            finalContent[bits[1]] = bits[0]
        }
        return finalContent
    }

    /**
     * Validate that a file exists and matches a given hash value.
     * 
     * @param {string} filePath The path of the file to validate.
     * @param {string} algo The hash algorithm to check against.
     * @param {string} hash The existing hash to check against.
     * @returns {boolean} True if the file exists and calculated hash matches the given hash, otherwise false.
     */
    private static validateLocal(filePath: string, algo: string, hash: string): boolean {
        if (existsSync(filePath)) {
            //No hash provided, have to assume it's good.
            if (hash == null) {
                return true
            }
            let buf = readFileSync(filePath)
            let calcdhash = AssetGuard.calculateHash(buf, algo)
            return calcdhash === hash.toLowerCase()
        }
        return false
    }


    /**
     * Validates a file in the style used by forge's version index.
     * 
     * @param {string} filePath The path of the file to validate.
     * @param {Array.<string>} checksums The checksums listed in the forge version index.
     * @returns {boolean} True if the file exists and the hashes match, otherwise false.
     */
    private static validateForgeChecksum(filePath: string, checksums: string[]): boolean {
        if (existsSync(filePath)) {
            if (checksums == null || checksums.length === 0) {
                return true
            }
            let buf = readFileSync(filePath)
            let calcdhash = AssetGuard.calculateHash(buf, 'sha1')
            let valid = checksums.includes(calcdhash)
            if (!valid && filePath.endsWith('.jar')) {
                valid = AssetGuard.validateForgeJar(Buffer.from(filePath), checksums)
            }
            return valid
        }
        return false
    }

    /**
     * Validates a forge jar file dependency who declares a checksums.sha1 file.
     * This can be an expensive task as it usually requires that we calculate thousands
     * of hashes.
     * 
     * @param {Buffer} buffer The buffer of the jar file.
     * @param {Array.<string>} checksums The checksums listed in the forge version index.
     * @returns {boolean} True if all hashes declared in the checksums.sha1 file match the actual hashes.
     */
    private static validateForgeJar(buffer: Buffer, checksums: string[]): boolean {
        // Double pass method was the quickest I found. I tried a version where we store data
        // to only require a single pass, plus some quick cleanup but that seemed to take slightly more time.

        const hashes: Record<string, string> = {}
        let expected: Record<string, string> = {}

        const zip = new AdmZip(buffer)
        const zipEntries = zip.getEntries()

        //First pass
        for (let i = 0; i < zipEntries.length; i++) {
            let entry = zipEntries[i]
            if (entry.entryName === 'checksums.sha1') {
                expected = AssetGuard.parseChecksumsFile(zip.readAsText(entry))
            }
            hashes[entry.entryName] = AssetGuard.calculateHash(entry.getData(), 'sha1')
        }

        if (!checksums.includes(hashes['checksums.sha1'])) {
            return false
        }

        //Check against expected
        const expectedEntries = Object.keys(expected)
        for (let i = 0; i < expectedEntries.length; i++) {
            if (expected[expectedEntries[i]] !== hashes[expectedEntries[i]]) {
                return false
            }
        }
        return true
    }

    // #endregion

    // Miscellaneous Static Functions
    // #region

    /**
     * Extracts and unpacks a file from .pack.xz format.
     * 
     * @param {Array.<string>} filePaths The paths of the files to be extracted and unpacked.
     * @returns {Promise.<void>} An empty promise to indicate the extraction has completed.
     */
    private static extractPackXZ(filePaths: string[], javaExecutable: string): Promise<void> {
        const extractLogger = LoggerUtil.getLogger('PackXZExtract')
        extractLogger.info('Starting')
        return new Promise((resolve, reject) => {
            let libPath: string;
            if (DevUtil.IsDev) {
                libPath = join(process.cwd(), 'libraries', 'java', 'PackXZExtract.jar')
            } else {
                if (process.platform === 'darwin') {
                    libPath = join(process.cwd(), 'Contents', 'Resources', 'libraries', 'java', 'PackXZExtract.jar')
                } else {
                    libPath = join(process.cwd(), 'resources', 'libraries', 'java', 'PackXZExtract.jar')
                }
            }

            const filePath = filePaths.join(',')
            const child = spawn(javaExecutable, ['-jar', libPath, '-packxz', filePath])
            child.stdout.on('data', (data) => {
                extractLogger.info(data.toString('utf8'))
            })
            child.stderr.on('data', (data) => {
                extractLogger.info(data.toString('utf8'))
            })
            child.on('close', (code, _signal) => {
                extractLogger.info('Exited with code', code)
                resolve(undefined);
            })
        })
    }


    /**
     * Function which finalizes the forge installation process. This creates a 'version'
     * instance for forge and saves its version.json file into that instance. If that
     * instance already exists, the contents of the version.json file are read and returned
     * in a promise.
     * 
     * @param {Asset} asset The Asset object representing Forge.
     * @param {string} commonPath The common path for shared game files.
     * @returns {Promise.<Object>} A promise which resolves to the contents of forge's version.json.
     */
    private static finalizeForgeAsset(asset: Asset, commonPath: string): Promise<object> {
        return new Promise((resolve, reject) => {
            readFile(asset.to, (err, data) => {
                const zip = new AdmZip(data)
                const zipEntries = zip.getEntries()

                for (let i = 0; i < zipEntries.length; i++) {
                    if (zipEntries[i].entryName === 'version.json') {
                        const forgeVersion = JSON.parse(zip.readAsText(zipEntries[i]))
                        const versionPath = join(commonPath, 'versions', forgeVersion.id)
                        const versionFile = join(versionPath, forgeVersion.id + '.json')
                        if (!existsSync(versionFile)) {
                            ensureDirSync(versionPath)
                            writeFileSync(join(versionPath, forgeVersion.id + '.json'), zipEntries[i].getData())
                            resolve(forgeVersion)
                        } else {
                            //Read the saved file to allow for user modifications.
                            resolve(JSON.parse(readFileSync(versionFile, 'utf-8')))
                        }
                        return
                    }
                }
                //We didn't find forge's version.json.
                reject('Unable to finalize Forge processing, version.json not found! Has forge changed their format?')
            })
        })
    }

    // #endregion

    // #endregion





    public totaldlsize = 0;
    public progress = 0;
    public assets = new DLTracker([], 0);
    public libraries = new DLTracker([], 0);
    public files = new DLTracker([], 0);
    public forge = new DLTracker([], 0);
    public java = new DLTracker([], 0);
    public extractQueue: string[] = [];

    /**
     * Create an instance of AssetGuard.
     * On creation the object's properties are never-null default
     * values. Each identifier is resolved to an empty DLTracker.
     * 
     * @param {string} commonPath The common path for shared game files.
     * @param {string} javaexec The path to a java executable which will be used
     * to finalize installation.
     */
    constructor(
        public commonPath: string,
        public javaexec: string
    ) {
        super()
        this.commonPath = commonPath
        this.javaexec = javaexec
    }

    // Validation Functions
    // #region

    /**
     * Loads the version data for a given minecraft version.
     * 
     * @param {string} version The game version for which to load the index data.
     * @param {boolean} force Optional. If true, the version index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<MinecraftGameVersionManifest>} Promise which resolves to the version data object.
     */
    public async loadVersionData(version: string, force: boolean = false): Promise<MinecraftGameVersionManifest> {
        const versionPath = join(this.commonPath, 'versions', version)
        const versionFile = join(versionPath, version + '.json')

        if (!existsSync(versionFile) || force) {
            const url = await this.getVersionDataUrl(version)
            if (!url) throw new Error("No URL");

            //This download will never be tracked as it's essential and trivial.
            logger.info('Preparing download of ' + version + ' assets.')
            await ensureDir(versionPath);

            const response = await fetch(url);
            const json = await response.json() as MinecraftGameVersionManifest;
            response.text().then(text => {
                writeFile(versionFile, response.text());
            });
            return json;
        }

        return JSON.parse(await readFile(versionFile, 'utf-8'));
    }

    /**
     * Parses Mojang's version manifest and retrieves the url of the version
     * data index.
     * 
     * //TODO:Get the JSON to type
     * 
     * @param {string} version The version to lookup.
     * @returns {Promise.<string>} Promise which resolves to the url of the version data index.
     * If the version could not be found, resolves to null.
     */
    public async getVersionDataUrl(versionId: string): Promise<null | string> {

        const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        const manifest = await response.json() as MinecraftGameManifest;
        const version = manifest.versions.find(v => v.id === versionId)
        return version?.url || null
    }

    // Asset (Category=''') Validation Functions
    // #region

    /**
     * Public asset validation function. This function will handle the validation of assets.
     * It will parse the asset index specified in the version data, analyzing each
     * asset entry. In this analysis it will check to see if the local file exists and is valid.
     * If not, it will be added to the download queue for the 'assets' identifier.
     * 
     * @param {MinecraftGameVersionManifest} versionData The version data for the assets.
     * @param {boolean} force Optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    public async validateAssets(versionData: MinecraftGameVersionManifest, force: boolean = false): Promise<void> {
        return this.assetChainIndexData(versionData, force);
    }

    //Chain the asset tasks to provide full async. The below functions are private.
    /**
     * Private function used to chain the asset validation process. This function retrieves
     * the index data.
     * @param {MinecraftGameVersionManifest} versionData
     * @param {boolean} force
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    private async assetChainIndexData(versionData: MinecraftGameVersionManifest, force: boolean = false): Promise<void> {
        //Asset index constants.
        const assetIndex = versionData.assetIndex
        const name = assetIndex.id + '.json'
        const indexPath = join(this.commonPath, 'assets', 'indexes')
        const assetIndexLoc = join(indexPath, name)

        let assetJson: MinecraftAssetJson;
        if (force || !pathExistsSync(assetIndexLoc)) {
            logger.info('Downloading ' + versionData.id + ' asset index.')
            await ensureDir(indexPath)

            const response = await fetch(assetIndex.url);
            assetJson = await response.json() as MinecraftAssetJson;
            response.text().then(txt => {
                writeFile(assetIndexLoc, txt, { encoding: 'utf8' })
            });
        } else {
            assetJson = JSON.parse(await readFile(assetIndexLoc, 'utf-8')) as MinecraftAssetJson;
        }

        return this.assetChainValidateAssets(assetJson)
    }

    /**
     * Private function used to chain the asset validation process. This function processes
     * the assets and enqueues missing or invalid files.
     * @param {MinecraftGameVersionManifest} versionData
     * @param {boolean} force
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    private assetChainValidateAssets(indexData: MinecraftAssetJson): Promise<void> {
        return new Promise((resolve, reject) => {

            //Asset constants
            const resourceURL = 'https://resources.download.minecraft.net/'
            const localPath = join(this.commonPath, 'assets')
            const objectPath = join(localPath, 'objects')

            const assetDlQueue: Asset[] = []
            let dlSize = 0
            let acc = 0
            const total = Object.keys(indexData.objects).length
            //const objKeys = Object.keys(data.objects)
            asyncModule.forEachOfLimit(indexData.objects, 10, (value, key, cb) => {
                acc++
                this.emit('progress', 'assets', acc, total)
                const hash = value.hash
                const assetName = join(hash.substring(0, 2), hash)
                const urlName = hash.substring(0, 2) + '/' + hash
                const ast = new Asset(key, hash, value.size, resourceURL + urlName, join(objectPath, assetName))
                if (!AssetGuard.validateLocal(ast.to, 'sha1', ast.hash)) {
                    dlSize += (ast.size * 1)
                    assetDlQueue.push(ast)
                }
                cb()
            }, (err) => {
                this.assets = new DLTracker(assetDlQueue, dlSize)
                resolve(undefined)
            })
        })
    }

    // #endregion
    // Library (Category=''') Validation Functions
    // #region

    /**
     * Public library validation function. This function will handle the validation of libraries.
     * It will parse the version data, analyzing each library entry. In this analysis, it will
     * check to see if the local file exists and is valid. If not, it will be added to the download
     * queue for the 'libraries' identifier.
     * 
     * @param {MinecraftGameVersionManifest} versionData The version data for the assets.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    public validateLibraries(versionData: MinecraftGameVersionManifest): Promise<void> {
        return new Promise((resolve, reject) => {

            const libArr = versionData.libraries
            const libPath = join(this.commonPath, 'libraries')

            const libDlQueue: Library[] = []
            let dlSize = 0

            //Check validity of each library. If the hashs don't match, download the library.
            asyncModule.eachLimit(libArr, 5, (lib, cb) => {
                if (Library.validateRules(lib.rules, lib.natives)) {
                    let artifact = (lib.natives == null) ? lib.downloads.artifact : lib.downloads.classifiers[lib.natives[Library.mojangFriendlyOS()].replace('${arch}', process.arch.replace('x', ''))]
                    const libItm = new Library(lib.name, artifact.sha1, artifact.size, artifact.url, join(libPath, artifact.path))
                    if (!AssetGuard.validateLocal(libItm.to, 'sha1', libItm.hash)) {
                        dlSize += (libItm.size * 1)
                        libDlQueue.push(libItm)
                    }
                }
                cb()
            }, (err) => {
                this.libraries = new DLTracker(libDlQueue, dlSize)
                resolve(undefined)
            })
        })
    }

    // #endregion

    // Miscellaneous (Category=files) Validation Functions
    // #region

    /**
     * Public miscellaneous mojang file validation function. These files will be enqueued under
     * the 'files' identifier.
     * 
     * @param {MinecraftGameVersionManifest} versionData The version data for the assets.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    public async validateMiscellaneous(versionData: MinecraftGameVersionManifest): Promise<void> {
        await this.validateClient(versionData);
        await this.validateLogConfig(versionData);
    }

    /**
     * Validate client file - artifact renamed from client.jar to '{version}'.jar.
     * 
     * @param {MinecraftGameVersionManifest} versionData The version data for the assets.
     * @param {boolean} force Optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
     * @returns {Promise.<void>} An empty promise to indicate the async processing has completed.
     */
    public async validateClient(versionData: MinecraftGameVersionManifest, force: boolean = false): Promise<void> {
        const clientData = versionData.downloads.client;
        const version = versionData.id;
        const targetPath = join(this.commonPath, 'versions', version);
        const targetFile = version + '.jar';

        let client = new Asset(version + ' client', clientData.sha1, clientData.size, clientData.url, join(targetPath, targetFile));

        if (!AssetGuard.validateLocal(client.to, 'sha1', client.hash) || force) {
            this.files.dlqueue.push(client);
            this.files.dlsize += client.size * 1;
        }
    }

    /**
     * Validate log config.
     * 
     * @param {MinecraftGameVersionManifest} versionData The version data for the assets.
     * @param {boolean} force Optional. If true, the asset index will be downloaded even if it exists locally. Defaults to false.
     * @returns {void} An empty promise to indicate the async processing has completed.
     */
    public validateLogConfig(versionData: MinecraftGameVersionManifest): void {
        const client = versionData.logging.client
        const file = client.file
        const targetPath = join(this.commonPath, 'assets', 'log_configs')

        if (!file.id) throw new Error("No file ID");
        const logConfig = new Asset(file.id, file.sha1, file.size, file.url, join(targetPath, file.id ?? ''))

        if (!AssetGuard.validateLocal(logConfig.to, 'sha1', logConfig.hash)) {
            this.files.dlqueue.push(logConfig)
            this.files.dlsize += logConfig.size * 1
        }
    }

    // #endregion

    // Distribution (Category=forge) Validation Functions
    // #region

    /**
     * Validate the distribution.
     * 
     * @param {Server} server The Server to validate.
     * @returns {Server} A promise which resolves to the server distribution object.
     */
    public validateDistribution(server: Server): Server {
        this.forge = this.parseDistroModules(server.modules, server.minecraftVersion, server.id);
        return server;
    }

    public parseDistroModules(modules: Module[], version: string, servid: string) {
        let assets: DistroAsset[] = [];
        let asize = 0;
        for (let module of modules) {
            let modArtifact = module.artifact;
            let finalPath = modArtifact.path;
            let distroAsset = new DistroAsset(module.identifier, modArtifact.getHash(), Number(modArtifact.size), modArtifact.getURL(), finalPath, module.type)
            const validationPath = finalPath.toLowerCase().endsWith('.pack.xz')
                ? finalPath.substring(0, finalPath.toLowerCase().lastIndexOf('.pack.xz'))
                : finalPath

            if (!AssetGuard.validateLocal(validationPath, 'MD5', distroAsset.hash)) {
                asize += distroAsset.size * 1
                assets.push(distroAsset)
                if (validationPath !== finalPath) this.extractQueue.push(finalPath)
            }

            //Recursively process the submodules then combine the results.
            if (module.subModules != null) {
                let dltrack = this.parseDistroModules(module.subModules, version, servid)
                asize += dltrack.dlsize * 1
                assets = assets.concat(dltrack.dlqueue as DistroAsset[])
            }
        }

        return new DLTracker(assets, asize)
    }

    /**
     * Loads Forge's version.json data into memory for the specified server id.
     * 
     * @param {Server} server The Server to load Forge data for.
     * @returns {Promise.<Object>} A promise which resolves to Forge's version.json data.
     */
    public async loadForgeData(server: Server): Promise<object> {
        const modules = server.modules
        for (let module of modules) {
            const type = module.type
            if (type === DistroTypes.ForgeHosted || type === DistroTypes.Forge) {
                if (MinecraftUtil.isForgeGradle3(server.minecraftVersion, module.artifactVersion)) {
                    // Read Manifest
                    for (let subModule of module.subModules) {
                        if (subModule.type === DistroTypes.VersionManifest) {
                            return JSON.parse(readFileSync(subModule.artifact.getPath(), 'utf-8'))
                        }
                    }
                    throw new Error('No forge version manifest found!')
                } else {
                    const modArtifact = module.artifact
                    const artifactPath = modArtifact.getPath()
                    const asset = new DistroAsset(module.identifier, modArtifact.getHash(), Number(modArtifact.size), modArtifact.getURL(), artifactPath, type)
                    try {
                        let forgeData = await AssetGuard.finalizeForgeAsset(asset, this.commonPath)
                        return forgeData;
                    } catch (err) {
                        throw err;
                    }
                }
            }
        }
        throw new Error('No forge module found!')
    }

    private parseForgeLibraries() {
        /* TODO
        * Forge asset validations are already implemented. When there's nothing much
        * to work on, implement forge downloads using forge's version.json. This is to
        * have the code on standby if we ever need it (since it's half implemented already).
        */
    }
    // #endregion

    // Java (Category=''') Validation (download) Functions
    // #region

    private enqueueOpenJDK(dataDir: string, mcVersion: string) {
        const major = MinecraftUtil.mcVersionAtLeast('1.17', mcVersion) ? '17' : '8'
        JavaGuard.latestOpenJDK(major).then(verData => {
            if (verData != null) {

                dataDir = join(dataDir, 'runtime', 'x64')
                const fDir = join(dataDir, verData.name)
                //TODO : Verify it doesn't break a thing
                const jre = new Asset(verData.name, '', verData.size, verData.uri, fDir)
                this.java = new DLTracker([jre], jre.size, (asset) => {
                    if (verData.name.endsWith('zip')) {

                        this.extractJdkZip(asset.to, dataDir)

                    } else {
                        // Tar.gz
                        let h: string;
                        createReadStream(asset.to)
                            .on('error', err => logger.error(err))
                            .pipe(createGunzip())
                            .on('error', err => logger.error(err))
                            .pipe(extract(dataDir, {
                                map: (header) => {
                                    if (h == null) {
                                        h = header.name
                                    }
                                }
                            }))
                            .on('error', err => logger.error(err))
                            .on('finish', () => {
                                unlink(asset.to, err => {
                                    if (err) {
                                        logger.error(err)
                                    }
                                    if (h.indexOf('/') > -1) {
                                        h = h.substring(0, h.indexOf('/'))
                                    }
                                    const pos = join(dataDir, h)
                                    this.emit('complete', 'java', JavaGuard.javaExecFromRoot(pos))
                                })
                            })
                    }
                })
                return true;
            } else {
                return false;
            }
        })

    }

    public async extractJdkZip(zipPath: string, runtimeDir: string) {

        const zip = new StreamZipAsync({
            file: zipPath,
            storeEntries: true
        });

        let pos = ''
        try {
            const entries = await zip.entries()
            pos = join(runtimeDir, Object.keys(entries)[0])

            logger.info('Extracting jdk..')
            await zip.extract(null, runtimeDir)
            logger.info('Cleaning up..')
            await remove(zipPath)
            logger.info('Jdk extraction complete.')

        } catch (err) {
            logger.error(err)
        } finally {
            zip.close()
            this.emit('complete', 'java', JavaGuard.javaExecFromRoot(pos))
        }
    }

    // #endregion

    // #endregion

    // Control Flow Functions
    // #region

    /**
     * Initiate an async download process for an AssetGuard DLTracker.
     * //TODO: really ?
     * @param {string} identifier The identifier of the AssetGuard DLTracker.
     * @param {number} limit Optional. The number of async processes to run in parallel.
     * @returns {boolean} True if the process began, otherwise false.
     */
    public startAsyncProcess(identifier: string, limit: number = 5): boolean {

        const dlTracker = this[identifier]
        const dlQueue = dlTracker.dlqueue

        if (dlQueue.length > 0) {
            logger.info('DLQueue', dlQueue)
            asyncModule.eachLimit(dlQueue, limit, (asset, cb) => {

                ensureDirSync(join(asset.to, '..'))

                const req = request(asset.from)
                req.pause()

                req.on('response', (resp) => {

                    if (resp.statusCode === 200) {

                        let doHashCheck = false
                        const contentLength = parseInt(resp.headers['content-length'] ?? '')

                        if (contentLength !== asset.size) {
                            logger.warn(`WARN: Got ${contentLength} bytes for ${asset.id}: Expected ${asset.size}`)
                            doHashCheck = true

                            // Adjust download
                            this.totaldlsize -= asset.size
                            this.totaldlsize += contentLength
                        }

                        const writeStream = createWriteStream(asset.to)
                        writeStream.on('close', () => {
                            if (dlTracker.callback != null) {
                                dlTracker.callback.apply(dlTracker, [asset, self])
                            }

                            if (doHashCheck) {
                                const isValid = AssetGuard.validateLocal(asset.to, asset.type != null ? 'md5' : 'sha1', asset.hash)
                                if (isValid) {
                                    logger.warn(`Hashes match for ${asset.id}, byte mismatch is an issue in the distro index.`)
                                } else {
                                    logger.error(`Hashes do not match, ${asset.id} may be corrupted.`)
                                }
                            }
                            cb()
                        });
                        req.pipe(writeStream)
                        req.resume()

                    } else {
                        req.abort()
                        logger.error(`Failed to download ${asset.id}(${typeof asset.from === 'object' ? asset.from.url : asset.from}). Response code ${resp.statusCode}`)
                        this.progress += asset.size * 1
                        this.emit('progress', 'download', this.progress, this.totaldlsize)
                        cb()
                    }

                })

                req.on('error', (err) => {
                    this.emit('error', 'download', err)
                })

                req.on('data', (chunk) => {
                    this.progress += chunk.length
                    this.emit('progress', 'download', this.progress, this.totaldlsize)
                })

            }, (err) => {

                if (err) {
                    logger.warn('An item in ' + identifier + ' failed to process')
                } else {
                    logger.info('All ' + identifier + ' have been processed successfully')
                }

                //this.totaldlsize -= dlTracker.dlsize
                //this.progress -= dlTracker.dlsize
                self[identifier] = new DLTracker([], 0)

                if (this.progress >= this.totaldlsize) {
                    if (this.extractQueue.length > 0) {
                        this.emit('progress', 'extract', 1, 1)
                        //this.emit('extracting')
                        AssetGuard.extractPackXZ(this.extractQueue, this.javaexec).then(() => {
                            this.extractQueue = []
                            this.emit('complete', 'download')
                        })
                    } else {
                        this.emit('complete', 'download')
                    }
                }

            })
            return true
        }
        return false
    }

    /**
     * //TODO: Refacto
     * This function will initiate the download processed for the specified identifiers. If no argument is
     * given, all identifiers will be initiated. Note that in order for files to be processed you need to run
     * the processing function corresponding to that identifier. If you run this function without processing
     * the files, it is likely nothing will be enqueued in the object and processing will complete
     * immediately. Once all downloads are complete, this function will fire the 'complete' event on the
     * global object instance.
     * 
     * @param {Array.<{id: string, limit: number}>} identifiers Optional. The identifiers to process and corresponding parallel async task limit.
     */
    processDlQueues(identifiers = [{ id: 'assets', limit: 20 }, { id: 'libraries', limit: 5 }, { id: 'files', limit: 5 }, { id: 'forge', limit: 5 }]) {
        return new Promise((resolve, _reject) => {
            let shouldFire = true

            // Assign dltracking variables.
            this.totaldlsize = 0
            this.progress = 0

            for (let iden of identifiers) {
                this.totaldlsize += this[iden.id].dlsize
            }

            this.once('complete', () => {
                resolve(undefined)
            })

            for (let iden of identifiers) {
                let r = this.startAsyncProcess(iden.id, iden.limit)
                if (r) shouldFire = false
            }

            if (shouldFire) {
                this.emit('complete', 'download')
            }
        })
    }


    async validateEverything(serverid: string, dev = false) {

        try {
            if (!ConfigManager.isLoaded) ConfigManager.load()

            DistroManager.setDevMode(dev)
            const distroIndex = await DistroManager.pullLocal()

            const server = distroIndex.getServer(serverid)
            if (!server) throw new Error(`No Such Server ${serverid}`)
            // Validate Everything

            await this.validateDistribution(server)
            this.emit('validate', 'distribution')
            const versionData = await this.loadVersionData(server.minecraftVersion)
            this.emit('validate', 'version')
            await this.validateAssets(versionData)
            this.emit('validate', 'assets')
            await this.validateLibraries(versionData)
            this.emit('validate', 'libraries')
            await this.validateMiscellaneous(versionData)
            this.emit('validate', 'files')
            await this.processDlQueues()
            //this.emit('complete', 'download')
            const forgeData = await this.loadForgeData(server)

            return {
                versionData,
                forgeData
            }

        } catch (err) {
            return {
                versionData: null,
                forgeData: null,
                error: err
            }
        }


    }



}