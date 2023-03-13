// Requirements
const async         = require('async')
const child_process = require('child_process')
const crypto        = require('crypto')
const EventEmitter  = require('events')
const fs            = require('fs-extra')
const { LoggerUtil } = require('helios-core')
const { javaExecFromRoot, latestOpenJDK } = require('helios-core/java')
const StreamZip     = require('node-stream-zip')
const path          = require('path')
const request       = require('request')
const tar           = require('tar-fs')
const zlib          = require('zlib')

const isDev         = require('./isdev')

// Classes

/** Class representing a base asset. */
class Asset {
    /**
     * Create an asset.
     * 
     * @param {any} id The id of the asset.
     * @param {string} hash The hash value of the asset.
     * @param {number} size The size in bytes of the asset.
     * @param {string} from The url where the asset can be found.
     * @param {string} to The absolute local file path of the asset.
     */
    constructor(id, hash, size, from, to){
        this.id = id
        this.hash = hash
        this.size = size
        this.from = from
        this.to = to
    }
}

/**
 * Class representing a download tracker. This is used to store meta data
 * about a download queue, including the queue itself.
 */
class DLTracker {

    /**
     * Create a DLTracker
     * 
     * @param {Array.<Asset>} dlqueue An array containing assets queued for download.
     * @param {number} dlsize The combined size of each asset in the download queue array.
     * @param {function(Asset)} callback Optional callback which is called when an asset finishes downloading.
     */
    constructor(dlqueue, dlsize, callback = null){
        this.dlqueue = dlqueue
        this.dlsize = dlsize
        this.callback = callback
    }

}

class Util {

    /**
     * Returns true if the actual version is greater than
     * or equal to the desired version.
     * 
     * @param {string} desired The desired version.
     * @param {string} actual The actual version.
     */
    static mcVersionAtLeast(desired, actual){
        const des = desired.split('.')
        const act = actual.split('.')

        for(let i=0; i<des.length; i++){
            if(!(parseInt(act[i]) >= parseInt(des[i]))){
                return false
            }
        }
        return true
    }

}

/**
 * Central object class used for control flow. This object stores data about
 * categories of downloads. Each category is assigned an identifier with a 
 * DLTracker object as its value. Combined information is also stored, such as
 * the total size of all the queued files in each category. This event is used
 * to emit events so that external modules can listen into processing done in
 * this module.
 */
class AssetGuard extends EventEmitter {

    static logger = LoggerUtil.getLogger('AssetGuard')

    /**
     * Create an instance of AssetGuard.
     * On creation the object's properties are never-null default
     * values. Each identifier is resolved to an empty DLTracker.
     * 
     * @param {string} commonPath The common path for shared game files.
     * @param {string} javaexec The path to a java executable which will be used
     * to finalize installation.
     */
    constructor(commonPath, javaexec){
        super()
        this.totaldlsize = 0
        this.progress = 0
        this.assets = new DLTracker([], 0)
        this.libraries = new DLTracker([], 0)
        this.files = new DLTracker([], 0)
        this.forge = new DLTracker([], 0)
        this.java = new DLTracker([], 0)
        this.extractQueue = []
        this.commonPath = commonPath
        this.javaexec = javaexec
    }

    // Static Utility Functions
    // #region

    // Static Hash Validation Functions
    // #region

    /**
     * Calculates the hash for a file using the specified algorithm.
     * 
     * @param {Buffer} buf The buffer containing file data.
     * @param {string} algo The hash algorithm.
     * @returns {string} The calculated hash in hex.
     */
    static _calculateHash(buf, algo){
        return crypto.createHash(algo).update(buf).digest('hex')
    }

