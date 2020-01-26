export interface Rule {
    action: string
    os?: {
        name: string
        version?: string
    }
    features?: {
        [key: string]: boolean
    }
}

export interface Natives {
    linux?: string
    osx?: string
    windows?: string
}

interface BaseArtifact {

    sha1: string
    size: number
    url: string

}

interface LibraryArtifact extends BaseArtifact {

    path: string

}

export interface Library {
    downloads: {
        artifact: LibraryArtifact
        classifiers?: {
            javadoc?: LibraryArtifact
            'natives-linux'?: LibraryArtifact
            'natives-macos'?: LibraryArtifact
            'natives-windows'?: LibraryArtifact
            sources?: LibraryArtifact
        }
    }
    extract?: {
        exclude: string[]
    }
    name: string
    natives?: Natives
    rules?: Rule[]
}

export interface VersionJson {

    arguments: {
        game: string[]
        jvm: {
            rules: Rule[]
            value: string[]
        }[]
    }
    assetIndex: {
        id: string
        sha1: string
        size: number
        totalSize: number
        url: string
    }
    assets: string
    downloads: {
        client: BaseArtifact
        server: BaseArtifact
    }
    id: string
    libraries: Library[]
    logging: {
        client: {
            argument: string
            file: {
                id: string
                sha1: string
                size: number
                url: string
            }
            type: string
        }
    }
    mainClass: string
    minimumLauncherVersion: number
    releaseTime: string
    time: string
    type: string

}

export interface AssetIndex {

    objects: {
        [file: string]: {
            hash: string
            size: number
        }
    }

}
