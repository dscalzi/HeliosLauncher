const fs = require('fs')
const request = require('request')
const path = require('path')
const mkpath = require('mkdirp');
const async = require('async')
const crypto = require('crypto')

function Asset(from, to, size, hash){
    this.from = from
    this.to = to
    this.size = size
    this.hash = hash
}

function AssetIndex(id, sha1, size, url, totalSize){
    this.id = id
    this.sha1 = sha1
    this.size = size
    this.url = url
    this.totalSize = totalSize
}

/**
 * This function will download the version index data and read it into a Javascript
 * Object. This object will then be returned.
 */
exports.parseVersionData = function(version, basePath){
    const name = version + '.json'
    const baseURL = 'https://s3.amazonaws.com/Minecraft.Download/versions/' + version + '/' + name
    const versionPath = path.join(basePath, 'versions', version)
    
    return new Promise(function(fulfill, reject){
        request.head(baseURL, function(err, res, body){
            console.log('Preparing download of ' + version + ' assets.')
            mkpath.sync(versionPath)
            const stream = request(baseURL).pipe(fs.createWriteStream(path.join(versionPath, name)))
            stream.on('finish', function(){
                fulfill(JSON.parse(fs.readFileSync(path.join(versionPath, name))))
            })
        })
    })
}

/**
 * Download the client for version. This file is 'client.jar' although
 * it must be renamed to '{version}'.jar.
 */
exports.downloadClient = function(versionData, basePath){
    const dls = versionData['downloads']
    const clientData = dls['client']
    const url = clientData['url']
    const size = clientData['size']
    const version = versionData['id']
    const sha1 = clientData['sha1']
    const targetPath = path.join(basePath, 'versions', version)
    const targetFile = version + '.jar'

    if(!validateLocalIntegrity(path.join(targetPath, targetFile), 'sha1', sha1)){
        request.head(url, function(err, res, body){
            console.log('Downloading ' + version + ' client..')
            mkpath.sync(targetPath)
            const stream = request(url).pipe(fs.createWriteStream(path.join(targetPath, targetFile)))
            stream.on('finish', function(){
                console.log('Finished downloading ' + version + ' client.')
            })
        })
    }
}

exports.downloadLogConfig = function(versionData, basePath){
    const logging = versionData['logging']
    const client = logging['client']
    const file = client['file']
    const version = versionData['id']
    const sha1 = file['sha1']
    const targetPath = path.join(basePath, 'assets', 'log_configs')
    const name = file['id']
    const url = file['url']

    if(!validateLocalIntegrity(path.join(targetPath, name), 'sha1', sha1)){
        request.head(url, function(err, res, body){
            console.log('Downloading ' + version + ' log config..')
            mkpath.sync(targetPath)
            const stream = request(url).pipe(fs.createWriteStream(path.join(targetPath, name)))
            stream.on('finish', function(){
                console.log('Finished downloading ' + version + ' log config..')
            })
        })
    }
}

exports.downloadLibraries = function(versionData, basePath){
    const libArr = versionData['libraries']
    const libPath = path.join(basePath, 'libraries')
    async.eachLimit(libArr, 1, function(lib, cb){
        if(validateRules(lib['rules'])){
            if(lib['natives'] == null){
                const dlInfo = lib['downloads']
                const artifact = dlInfo['artifact']
                const sha1 = artifact['sha1']
                const libSize = artifact['size']
                const to = path.join(libPath, artifact['path'])
                const from = artifact['url']
                if(!validateLocalIntegrity(to, 'sha1', sha1)){
                    mkpath.sync(path.join(to, ".."))
                    let req = request(from)
                    let writeStream = fs.createWriteStream(to)
                    req.pipe(writeStream)
                    let acc = 0;
                    req.on('data', function(chunk){
                        acc += chunk.length
                        //console.log('Progress', acc/libSize)
                    })
                    writeStream.on('close', function(){
                        cb()
                    })
                } else {
                    cb()
                }
            } else {
                const natives = lib['natives']
                const opSys = mojangFriendlyOS()
                const indexId = natives[opSys]
                const dlInfo = lib['downloads']
                const classifiers = dlInfo['classifiers']
                const artifact = classifiers[indexId]

                const libSize = artifact['size']
                const to = path.join(libPath, artifact['path'])
                const from = artifact['url']
                const sha1 = artifact['sha1']

                if(!validateLocalIntegrity(to, 'sha1', sha1)){
                    mkpath.sync(path.join(to, ".."))
                    let req = request(from)
                    let writeStream = fs.createWriteStream(to)
                    req.pipe(writeStream)
                    let acc = 0;
                    req.on('data', function(chunk){
                        acc += chunk.length
                        console.log('Progress', acc/libSize)
                    })
                    writeStream.on('close', function(){
                        cb()
                    })
                } else {
                    cb()
                }
            }
        } else {
            cb()
        }
    }, function(err){
        if(err){
            console.log('A library failed to process');
        } else {
            console.log('All libraries have been processed successfully');
        }
    })
}

