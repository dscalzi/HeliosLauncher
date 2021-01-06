// Work in progress
const logger = require('./loggerutil')('%c[DiscordWrapper]', 'color: #7289da; font-weight: bold')

const {Client} = require('discord-rpc')

let client
let activity

exports.initRPC = function(genSettings, servSettings, initialDetails = 'Waiting for Client..'){
    client = new Client({ transport: 'ipc' })

    activity = {
        details: initialDetails,
        state: 'Server: ' + servSettings.shortId,
        largeImageKey: servSettings.largeImageKey,
        largeImageText: servSettings.largeImageText,
        smallImageKey: genSettings.smallImageKey,
        smallImageText: genSettings.smallImageText,
        startTimestamp: new Date().getTime(),
        instance: false
    }

    client.on('ready', () => {
        logger.log('Discord RPC Connected')
        client.setActivity(activity)
        logger.log('Large comment: ' + servSettings.shortId)
        logger.log('Large comment: ' + servSettings.largeImageKey)
        logger.log('Large comment: ' + servSettings.largeImageText)
        logger.log('Large comment: ' + servSettings.smallImageKey)
        logger.log('Large comment: ' + servSettings.smallImageText)
        logger.log('Large comment: ' + servSettings.instance)
    })

    
    
    client.login({clientId: genSettings.clientId}).catch(error => {
        if(error.message.includes('ENOENT')) {
            logger.log('Unable to initialize Discord Rich Presence, no client detected.')
        } else {
            logger.log('Unable to initialize Discord Rich Presence: ' + error.message, error)
        }
    })
}

exports.updateDetails = function(details){
    activity.details = details
    client.setActivity(activity)
}

exports.login = function() {
    logger.debug("LOGIN FUNC")
}

exports.shutdownRPC = function(){
    if(!client) return
    client.clearActivity()
    client.destroy()
    client = null
    activity = null
}