const mojang = require('mojang')
const uuidV4 = require('uuid/v4')
const path = require('path')
const child_process = require('child_process')

exports.launchMinecraft = function(versionData, basePath){
    const authPromise = mojang.auth('EMAIL', 'PASS', uuidV4(), {
        name: 'Minecraft',
        version: 1
    })
    authPromise.then(function(data){
        const hardcodedargs = ''
        const args = finalizeArguments(versionData, data, basePath)
        console.log(args)
        const child = child_process.execFile(basePath)
    })
}

finalizeArguments = function(versionData, authData, basePath){
    const mcArgs = versionData['minecraftArguments']
    const regex = new RegExp('\\${*(.*)}')
    const argArr = mcArgs.split(' ')
    for(let i=0; i<argArr.length; i++){
        if(regex.test(argArr[i])){
            const identifier = argArr[i].match(regex)[1]
            //console.log(argArr[i].match(regex)[1])
            let newVal = argArr[i]
            switch(identifier){
                case 'auth_player_name':
                    //TODO make this DYNAMIC
                    newVal = 'NAME'
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
                    //TODO make this DYNAMIC
                    newVal = 'UUID'
                    break
                case 'auth_access_token':
                    newVal = authData['accessToken']
                    break
                case 'user_type':
                    //TODO make this DYNAMIC
                    newVal = 'MOJANG'
                    break
                case 'version_type':
                    newVal = versionData['type']
                    break
            }
            argArr[i] = newVal
        }
    }
    return argArr.join(' ')
}