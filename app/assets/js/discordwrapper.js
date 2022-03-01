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
      buttons: [{ label: "Discord", url: "https://discord.gg/RspuRbNn4M"}, { label: "Rejoins nous !", url: "https://github.com/luki-39/LukiEnLiveLauncher/releases/download/v2.0.3/LukiEnLiveLauncher-setup-2.0.3.exe"}],
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