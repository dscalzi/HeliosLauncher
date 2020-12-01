const builder = require('electron-builder')
const Platform = builder.Platform

function getCurrentPlatform() {
    switch (process.platform) {
        case 'win32':
            return Platform.WINDOWS
        case 'darwin':
            return Platform.MAC
        case 'linux':
            return Platform.linux
        default:
            console.error('Cannot resolve current platform!')
            return undefined
    }
}

builder.build({
    targets: (process.argv[2] != null && Platform[process.argv[2]] != null ? Platform[process.argv[2]] : getCurrentPlatform()).createTarget(),
    config: {
        appId: 'skygameslauncher',
        productName: 'SkyGames Launcher',
        artifactName: '${productName}-setup-${version}.${ext}',
        copyright: 'Copyright © 2019-2020 SkyGames',
        directories: {
            buildResources: 'build',
            output: 'dist'
        },
        win: {
            target: [{
                target: 'nsis',
                arch: 'x64'
            }]
        },
        nsis: {
            oneClick: false,
            perMachine: false,
            allowElevation: true,
            allowToChangeInstallationDirectory: true
        },
        mac: {
            target: 'dmg',
            category: 'public.app-category.games'
        },
        linux: {
            target: 'AppImage',
            maintainer: 'FullGreen',
            vendor: 'FullGreen',
            synopsis: 'Modded Minecraft Launcher',
            description: 'SkyGames Launcher',
            category: 'Game'
        },
        compression: 'maximum',
        files: [
            '!{dist,.gitignore,.vscode,docs,dev-app-update.yml,.travis.yml,.nvmrc,.eslintrc.json,build.js}'
        ],
        extraResources: [
            'libraries'
        ],
        asar: true
    }
}).then(() => {
    console.log('Build complete!')
}).catch(err => {
    console.error('Error during build!', err)
})