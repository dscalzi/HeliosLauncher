// Work in progress
const Client = require('discord-rpc')
const {DEFAULT_CONFIG} = require('./enumerator.js').enum

let rpc

function initRPC(){
    rpc = new Client({ transport: 'ipc' });

    rpc.login(DEFAULT_CONFIG.getDiscordClientID()).catch(error => {
        if(error.message.includes('ENOENT')) {
            console.log('Unable to initialize Discord Rich Presence, no client detected.')
        } else {
            console.log('Unable to initialize Discord Rich Presence: ' + error.message)
        }
    })
}

function shutdownRPC(){
    rpc.destroy()
    rpc = null
}