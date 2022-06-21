const logger = require('./loggerutil')('%c[DiscordWrapper]', 'color: #7289da; font-weight: bold')

const {Client} = require('discord-rpc-patch')

const user_text               = document.getElementById('user_text')

const t = require("../../../package.json")

let client
let activity

exports.initRPC = function(initialDetails = 'Dans le launcher..'){
    client = new Client({ transport: 'ipc' })

    activity = {
        details: initialDetails,
        state: 'Serveur: 1.18.2',
        buttons: [{ label: "🎮 Discord", url: "https://discord.gg/RspuRbNn4M"}, { label: "📥 Launcher !", url: `https://github.com/luki-39/LukiEnLiveLauncher/releases/download/v${t.version}/LukiEnLiveLauncher-setup-${t.version}.exe`}],
        largeImageKey: "minecraft",
        largeImageText: "discord.gg/9qW6JyUMEf",
        smallImageKey: "pdp",
        smallImageText: `${user_text.innerHTML}`,
        startTimestamp: new Date().getTime(),
        instance: false
    }

    client.on('ready', () => {
        logger.log('Discord RPC Connected')
        client.setActivity(activity)
    })
    
    client.login({clientId: "946067255295369248"}).catch(error => {
        if(error.message.includes('ENOENT')) {
            logger.log('Unable to initialize Discord Rich Presence, no client detected.')
        } else {
            logger.log('Unable to initialize Discord Rich Presence: ' + error.message, error)
        }
    })
}

exports.resetTime = function(){
    activity.startTimestamp = new Date().getTime()
    client.setActivity(activity)
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