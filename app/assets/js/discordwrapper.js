// Work in progress
/*const logger = require('./loggerutil')('%c[DiscordWrapper]', 'color: #7289da; font-weight: bold')

const {Client} = require('discord-rpc-patch')

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

exports.shutdownRPC = function(){
    if(!client) return
    client.clearActivity()
    client.destroy()
    client = null
    activity = null
}*/

const logger = require('./loggerutil')('%c[DiscordWrapper]', 'color: #7289da; font-weight: bold')

let rpc = require("discord-rpc")

const client = new rpc.Client({ transport: 'ipc' })

client.on("ready", () => {
    logger.log('Discord RPC Connected')

  client.request('SET_ACTIVITY', {

    pid: process.pid,
    activity: {
      assets: {
        large_image: "pdp"
      },
      //details: "kuku",
      state: "Serveur Minecraft Communautaire !",
      buttons: [{ label: "Discord", url: "https://discord.gg/RspuRbNn4M"}, { label: "Rejoins nous !", url: "https://github.com/luki-39/LukiEnLiveLauncher/releases/download/v2.0.0/LukiEnLive.Launcher-setup-2.0.0.exe"}],
    }    
  
  })

  logger.log(`Connecté à l'utilisateur: ${client.user.username}#${client.user.discriminator}`);

})


client.login({clientId: "946067255295369248"}).catch(error => {
    if(error.message.includes('ENOENT')) {
        logger.log('Unable to initialize Discord Rich Presence, no client detected.')
    } else {
        logger.log('Unable to initialize Discord Rich Presence: ' + error.message, error)
    }
})