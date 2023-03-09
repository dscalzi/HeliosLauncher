export type MinecraftGameManifest = {
    latest: {
        release: string,
        snapshot: string
    },
    versions: {
        id: string,
        type: string,
        url: string,
        time: string,
        releaseTime: string
    }[]
}

export type MinecraftGameVersionManifest = {
    arguments: {
        game: (ArgumentRule | string)[],
        jvm: (ArgumentRule | string)[]
    },
    minimumLauncherVersion: number,
    releaseTime: Date,
    time: Date,
    //Could be more precise I think
    type: string
    assets: string,
    complianceLevel: number,
    id: string,

    assetIndex:
    {
        id: string,
        sha1: string,
        size: number,
        totalSize: number,
        url: string
    },

    downloads:
    {
        client: MinecraftFileInfo
        client_mappings: MinecraftFileInfo
        server: MinecraftFileInfo,
        server_mappings: MinecraftFileInfo
    },
    javaVersion: { component: string, majorVersion: number },
    logging: {
        client:
        {
            argument: string,
            file: MinecraftFileInfo,
            type: string
        }
    },
    mainClass: string,
    libraries: MinecraftLibrairie[]
}

export type MinecraftLibrairie = {
    downloads: {
        artifact: MinecraftLibrairieFile,
        classifiers: Record<string, MinecraftLibrairieFile>
    },
    extract?: {
        exclude: string[]
    },
    name: string,
    natives: Record<string, string>,
    rules: MinecraftRule
}

export type MinecraftLibrairieFile = Omit<MinecraftFileInfo, 'id'> & {
    path: string,
}

export type MinecraftFileInfo = {
    id?: string,
    sha1: string,
    size: number,
    url: string,
}

export type MinecraftRule = {
    action: string,
    features: Record<string, boolean>
    os: {
        name: string,
        version?: string
    }
}

export type ArgumentRule = {
    rules: MinecraftRule[],
    value: string[],
}

export type MinecraftAssetJson = {
    objects: Record<string, { hash: string, size: number }>
}