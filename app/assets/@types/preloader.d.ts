import { api } from '../js/preloader.js'

declare global {
    interface Window {
        api: typeof api
    }
}

export {};