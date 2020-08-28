export interface Agent {

    name: 'Minecraft'
    version: number

}

export interface AuthPayload {

    agent: Agent
    username: string
    password: string
    clientToken?: string
    requestUser?: boolean

}

export interface Session {

    accessToken: string
    clientToken: string
    selectedProfile: {
        id: string
        name: string
    }
    user?: {
        id: string
        properties: Array<{
            name: string
            value: string
        }>
    }

}
