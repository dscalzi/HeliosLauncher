// Work in progress
const logger = require('./loggerutil')('%c[DiscordWrapper]', 'color: #7289da; font-weight: bold')

const {Client} = require('discord-rpc')

let client
let activity

exports.initRPC = function(genSettings, servSettings, initialDetails = 'Waiting for Client..'){
    client = new Client({ transport: 'ipc' })

    activity = {
        details: initialDetails,
        state: 'Modpack: ' + servSettings.shortId,
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

exports.resetTime = function(){
    if(client){
        activity.startTimestamp = new Date().getTime()
        client.setActivity(activity)
        logger.log('Reset the activity time!')
    }
}

exports.shutdownRPC = function(){
    if(!client) return
    client.clearActivity()
    client.destroy()
    client = null
    activity = null
}