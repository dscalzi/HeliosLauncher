const ConfigManager = require('../configmanager')

/**
 * Add an Offline account. The resultant data will be stored as an auth account in the
 * configuration database.
 *
 * @param {string} username The account username (email if migrated).
 * @returns {Promise.<Object>} Promise which resolves the resolved authenticated account object.
 */
exports.addOfflineAccount = async function(username) {
    const offlineUUIDBase = '00000000-0000-0000-0000-'
    let offlineUUIDLastID = 100000000000
    let theNewUUID = offlineUUIDBase + offlineUUIDLastID

    let account = ConfigManager.getAuthAccount(theNewUUID)
    while (account != null){  //There is already an offline account, increment 1 to the offlineUUID
        offlineUUIDLastID++
        theNewUUID = offlineUUIDBase + offlineUUIDLastID
        account = ConfigManager.getAuthAccount(theNewUUID)
    }

    const theNewAccount = ConfigManager.addMojangAuthAccount(
        theNewUUID,
        'anything_here',
        username,
        username
    )
    theNewAccount.type = 'offline'
    return theNewAccount
}


/**
 * Validate the selected Offline account.
 *
 * @returns {Promise.<boolean>} Promise which resolves to true if the access token is valid,
 * otherwise false.
 */
exports.validateSelectedOfflineAccount = async function() {
    return true
}