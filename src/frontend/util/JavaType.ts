export type AdoptiumBinary = {
    binary: {
        architecture: string,
        download_count: number,
        heap_size: string,
        image_type: string,
        jvm_impl: string,
        os: string,
        package: {
            checksum: string,
            checksum_link: string,
            download_count: number,
            link: string,
            metadata_link: string,
            name: string,
            signature_link: string,
            size: number
        },
        project: string,
        scm_ref: string,
        updated_at: string
    }
    release_link: string,
    release_name: string,
    vendor: string,
    version: {
        build: number,
        major: number,
        minor: number,
        openjdk_version: string,
        security: number,
        semver: string
    }
}

export type JavaRuntimeVersion = {
    build: number,
    major: number,
    minor?: number,
    revision?: number,
    update?: number,
    execPath?: string,
}

export type JavaMetaObject = {
    execPath?: string,
    version: JavaRuntimeVersion,
    isARM?: boolean,
}