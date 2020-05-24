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
