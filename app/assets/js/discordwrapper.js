// Work in progress
const {Client} = require('discord-rpc')
const ConfigManager = require('./configmanager.js')

let rpc
let activity

exports.initRPC = function(genSettings, servSettings, initialDetails = 'Waiting for Client..'){
    rpc = new Client({ transport: 'ipc' })

    rpc.on('ready', () => {
        activity = {
            details: initialDetails,
            state: 'Server: ' + servSettings.shortId,
            largeImageKey: servSettings.largeImageKey,
            largeImageText: servSettings.largeImageText,
            smallImageKey: genSettings.smallImageKey,
            smallImageText: genSettings.smallImageText,
            startTimestamp: new Date().getTime() / 1000,
            instance: false
        }
    
        rpc.setActivity(activity)
    })

    rpc.login(genSettings.clientID).catch(error => {
        if(error.message.includes('ENOENT')) {
            console.log('Unable to initialize Discord Rich Presence, no client detected.')
        } else {
            console.log('Unable to initialize Discord Rich Presence: ' + error.message, error)
        }
    })
}

exports.updateDetails = function(details){
    if(activity == null){
        console.error('Discord RPC is not initialized and therefore cannot be updated.')
    }
    activity.details = details
    rpc.setActivity(activity)
}

exports.shutdownRPC = function(){
    if(!rpc) return
    rpc.setActivity({})
    rpc.destroy()
    rpc = null
    activity = null
}