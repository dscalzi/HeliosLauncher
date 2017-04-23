const fs = require('fs')
const request = require('request')
const path = require('path')
var mkpath = require('mkdirp');

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
        let stream = request(indexURL).pipe(fs.createWriteStream(path.join(indexPath, name)))
        stream.on('finish', function() {
            let data = JSON.parse(fs.readFileSync(path.join(indexPath, name), 'utf-8'))
            let assetArr = []
            Object.keys(data['objects']).forEach(function(key, index){
                let ob = data['objects'][key]
                let hash = String(ob['hash'])
                let assetName = path.join(hash.substring(0, 2), hash)
                let urlName = hash.substring(0, 2) + "/" + hash
                let ast = new Asset(resourceURL + urlName, path.join(objectPath, assetName), ob['size'])
                assetArr.push(ast)
            })
            assetArr.forEach(function(item, index){
                mkpath.sync(path.join(item.to, ".."))
                console.log("downloading asset from " + item.from + " to " + item.to)
                request(item.from).pipe(fs.createWriteStream(item.to))

            })
        })
    })
}