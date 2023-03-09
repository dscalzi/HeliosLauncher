import { LoggerUtil } from "helios-core/.";
import { Client } from "discord-rpc-patch";
import RPCClient from "discord-rpc-patch/src/client";

const logger = LoggerUtil.getLogger('DiscordWrapper')

export class DiscordRichPresence {
    private static client?: RPCClient;
    private static activity?: {
        details: string,
        state: string,
        largeImageKey: string,
        largeImageText: string,
        smallImageKey: string,
        smallImageText: string,
        startTimestamp: number,
        instance: boolean,
    };

    public static initRPC(genSettings, servSettings, initialDetails = 'Waiting for this.Client..') {
        this.client = new Client({ transport: 'ipc' })

        this.activity = {
            details: initialDetails,
            state: 'Server: ' + servSettings.shortId,
            largeImageKey: servSettings.largeImageKey,
            largeImageText: servSettings.largeImageText,
            smallImageKey: genSettings.smallImageKey,
            smallImageText: genSettings.smallImageText,
            startTimestamp: new Date().getTime(),
            instance: false
        }

        this.client.on('ready', () => {
            logger.info('Discord RPC Connected')
            this.client.setActivity(activity)
        })

        this.client.login({ clientId: genSettings.clientId }).catch(error => {
            if (error.message.includes('ENOENT')) {
                logger.info('Unable to initialize Discord Rich Presence, no client detected.')
            } else {
                logger.info('Unable to initialize Discord Rich Presence: ' + error.message, error)
            }
        })
    }

    public static updateDetails(details) {
        if (!this.client || !this.activity) return;
        this.activity.details = details
        this.client.setActivity(this.activity)
    }

    public static shutdownRPC() {
        if (!this.client) return
        this.client.clearActivity()
        this.client.destroy()
        this.client = undefined
        this.activity = undefined
    }

}