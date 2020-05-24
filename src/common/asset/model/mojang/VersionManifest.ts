export interface MojangVersionManifest {

    latest: {
        release: string
        snapshot: string
    }
    versions: {
        id: string
        type: string
        url: string
        time: string
        releaseTime: string
    }[]

}