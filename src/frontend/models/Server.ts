import { Module } from "./Module"

export interface IServer {
    id: string,
    name: string,
    description: string,
    icon: string,
    version: string,
    address: string,
    minecraftVersion: string,
    isMainServer: boolean,
    autoconnect: boolean,
    modules: Module[],
}

/**
 * Represents a server configuration.
 */
export class Server {
    /**
     * Parse a JSON object into a Server.
     * 
     * @param {Object} json A JSON object representing a Server.
     * 
     * @returns {Server} The parsed Server object.
     */
    public static fromJSON(json: IServer) {

        const mdls = json.modules
        json.modules = []

        const serv = new Server(
            json.id,
            json.name,
            json.description,
            json.icon,
            json.version,
            json.address,
            json.minecraftVersion,
            json.isMainServer,
            json.autoconnect,
            json.modules
        )
        serv.resolveModules(mdls)

        return serv
    }


    constructor(
        public id: string,
        public name: string,
        public description: string,
        public icon: string,
        public version: string,
        public address: string,
        public minecraftVersion: string,
        public isMainServer: boolean,
        public autoconnect: boolean,
        public modules: Module[] = [],
    ) { }


    private resolveModules(json) {
        const modules: Module[] = []
        for (let m of json) {
            modules.push(Module.fromJSON(m, this.id))
        }
        this.modules = modules
    }


}