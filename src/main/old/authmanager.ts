import { LoggerUtil } from './loggerutil'
import { ConfigManager } from '../../common/config/configmanager'
import { Mojang } from '../../common/mojang/mojang'
import { SavedAccount } from '../../common/config/model/SavedAccount'

/**
 * AuthManager
 * 
 * This module aims to abstract login procedures. Results from Mojang's REST api
 * are retrieved through our Mojang module. These results are processed and stored,
 * if applicable, in the config using the ConfigManager. All login procedures should
 * be made through this module.
 * 
 * @module authmanager
 */

const logger        = new LoggerUtil('%c[AuthManager]', 'color: #a02d2a; font-weight: bold')
const loggerSuccess = new LoggerUtil('%c[AuthManager]', 'color: #209b07; font-weight: bold')

// Functions

/**
 * Add an account. This will authenticate the given credentials with Mojang's
 * authserver. The resultant data will be stored as an auth account in the
 * configuration database.
 * 
 * @param {string} username The account username (email if migrated).
 * @param {string} password The account password.
 * @returns {Promise.<Object>} Promise which resolves the resolved authenticated account object.
 */
exports.addAccount = async function(username: string, password: string){
    try {
        const session = await Mojang.authenticate(username, password, ConfigManager.getClientToken())
        if(session.selectedProfile != null){
            const ret = ConfigManager.addAuthAccount(session.selectedProfile.id, session.accessToken, username, session.selectedProfile.name)
            if(ConfigManager.getClientToken() == null){
                ConfigManager.setClientToken(session.clientToken)
            }
            ConfigManager.save()
            return ret
        } else {
            throw new Error('NotPaidAccount')
        }
        
    } catch (err){
        return Promise.reject(err)
    }
}

/**
 * Remove an account. This will invalidate the access token associated
 * with the account and then remove it from the database.
 * 
 * @param {string} uuid The UUID of the account to be removed.
 * @returns {Promise.<void>} Promise which resolves to void when the action is complete.
 */
exports.removeAccount = async function(uuid: string){
    try {
        const authAcc = ConfigManager.getAuthAccount(uuid)
        await Mojang.invalidate(authAcc.accessToken, ConfigManager.getClientToken() as string)
        ConfigManager.removeAuthAccount(uuid)
        ConfigManager.save()
        return Promise.resolve()
    } catch (err){
        return Promise.reject(err)
    }
}

/**
 * Validate the selected account with Mojang's authserver. If the account is not valid,
 * we will attempt to refresh the access token and update that value. If that fails, a
 * new login will be required.
 * 
 * **Function is WIP**
 * 
 * @returns {Promise.<boolean>} Promise which resolves to true if the access token is valid,
 * otherwise false.
 */
exports.validateSelected = async function(){
    const current = ConfigManager.getSelectedAccount() as SavedAccount
    const isValid = await Mojang.validate(current.accessToken, ConfigManager.getClientToken() as string)
    if(!isValid){
        try {
            const session = await Mojang.refresh(current.accessToken, ConfigManager.getClientToken() as string)
            ConfigManager.updateAuthAccount(current.uuid, session.accessToken)
            ConfigManager.save()
        } catch(err) {
            logger.debug('Error while validating selected profile:', err)
            if(err && err.error === 'ForbiddenOperationException'){
                // What do we do?
            }
            logger.log('Account access token is invalid.')
            return false
        }
        loggerSuccess.log('Account access token validated.')
        return true
    } else {
        loggerSuccess.log('Account access token validated.')
        return true
    }
}