// Work in progress
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
        startTimestamp: new Date().getTime() / 1000,
        instance: false
    }

    client.on('ready', () => {
        console.log('%c[Discord Wrapper]', 'color: #a02d2a; font-weight: bold', 'Discord RPC Connected')
        client.setActivity(activity)
    })
    
    client.login({clientId: genSettings.clientId}).catch(error => {
        if(error.message.includes('ENOENT')) {
            console.log('%c[Discord Wrapper]', 'color: #a02d2a; font-weight: bold', 'Unable to initialize Discord Rich Presence, no client detected.')
        } else {
            console.log('%c[Discord Wrapper]', 'color: #a02d2a; font-weight: bold', 'Unable to initialize Discord Rich Presence: ' + error.message, error)
        }
    })
}

exports.updateDetails = function(details){
    activity.details = details
    client.setActivity(activity)
}

exports.shutdownRPC = function(){
    if(!client) return
    client.clearActivity()
    client.destroy()
    client = null
    activity = null
}