    /**
     * Validate that a file exists and matches a given hash value.
     * 
     * @param {string} filePath The path of the file to validate.
     * @param {string} algo The hash algorithm to check against.
     * @param {string} hash The existing hash to check against.
     * @returns {boolean} True if the file exists and calculated hash matches the given hash, otherwise false.
     */
    static _validateLocal(filePath, algo, hash){
        if(fs.existsSync(filePath)){
            //No hash provided, have to assume it's good.
            if(hash == null){
                return true
            }
            let buf = fs.readFileSync(filePath)
            let calcdhash = AssetGuard._calculateHash(buf, algo)
            return calcdhash === hash.toLowerCase()
        }
        return false
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
    static _extractPackXZ(filePaths, javaExecutable){
        const extractLogger = LoggerUtil.getLogger('PackXZExtract')
        extractLogger.info('Starting')
        return new Promise((resolve, reject) => {

            let libPath
            if(isDev){
                libPath = path.join(process.cwd(), 'libraries', 'java', 'PackXZExtract.jar')
            } else {
                if(process.platform === 'darwin'){
                    libPath = path.join(process.cwd(),'Contents', 'Resources', 'libraries', 'java', 'PackXZExtract.jar')
                } else {
                    libPath = path.join(process.cwd(), 'resources', 'libraries', 'java', 'PackXZExtract.jar')
                }
            }

            const filePath = filePaths.join(',')
            const child = child_process.spawn(javaExecutable, ['-jar', libPath, '-packxz', filePath])
            child.stdout.on('data', (data) => {
                extractLogger.info(data.toString('utf8'))
            })
            child.stderr.on('data', (data) => {
                extractLogger.info(data.toString('utf8'))
            })
            child.on('close', (code, signal) => {
                extractLogger.info('Exited with code', code)
                resolve()
            })
        })
    }

    // #endregion

    // #endregion

    // Java (Category=''') Validation (download) Functions
    // #region

    _enqueueOpenJDK(dataDir, mcVersion){
        return new Promise((resolve, reject) => {
            const major = Util.mcVersionAtLeast('1.17', mcVersion) ? '17' : '8'
            latestOpenJDK(major).then(verData => {
                if(verData != null){

                    dataDir = path.join(dataDir, 'runtime', 'x64')
                    const fDir = path.join(dataDir, verData.name)
                    const jre = new Asset(verData.name, null, verData.size, verData.uri, fDir)
                    this.java = new DLTracker([jre], jre.size, (a, self) => {
                        if(verData.name.endsWith('zip')){

                            this._extractJdkZip(a.to, dataDir, self)

                        } else {
                            // Tar.gz
                            let h = null
                            fs.createReadStream(a.to)
                                .on('error', err => AssetGuard.logger.error(err))
                                .pipe(zlib.createGunzip())
                                .on('error', err => AssetGuard.logger.error(err))
                                .pipe(tar.extract(dataDir, {
                                    map: (header) => {
                                        if(h == null){
                                            h = header.name
                                        }
                                    }
                                }))
                                .on('error', err => AssetGuard.logger.error(err))
                                .on('finish', () => {
                                    fs.unlink(a.to, err => {
                                        if(err){
                                            AssetGuard.logger.error(err)
                                        }
                                        if(h.indexOf('/') > -1){
                                            h = h.substring(0, h.indexOf('/'))
                                        }
                                        const pos = path.join(dataDir, h)
                                        self.emit('complete', 'java', javaExecFromRoot(pos))
                                    })
                                })
                        }
                    })
                    resolve(true)

                } else {
                    resolve(false)
                }
            })
        })

    }

    async _extractJdkZip(zipPath, runtimeDir, self) {
                            
        const zip = new StreamZip.async({
            file: zipPath,
            storeEntries: true
        })

        let pos = ''
        try {
            const entries = await zip.entries()
            pos = path.join(runtimeDir, Object.keys(entries)[0])

            AssetGuard.logger.info('Extracting jdk..')
            await zip.extract(null, runtimeDir)
            AssetGuard.logger.info('Cleaning up..')
            await fs.remove(zipPath)
            AssetGuard.logger.info('Jdk extraction complete.')

        } catch(err) {
            AssetGuard.logger.error(err)
        } finally {
            zip.close()
            self.emit('complete', 'java', javaExecFromRoot(pos))
        }
    }


    // #endregion

    // #endregion

    // Control Flow Functions
    // #region

    /**
     * Initiate an async download process for an AssetGuard DLTracker.
     * 
     * @param {string} identifier The identifier of the AssetGuard DLTracker.
     * @param {number} limit Optional. The number of async processes to run in parallel.
     * @returns {boolean} True if the process began, otherwise false.
     */
    startAsyncProcess(identifier, limit = 5){

        const self = this
        const dlTracker = this[identifier]
        const dlQueue = dlTracker.dlqueue

        if(dlQueue.length > 0){
            AssetGuard.logger.info('DLQueue', dlQueue)

            async.eachLimit(dlQueue, limit, (asset, cb) => {

                fs.ensureDirSync(path.join(asset.to, '..'))

                let req = request(asset.from)
                req.pause()

                req.on('response', (resp) => {

                    if(resp.statusCode === 200){

                        let doHashCheck = false
                        const contentLength = parseInt(resp.headers['content-length'])

                        if(contentLength !== asset.size){
                            AssetGuard.logger.warn(`WARN: Got ${contentLength} bytes for ${asset.id}: Expected ${asset.size}`)
                            doHashCheck = true

                            // Adjust download
                            this.totaldlsize -= asset.size
                            this.totaldlsize += contentLength
                        }

                        let writeStream = fs.createWriteStream(asset.to)
                        writeStream.on('close', () => {
                            if(dlTracker.callback != null){
                                dlTracker.callback.apply(dlTracker, [asset, self])
                            }

                            if(doHashCheck){
                                const v = AssetGuard._validateLocal(asset.to, asset.type != null ? 'md5' : 'sha1', asset.hash)
                                if(v){
                                    AssetGuard.logger.warn(`Hashes match for ${asset.id}, byte mismatch is an issue in the distro index.`)
                                } else {
                                    AssetGuard.logger.error(`Hashes do not match, ${asset.id} may be corrupted.`)
                                }
                            }

                            cb()
                        })
                        req.pipe(writeStream)
                        req.resume()

                    } else {

                        req.abort()
                        AssetGuard.logger.error(`Failed to download ${asset.id}(${typeof asset.from === 'object' ? asset.from.url : asset.from}). Response code ${resp.statusCode}`)
                        self.progress += asset.size*1
                        self.emit('progress', 'download', self.progress, self.totaldlsize)
                        cb()

                    }

                })

                req.on('error', (err) => {
                    self.emit('error', 'download', err)
                })

                req.on('data', (chunk) => {
                    self.progress += chunk.length
                    self.emit('progress', 'download', self.progress, self.totaldlsize)
                })

            }, (err) => {

                if(err){
                    AssetGuard.logger.warn('An item in ' + identifier + ' failed to process')
                } else {
                    AssetGuard.logger.info('All ' + identifier + ' have been processed successfully')
                }

                //self.totaldlsize -= dlTracker.dlsize
                //self.progress -= dlTracker.dlsize
                self[identifier] = new DLTracker([], 0)

                if(self.progress >= self.totaldlsize) {
                    if(self.extractQueue.length > 0){
                        self.emit('progress', 'extract', 1, 1)
                        //self.emit('extracting')
                        AssetGuard._extractPackXZ(self.extractQueue, self.javaexec).then(() => {
                            self.extractQueue = []
                            self.emit('complete', 'download')
                        })
                    } else {
                        self.emit('complete', 'download')
                    }
                }

            })

            return true

        } else {
            return false
        }
    }

    /**
     * This function will initiate the download processed for the specified identifiers. If no argument is
     * given, all identifiers will be initiated. Note that in order for files to be processed you need to run
     * the processing function corresponding to that identifier. If you run this function without processing
     * the files, it is likely nothing will be enqueued in the object and processing will complete
     * immediately. Once all downloads are complete, this function will fire the 'complete' event on the
     * global object instance.
     * 
     * @param {Array.<{id: string, limit: number}>} identifiers Optional. The identifiers to process and corresponding parallel async task limit.
     */
    processDlQueues(identifiers = [{id:'assets', limit:20}, {id:'libraries', limit:5}, {id:'files', limit:5}, {id:'forge', limit:5}]){
        return new Promise((resolve, reject) => {
            let shouldFire = true

            // Assign dltracking variables.
            this.totaldlsize = 0
            this.progress = 0

            for(let iden of identifiers){
                this.totaldlsize += this[iden.id].dlsize
            }

            this.once('complete', (data) => {
                resolve()
            })

            for(let iden of identifiers){
                let r = this.startAsyncProcess(iden.id, iden.limit)
                if(r) shouldFire = false
            }

            if(shouldFire){
                this.emit('complete', 'download')
            }
        })
    }

    // #endregion

}

module.exports = {
    AssetGuard
}
