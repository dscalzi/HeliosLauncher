const ConfigManager = require('./configmanager.js')
const Mojang = require('./mojang.js')

exports.addAccount = async function(username, password){
    try{
        const session = await Mojang.authenticate(username, password, ConfigManager.getClientToken)
    } catch (err){
        return Promise.reject(err)
    }
    const ret = ConfigManager.addAuthAccount(session.selectedProfile.id, session.accessToken, username, session.selectedProfile.name)
    ConfigManager.save()
    return ret
}

exports.validateSelected = async function(){
    const current = ConfigManager.getSelectedAccount()
    const isValid = await Mojang.validate(current.accessToken, ConfigManager.getClientToken())
    console.log(isValid)
    if(!isValid){
        try {
            const session = await Mojang.refresh(current.accessToken, ConfigManager.getClientToken())
            console.log('ses', session)
            ConfigManager.updateAuthAccount(current.uuid, session.accessToken)
            ConfigManager.save()
        } catch(err) {
            if(err && err.message === 'ForbiddenOperationException'){
                return false
            }
        }
        return true
    } else {
        return true
    }
}