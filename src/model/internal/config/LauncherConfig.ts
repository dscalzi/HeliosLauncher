import { SavedAccount } from './SavedAccount';
import { NewsCache } from './NewsCache';
import { ModConfig } from './ModConfig';

export interface LauncherConfig {

    settings: {
        java: {
            minRAM: string
            maxRAM: string
            executable: string | null
            jvmOptions: string[]
        }
        game: {
            resWidth: number
            resHeight: number
            fullscreen: boolean
            autoConnect: boolean
            launchDetached: boolean
        }
        launcher: {
            allowPrerelease: boolean
            dataDirectory: string
        }
    }
    newsCache: NewsCache
    clientToken: string | null
    selectedServer: string | null
    selectedAccount: string | null
    authenticationDatabase: {[uuid: string]: SavedAccount},
    modConfigurations: ModConfig[]

}
