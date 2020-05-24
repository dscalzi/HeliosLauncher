export interface LauncherJava {
    sha1: string
    url: string
    version: string
}

export interface LauncherVersions {
    launcher: {
        commit: string
        name: string
    }
}

export interface LauncherJson {

    java: {
        lzma: {
            sha1: string
            url: string
        }
        sha1: string
    }
    linux: {
        applink: string
        downloadhash: string
        versions: LauncherVersions
    }
    osx: {
        '64': {
            jdk: LauncherJava
            jre: LauncherJava
        }
        apphash: string
        applink: string
        downloadhash: string
        versions: LauncherVersions
    }
    windows: {
        '32': {
            jdk: LauncherJava
            jre: LauncherJava
        }
        '64': {
            jdk: LauncherJava
            jre: LauncherJava
        }
        apphash: string
        applink: string
        downloadhash: string
        rolloutPercent: number
        versions: LauncherVersions
    }

}
