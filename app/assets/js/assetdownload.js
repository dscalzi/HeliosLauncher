const fs = require('fs')
const request = require('request')
const path = require('path')
const mkpath = require('mkdirp');
const async = require('async')

function Asset(from, to, size){
    this.from = from
    this.to = to
    this.size = size
}

exports.getMojangAssets = function(version, basePath){
    const name = version + '.json'
    const indexURL = 'https://s3.amazonaws.com/Minecraft.Download/indexes/' + name
    const resourceURL = 'http://resources.download.minecraft.net/'
    const localPath = path.join(basePath, 'assets')
    const indexPath = path.join(localPath, 'indexes')
    const objectPath = path.join(localPath, 'objects')

    request.head(indexURL, function (err, res, body) {
        console.log('Downloading ' + version + ' asset index.')
        mkpath.sync(indexPath)
        const stream = request(indexURL).pipe(fs.createWriteStream(path.join(indexPath, name)))
        stream.on('finish', function() {
            const data = JSON.parse(fs.readFileSync(path.join(indexPath, name), 'utf-8'))
            const assetArr = []
            let datasize = 0;
            Object.keys(data['objects']).forEach(function(key, index){
                const ob = data['objects'][key]
                const hash = String(ob['hash'])
                const assetName = path.join(hash.substring(0, 2), hash)
                const urlName = hash.substring(0, 2) + "/" + hash
                const ast = new Asset(resourceURL + urlName, path.join(objectPath, assetName), ob['size'])
                datasize += ob['size']
                assetArr.push(ast)
            })
            let acc = 0;
            async.eachLimit(assetArr, 5, function(asset, cb){
                mkpath.sync(path.join(asset.to, ".."))
                let req = request(asset.from)
                let writeStream = fs.createWriteStream(asset.to)
                req.pipe(writeStream)
                req.on('data', function(chunk){
                    acc += chunk.length
                    console.log('Progress', acc/datasize)
                })
                writeStream.on('close', function(){
                    cb()
                })
            }, function(err){
                if(err){
                    console.log('A file failed to process');
                } else {
                    console.log('All files have been processed successfully');
                }
            })
        })
    })
}