// Work in progress
const logger = require('./loggerutil')('%c[DiscordWrapper]', 'color: #7289da; font-weight: bold')

const {Client} = require('discord-rpc')

let client
let activity

exports.initRPC = function(genSettings, servSettings = null, initialDetails = 'Waiting for Client..'){
    logger.log('Now Loading Discord RPC')
    client = new Client({ transport: 'ipc' })

    activity = {
        details: initialDetails,
        largeImageKey: genSettings.smallImageKey,
        largeImageText: genSettings.smallImageText,
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

exports.updateState = function(state){
    activity.state = state
    client.setActivity(activity)
    logger.log('Updated discord state to: ' + state)
}

exports.clearState = function(){
    activity = {
        details: activity.details,
        largeImageKey: activity.largeImageKey,
        largeImageText: activity.largeImageText,
        startTimestamp: activity.startTimestamp,
        instance: activity.instance
    }
    client.setActivity(activity)
    logger.log('Cleared the activity state!')
}

exports.updateDetails = function(details){
    activity.details = details
    client.setActivity(activity)
    logger.log('Updated discord details to: ' + details)
}

exports.clearDetails = function(){
    activity = {
        state: activity.state,
        largeImageKey: activity.largeImageKey,
        largeImageText: activity.largeImageText,
        startTimestamp: activity.startTimestamp,
        instance: activity.instance
    }
    logger.log('Cleared the activity details!')
}

exports.resetTime = function(){
    activity.startTimestamp = new Date().getTime()
    client.setActivity(activity)
    logger.log('Reset the activity time!')
}

exports.shutdownRPC = function(){
    if(!client) return
    client.clearActivity()
    client.destroy()
    client = null
    activity = null
}

exports.getClient = function(){
    return client
}