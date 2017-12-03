// Work in progress
const Client = require('discord-rpc')
const ConfigManager = require('./configmanager.js')

let rpc

function initRPC(){
    rpc = new Client({ transport: 'ipc' });

    rpc.login(ConfigManager.getDiscordClientID()).catch(error => {
        if(error.message.includes('ENOENT')) {
            console.log('Unable to initialize Discord Rich Presence, no client detected.')
        } else {
            console.log('Unable to initialize Discord Rich Presence: ' + error.message)
        }
    })

    const activity = {
        details: 'Playing on WesterosCraft',

    }
}

function shutdownRPC(){
    rpc.destroy()
    rpc = null
}