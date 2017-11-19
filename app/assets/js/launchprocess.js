/**
 * File is officially deprecated in favor of processbuilder.js,
 * will be removed once the new module is 100% complete and this
 * is no longer needed for reference.
 */
const mojang = require('mojang')
const uuidV4 = require('uuid/v4')
const path = require('path')
const child_process = require('child_process')
const ag = require('./assetguard.js')
const AdmZip = require('adm-zip')
const fs = require('fs')
const mkpath = require('mkdirp');

function launchMinecraft(versionData, forgeData, basePath){
    const authPromise = mojang.auth('email', 'pass', uuidV4(), {
        name: 'Minecraft',
        version: 1
    })
    authPromise.then(function(data){
        console.log(data)
        const args = finalizeArgumentsForge(versionData, forgeData, data, basePath)
        //BRUTEFORCE for testing
        //args.push('-mods modstore\\chatbubbles\\chatbubbles\\1.0.1_for_1.11.2\\mod_chatBubbles-1.0.1_for_1.11.2.litemod,modstore\\com\\westeroscraft\\westerosblocks\\3.0.0-beta-71\\westerosblocks-3.0.0-beta-71.jar,modstore\\mezz\\jei\\1.11.2-4.3.5.277\\jei-1.11.2-4.3.5.277.jar,modstore\\net\\optifine\\optifine\\1.11.2_HD_U_B9\\optifine-1.11.2_HD_U_B9.jar')
        //args.push('--modListFile absolute:C:\\Users\\Asus\\Desktop\\LauncherElectron\\app\\assets\\WesterosCraft-1.11.2.json')
        //TODO make this dynamic
        const child = child_process.spawn('C:\\Program Files\\Java\\jdk1.8.0_152\\bin\\javaw.exe', args)
        child.stdout.on('data', (data) => {
            console.log('Minecraft:', data.toString('utf8'))
        })
        child.stderr.on('data', (data) => {
            console.log('Minecraft:', data.toString('utf8'))
        })
        child.on('close', (code, signal) => {
            console.log('Exited with code', code)
        })
    })
}

function finalizeArgumentsForge(versionData, forgeData, authData, basePath){
    const mcArgs = forgeData['minecraftArguments']
    const gameProfile = authData['selectedProfile']
    const regex = new RegExp('\\${*(.*)}')
    const argArr = mcArgs.split(' ')
    const staticArgs = ['-Xmx4G',
                        '-XX:+UseConcMarkSweepGC',
                        '-XX:+CMSIncrementalMode',
                        '-XX:-UseAdaptiveSizePolicy',
                        '-Xmn128M',
                        '-Djava.library.path=' + path.join(basePath, 'natives'),
                        '-cp',
                        classpathArg(versionData, basePath).concat(forgeClasspathArg(forgeData, basePath)).join(';'),
                        forgeData.mainClass]
    for(let i=0; i<argArr.length; i++){
        if(regex.test(argArr[i])){
            const identifier = argArr[i].match(regex)[1]
            let newVal = argArr[i]
            switch(identifier){
                case 'auth_player_name':
                    newVal = gameProfile['name']
                    break
                case 'version_name':
                    //newVal = versionData['id']
                    newVal = 'WesterosCraft-1.11.2'
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

    return staticArgs.concat(argArr)
}

function finalizeArguments(versionData, authData, basePath){
    const mcArgs = versionData['minecraftArguments']
    const gameProfile = authData['selectedProfile']
    const regex = new RegExp('\\${*(.*)}')
    const argArr = mcArgs.split(' ')
    const staticArgs = ['-Xmx1G',
                        '-XX:+UseConcMarkSweepGC',
                        '-XX:+CMSIncrementalMode',
                        '-XX:-UseAdaptiveSizePolicy',
                        '-Xmn128M',
                        '-Djava.library.path=' + path.join(basePath, 'natives'),
                        '-cp',
                        classpathArg(versionData, basePath).join(';'),
                        versionData.mainClass]
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

    return staticArgs.concat(argArr)
}

function forgeClasspathArg(forgeData, basePath){
    const libArr = forgeData['libraries']
    const libPath = path.join(basePath, 'libraries')
    const cpArgs = []
    for(let i=0; i<libArr.length; i++){
        const lib = libArr[i]
        const to = path.join(libPath, ag._resolvePath(lib.name, '.jar'))
        cpArgs.push(to)
    }
    return cpArgs
}

function classpathArg(versionData, basePath){
    const libArr = versionData['libraries']
    const libPath = path.join(basePath, 'libraries')
    const nativePath = path.join(basePath, 'natives')
    const version = versionData['id']
    const cpArgs = [path.join(basePath, 'versions', version, version + '.jar')]
    libArr.forEach(function(lib){
        if(ag.Library.validateRules(lib['rules'])){
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
                const opSys = ag.Library.mojangFriendlyOS()
                const indexId = natives[opSys]
                const dlInfo = lib['downloads']
                const classifiers = dlInfo['classifiers']
                const artifact = classifiers[indexId]

                const to = path.join(libPath, artifact['path'])

                let zip = new AdmZip(to)
                let zipEntries = zip.getEntries()

                for(let i=0; i<zipEntries.length; i++){
                    const fileName = zipEntries[i].entryName

                    let shouldExclude = false

                    exclusionArr.forEach(function(exclusion){
                        if(exclusion.indexOf(fileName) > -1){
                            shouldExclude = true
                        }
                    })

                    if(!shouldExclude){
                        mkpath.sync(path.join(nativePath, fileName, '..'))
                        fs.writeFile(path.join(nativePath, fileName), zipEntries[i].getData())
                    }

                }

                cpArgs.push(to)
            }
        }
    })

    //BRUTEFORCE LIB INJECTION
    //FOR TESTING ONLY
    cpArgs.push(path.join(libPath, 'com', 'mumfrey', 'liteloader', '1.11.2-SNAPSHOT', 'liteloader-1.11.2-SNAPSHOT.jar'))

    return cpArgs
}

module.exports = {
    launchMinecraft
}