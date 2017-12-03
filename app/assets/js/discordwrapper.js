// Work in progress
const Client = require('discord-rpc')
const ConfigManager = require('./configmanager.js')

let rpc

exports.initRPC = function(genSettings, servSettings){
    rpc = new Client({ transport: 'ipc' });

    rpc.on('ready', () => {
        const activity = {
            // state = top text
            // details = bottom text
            state: 'Server: ' + settings.shortId,
            details: '',
            largeImageKey: servSettings.largeImageKey,
            largeImageText: serSettings.largeImageText,
            smallImageKey: genSettings.smallImageKey,
            smallImageText: genSettings.smallImageText,
            startTimestamp: new Date().getTime() / 1000,
            instance: false
        }
    
        rpc.setActivity(activity)
    })

    rpc.login(genSettings.clientID()).catch(error => {
        if(error.message.includes('ENOENT')) {
            console.log('Unable to initialize Discord Rich Presence, no client detected.')
        } else {
            console.log('Unable to initialize Discord Rich Presence: ' + error.message)
        }
    })
}

exports.shutdownRPC = function(){
    rpc.setActivity({})
    rpc.destroy()
    rpc = null
}