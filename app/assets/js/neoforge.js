const AdmZip = require('adm-zip')
const childProcess = require('child_process')
const fs = require('fs-extra')
const path = require('path')
const { MavenUtil, validateLocalFile, isLibraryCompatible } = require('helios-core/common')
const { downloadQueue, HashAlgo } = require('helios-core/dl')

function getNeoForgeModule(server) {
    return server.modules.find(module => module.rawModule.id.startsWith('net.neoforged:neoforge:'))
}

exports.isNeoForgeServer = server => server.modules.some(module => module.rawModule.id.startsWith('net.neoforged:neoforge:'))

exports.readVersionManifest = server => {
    const module = getNeoForgeModule(server)
    if(!module) {
        throw new Error(`No NeoForge artifact found for ${server.rawServer.id}.`)
    }

    const profile = JSON.parse(new AdmZip(module.getPath()).readAsText('version.json'))
    if(profile.inheritsFrom !== server.rawServer.minecraftVersion || !profile.mainClass || !Array.isArray(profile.libraries)) {
        throw new Error(`Invalid NeoForge launch profile for ${server.rawServer.id}.`)
    }

    return profile
}

function getPatchedClientJarPath(server, commonDirectory) {
    const module = getNeoForgeModule(server)
    if(!module) {
        throw new Error(`No NeoForge artifact found for ${server.rawServer.id}.`)
    }

    const installerProfile = JSON.parse(new AdmZip(module.getPath()).readAsText('install_profile.json'))
    const patchedClient = installerProfile.data?.PATCHED?.client
    const match = typeof patchedClient === 'string' && patchedClient.match(/^\[([^\]]+)\]$/)
    if(!match) {
        throw new Error(`NeoForge installer has no patched client artifact for ${server.rawServer.id}.`)
    }

    const librariesDirectory = path.resolve(commonDirectory, 'libraries')
    const jarPath = path.resolve(librariesDirectory, MavenUtil.mavenIdentifierToPath(match[1]))
    const relativePath = path.relative(librariesDirectory, jarPath)
    if(relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
        throw new Error(`Invalid NeoForge patched client path for ${server.rawServer.id}.`)
    }
    return jarPath
}

async function isValidJar(filePath) {
    if(!await fs.pathExists(filePath)) {
        return false
    }

    try {
        return new AdmZip(filePath).getEntries().some(entry => entry.entryName.endsWith('.class'))
    } catch(error) {
        console.warn(`NeoForge patched client JAR is invalid and will be reinstalled: ${error.message}`)
        return false
    }
}

exports.installClient = async (server, commonDirectory, javaExecutable) => {
    const module = getNeoForgeModule(server)
    if(!module) {
        throw new Error(`No NeoForge artifact found for ${server.rawServer.id}.`)
    }

    const jarPath = getPatchedClientJarPath(server, commonDirectory)
    if(await isValidJar(jarPath)) {
        return jarPath
    }

    if(!javaExecutable) {
        throw new Error(`Java is not configured for NeoForge instance ${server.rawServer.id}.`)
    }

    const launcherProfilesPath = path.join(commonDirectory, 'launcher_profiles.json')
    if(!await fs.pathExists(launcherProfilesPath)) {
        await fs.writeJson(launcherProfilesPath, { profiles: {}, settings: {}, version: 3 })
    }

    const installerDirectory = path.join(commonDirectory, '.buildlauncher-neoforge', server.rawServer.id)
    await fs.ensureDir(installerDirectory)
    const outputLimit = 8000
    let output = ''
    const appendOutput = chunk => {
        output = (output + chunk.toString()).slice(-outputLimit)
    }

    console.log(`Installing NeoForge client files for ${server.rawServer.id}.`)
    await new Promise((resolve, reject) => {
        const installer = childProcess.spawn(javaExecutable, [
            '-jar',
            module.getPath(),
            '--installClient',
            commonDirectory
        ], {
            cwd: installerDirectory,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        })

        installer.stdout.on('data', appendOutput)
        installer.stderr.on('data', appendOutput)
        installer.on('error', reject)
        installer.on('close', (code, signal) => {
            if(code === 0) {
                resolve()
                return
            }
            reject(new Error(`NeoForge installation failed (${code ?? signal}) for ${server.rawServer.id}.${output ? `\n${output}` : ''}`))
        })
    })

    if(!await isValidJar(jarPath)) {
        throw new Error(`NeoForge installer completed without creating the patched Minecraft JAR for ${server.rawServer.id}.`)
    }

    return jarPath
}

exports.downloadLibraries = async (profile, commonDirectory, onProgress = () => {}) => {
    const librariesDirectory = path.resolve(commonDirectory, 'libraries')
    const downloads = []
    const checks = []

    for(const library of profile.libraries) {
        if(!isLibraryCompatible(library.rules, library.natives)) {
            continue
        }

        const artifact = library.downloads?.artifact
        if(!artifact?.path || !artifact.url || !artifact.sha1 || !Number.isFinite(artifact.size)) {
            throw new Error(`Incomplete NeoForge library metadata for ${library.name}.`)
        }

        const filePath = path.resolve(librariesDirectory, artifact.path)
        const relativePath = path.relative(librariesDirectory, filePath)
        if(relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
            throw new Error(`Invalid NeoForge library path for ${library.name}.`)
        }

        checks.push({ filePath, hash: artifact.sha1 })
        if(!await validateLocalFile(filePath, HashAlgo.SHA1, artifact.sha1)) {
            downloads.push({
                id: artifact.path,
                url: artifact.url,
                path: filePath,
                size: artifact.size
            })
        }
    }

    if(downloads.length > 0) {
        const totalSize = downloads.reduce((size, asset) => size + asset.size, 0)
        await downloadQueue(downloads, received => onProgress(received, totalSize))
    }

    for(const { filePath, hash } of checks) {
        if(!await validateLocalFile(filePath, HashAlgo.SHA1, hash)) {
            throw new Error(`NeoForge library failed SHA-1 validation: ${filePath}`)
        }
    }
}
