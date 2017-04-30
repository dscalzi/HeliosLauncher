const mojang = require('mojang')
const uuidV4 = require('uuid/v4')
const path = require('path')
const child_process = require('child_process')
const library = require('./library.js')
const fs = require('fs')
const unzip = require('unzip')
const mkpath = require('mkdirp');

exports.launchMinecraft = function(versionData, basePath){
    const authPromise = mojang.auth('nytrocraft@live.com', 'applesrgood123', uuidV4(), {
        name: 'Minecraft',
        version: 1
    })
    authPromise.then(function(data){
        const hardcodedargs = ''
        const args = finalizeArguments(versionData, data, basePath)
        //console.log(data)
        //console.log(args)
        //TODO make this dynamic
        const child = child_process.spawn('C:\\Program Files\\Java\\jre1.8.0_131\\bin\\javaw.exe', args)
    })
}

finalizeArguments = function(versionData, authData, basePath){
    const mcArgs = versionData['minecraftArguments']
    console.log(authData)
    const gameProfile = authData['selectedProfile']
    const regex = new RegExp('\\${*(.*)}')
    const argArr = mcArgs.split(' ')
    argArr.unshift('net.minecraft.client.main.Main')
    argArr.unshift(classpathArg(versionData, basePath))
    argArr.unshift('-cp')
    argArr.unshift('-Djava.library.path=' + path.join(basePath, 'natives'))
    argArr.unshift('-Xmn128M')
    argArr.unshift('-XX:-UseAdaptiveSizePolicy')
    argArr.unshift('-XX:+CMSIncrementalMode')
    argArr.unshift('-XX:+UseConcMarkSweepGC')
    argArr.unshift('-Xmx1G')
    for(let i=0; i<argArr.length; i++){
        if(regex.test(argArr[i])){
            const identifier = argArr[i].match(regex)[1]
            let newVal = argArr[i]
            switch(identifier){
                case 'auth_player_name':
                    newVal = gameProfile['name']
                    break
                case 'version_name':
                    newVal = versionData['id']
                    break
                case 'game_directory':
                    newVal = basePath
                    break
                case 'assets_root':
                    newVal = path.join(basePath, 'assets')
                    break
                case 'assets_index_name':
                    newVal = versionData['assets']
                    break
                case 'auth_uuid':
                    newVal = gameProfile['id']
                    break
                case 'auth_access_token':
                    newVal = authData['accessToken']
                    break
                case 'user_type':
                    newVal = 'MOJANG'
                    break
                case 'version_type':
                    newVal = versionData['type']
                    break
            }
            argArr[i] = newVal
        }
    }

    return argArr
}

classpathArg = function(versionData, basePath){
    const libArr = versionData['libraries']
    const libPath = path.join(basePath, 'libraries')
    const nativePath = path.join(basePath, 'natives')
    const version = versionData['id']
    const cpArgs = [path.join(basePath, 'versions', version, version + '.jar')]
    libArr.forEach(function(lib){
        if(library.validateRules(lib['rules'])){
            if(lib['natives'] == null){
                const dlInfo = lib['downloads']
                const artifact = dlInfo['artifact']
                const to = path.join(libPath, artifact['path'])
                cpArgs.push(to)
            } else {
                //Now we need to extract natives.
                const natives = lib['natives']
                const extractInst = lib['extract']
                const exclusionArr = extractInst['exclude']
                const opSys = library.mojangFriendlyOS()
                const indexId = natives[opSys]
                const dlInfo = lib['downloads']
                const classifiers = dlInfo['classifiers']
                const artifact = classifiers[indexId]

                const to = path.join(libPath, artifact['path'])

                fs.createReadStream(to).pipe(unzip.Parse()).on('entry', function(entry){
                    const fileName = entry.path
                    const type = entry.type
                    const size = entry.size

                    console.log(fileName)

                    let shouldExclude = false

                    exclusionArr.forEach(function(exclusion){
                        if(exclusion.indexOf(fileName) > -1){
                            shouldExclude = true
                        }
                    })

                    if(shouldExclude){
                        entry.autodrain()
                    }
                    else {
                        mkpath.sync(path.join(nativePath, fileName, '..'))
                        entry.pipe(fs.createWriteStream(path.join(nativePath, fileName)))
                    }
                })

                cpArgs.push(to)
            }
        }
    })

    return cpArgs.join(';')
}