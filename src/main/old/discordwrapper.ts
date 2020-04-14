import { LoggerUtil } from './loggerutil'
import { Client, Presence } from 'discord-rpc'

// Work in progress
const logger = new LoggerUtil('%c[DiscordWrapper]', 'color: #7289da; font-weight: bold')

let client: Client
let activity: Presence

// TODO types for these settings
export function initRPC(genSettings: any, servSettings: any, initialDetails = 'Waiting for Client..'){
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

export function updateDetails(details: string){
    activity.details = details
    client.setActivity(activity)
}

export function shutdownRPC(){
    if(!client) return
    client.clearActivity()
    client.destroy()
    client = null as unknown as Client // TODO cleanup
    activity = null as unknown as Presence // TODO cleanup
}