import { IServer, Server } from './Server';

export interface IDistroIndex {
    version: string,
    rss: string,
    servers: IServer[]
}

export class DistroIndex {

    /**
     * Parse a JSON object into a DistroIndex.
     * 
     * @param {Object} json A JSON object representing a DistroIndex.
     * 
     * @returns {DistroIndex} The parsed Server object.
     */
    public static fromJSON(json: IDistroIndex) {
        return new DistroIndex(
            json.version,
            json.rss,
            json.servers
        )
    }

    public servers: Server[] = []
    public get mainServer() {
        return this.servers.find(x => x.isMainServer)?.id ?? this.servers[0].id ?? null;
    }

    constructor(
        public version: string,
        public rss: string,
        servers: IServer[],
    ) {
        this.resolveServers(servers);
    }

    public getServer(id: string) {
        return this.servers.find(server => server.id === id);
    }

    private resolveServers(serverJsons: IServer[]) {
        const servers: Server[] = []
        for (let serverJson of serverJsons) {
            servers.push(Server.fromJSON(serverJson))
        }
        this.servers = servers
    }

}