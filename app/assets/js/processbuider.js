/**
 * Work in progress
 */

const path = require('path')
const fs = require('fs')

class ProcessBuilder {

    constructor(gameDirectory, distroServer, versionData, forgeData, authUser){
        this.dir = gameDirectory
        this.server = server
        this.versionData = versionData
        this.forgeData = forgeData
        this.authUser = authUser
        this.fmlDir = path.join(this.dir, 'versions', this.server.id)
    }

    static shouldInclude(mdle){
        //If the module should be included by default
        return mdle.required == null || mdle.required.value == null || mdle.required.value === true || (mdle.required.value === false && mdle.required.def === true)
    }
    
    resolveDefaultMods(options = {type: 'forgemod'}){
        //Returns array of default forge mods to load.
        const mods = []
        const mdles = this.server.modules
    
        for(let i=0; i<mdles.length; ++i){
            if(mdles[i].type != null && mdles[i].type === options.type){
                if(ProcessBuiler._shouldInclude(mdles[i])){
                    mods.push(mdles[i])
                }
            }
        }
    
        return mods
    }

    constructFMLModList(mods, save = false){
        //untested - save modlist file
        const modList = {}
        modList.repositoryRoot = path.join(this.dir, 'modstore')
        const ids = []
        for(let i=0; i<mods.length; ++i){
            ids.push(mods.id)
        }
        modList.modRef = ids
        
        if(save){
            fs.writeFileSync(this.fmlDir, modList, 'UTF-8')
        }
    }

    constructJVMArguments(){
        //pending changes
        const args = [];
        const mcArgs = this.forgeData.minecraftArguments.split(' ')
        const argDiscovery = /\${*(.*)}/
        for(let i=0; i<mcArgs.length; ++i){
            if(argDiscovery.test(mcArgs[i])){
                const identifier = mcArgs[i]
                let val = null;
                switch(identifier){
                    case 'auth_player_name':
                        val = authUser.selectedProfile.name
                        break
                    case 'version_name':
                        //val = versionData.id
                        val = this.server.id
                        break
                    case 'game_directory':
                        val = this.dir
                        break
                    case 'assets_root':
                        val = path.join(this.dir, 'assets')
                        break
                    case 'assets_index_name':
                        val = this.versionData.assets
                        break
                    case 'auth_uuid':
                        val = this.authUser.selectedProfile.id
                        break
                    case 'auth_access_token':
                        val = authUser.accessToken
                        break
                    case 'user_type':
                        val = 'MOJANG'
                        break
                    case 'version_type':
                        val = versionData['type']
                        break
                }
                if(val != null){
                    mcArgs[i] = val;
                }
            }
        }
        return args.concat(mcArgs);
    }

}

module.exports = ProcessBuilder