export interface SubModConfig {

    mods: {
        [id: string]: boolean | SubModConfig
    }
    value: boolean

}

export interface ModConfig {

    id: string
    mods: {
        [id: string]: boolean | SubModConfig
    }

}