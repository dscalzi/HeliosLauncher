const ConfigManager = require('./configmanager.js')
const Mojang = require('./mojang.js')

exports.addAccount = function(username, password){
    return new Promise(async function(resolve, reject){
        const session = await Mojang.authenticate(username, password, ConfigManager.getClientToken)
        const ret = ConfigManager.addAuthAccount(session.selectedProfile.id, session.accessToken, username, session.selectedProfile.name)
        ConfigManager.save()
        resolve(ret)
    })
}

exports.validateSelected = function(){
    return new Promise(async function(resolve, reject){
        const current = ConfigManager.getSelectedAccount()
        if(!await Mojang.validate(current.accessToken, ConfigManager.getClientToken)){
            const session = Mojang.refresh(current.accessToken, ConfigManager.getClientToken)
            const ret = ConfigManager.updateAuthAccount(current.uuid, session.accessToken)
            ConfigManager.save()
            resolve(ret)
        } else {
            resolve(current)
        }
    })
}