/**
 * Given an index url, this function will asynchonously download the
 * assets associated with that version.
 */
exports.downloadAssets = function(versionData, basePath){
    //Asset index constants.
    const assetIndex = versionData['assetIndex']
    const indexURL = assetIndex['url']
    const datasize = assetIndex['totalSize']
    const gameVersion = versionData['id']
    const assetVersion = assetIndex['id']
    const name = assetVersion + '.json'

    //Asset constants
    const resourceURL = 'http://resources.download.minecraft.net/'
    const localPath = path.join(basePath, 'assets')
    const indexPath = path.join(localPath, 'indexes')
    const objectPath = path.join(localPath, 'objects')

    request.head(indexURL, function (err, res, body) {
        console.log('Downloading ' + gameVersion + ' asset index.')
        mkpath.sync(indexPath)
        const stream = request(indexURL).pipe(fs.createWriteStream(path.join(indexPath, name)))
        stream.on('finish', function() {
            const data = JSON.parse(fs.readFileSync(path.join(indexPath, name), 'utf-8'))
            const assetArr = []
            Object.keys(data['objects']).forEach(function(key, index){
                const ob = data['objects'][key]
                const hash = String(ob['hash'])
                const assetName = path.join(hash.substring(0, 2), hash)
                const urlName = hash.substring(0, 2) + "/" + hash
                const ast = new Asset(resourceURL + urlName, path.join(objectPath, assetName), ob['size'], hash)
                assetArr.push(ast)
            })
            let acc = 0;
            async.eachLimit(assetArr, 5, function(asset, cb){
                mkpath.sync(path.join(asset.to, ".."))
                if(!validateLocalIntegrity(asset.to, 'sha1', asset.hash)){
                    let req = request(asset.from)
                    let writeStream = fs.createWriteStream(asset.to)
                    req.pipe(writeStream)
                    req.on('data', function(chunk){
                        acc += chunk.length
                        //console.log('Progress', acc/datasize)
                    })
                    writeStream.on('close', function(){
                        cb()
                    })
                } else {
                    cb()
                }
            }, function(err){
                if(err){
                    console.log('An asset failed to process');
                } else {
                    console.log('All assets have been processed successfully');
                }
            })
        })
    })
}

validateLocalIntegrity = function(filePath, algo, hash){
    if(fs.existsSync(filePath)){
        let fileName = path.basename(filePath)
        console.log('Validating integrity of local file', fileName)
        let shasum = crypto.createHash(algo)
        let content = fs.readFileSync(filePath)
        shasum.update(content)
        let localhash = shasum.digest('hex')
        if(localhash === hash){
            console.log('Hash value of ' + fileName + ' matches the index hash, woo!')
            return true
        } else {
            console.log('Hash value of ' + fileName + ' (' + localhash + ')' + ' does not match the index hash. Redownloading..')
            return false
        }
    }
    return false;
}

validateRules = function(rules){
    if(rules == null) return true

    let result = true
    rules.forEach(function(rule){
        const action = rule['action']
        const osProp = rule['os']
        if(action != null){
            if(osProp != null){
                 const osName = osProp['name']
                 const osMoj = mojangFriendlyOS()
                 if(action === 'allow'){
                     result = osName === osMoj
                     return
                 } else if(action === 'disallow'){
                     result = osName !== osMoj
                     return
                 }
            }
        }
    })
    return result
}

mojangFriendlyOS = function(){
    const opSys = process.platform
    if (opSys === 'darwin') {
        return 'osx';
    } else if (opSys === 'win32'){
        return 'windows';
    } else if (opSys === 'linux'){
        return 'linux';
    } else {
        return 'unknown_os';
    }
}