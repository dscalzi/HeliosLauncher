
const child_process = require('child_process')
const { getLibraryDir, MavenUtil, getVersionJarPath } = require('helios-core/common')

const ConfigManager = require('./configmanager')
const { join } = require('path')
const AdmZip = require('adm-zip')
const { getClasspathSeparator } = require('./processbuilder')
const { exists } = require('fs-extra')

/**
 * A class used to patch the Minecraft JAR for ForgeGradle3 modloader support, and possibly Neoforge in the future.
 */
class ForgePatcher {
    /**
     * Creates a patcher instance
     * @param {object} serverModule - A HeliosServer class
     */
    constructor(serverModule) {
        this.serverModule = serverModule
    }

    /**
     * Returns if the modloader is Forge and based off ForgeGradle3, and therefore needs patching to load, and if there's
     * no client jar in the relevant directory
     * @returns {boolean}
     */
    async needsPatching() {
        return this.serverModule.modules.filter(m => m.rawModule.type === "Forge"
            && m.isForgeGradle3()).length > 0
            && !await exists(join(getLibraryDir(ConfigManager.getCommonDirectory()), MavenUtil.mavenIdentifierToPath(this.serverModule.modules.filter(m => m.rawModule.type === "Forge")[0].rawModule.id)))
    }

    /**
     * Gets a path, unzips the JAR to RAM, then reads the manifest file to find and return the main class.
     * @param {string} jarPath - The path to the JAR 
     * @returns {string}
     */
    getProcessorMainClass(jarPath) {
        const jarArchive = new AdmZip(jarPath)
        const jarManifest = jarArchive.readAsText('META-INF/MANIFEST.MF')
        if (!jarManifest) throw new Error('Unable to find the JAR manifest. Is the archive corrupted?')

        const mainClass = jarManifest.toString().replaceAll('\r', '').split('\n').find(line => line.startsWith('Main-Class')).split(':')[1]
        if (!mainClass) throw new Error('Unable to find the main class in the jar manifest. Is the archive corrupted?')

        return mainClass.trim()
    }

    /**
     * Patch the JAR
     */
    async patch() {
        const forgeModule = this.serverModule.modules.filter(m => m.rawModule.type === "Forge" && m.isForgeGradle3())[0]
        const processors = forgeModule.processors
        for (const processor of processors) {
            const libDir = getLibraryDir(ConfigManager.getCommonDirectory())
            let javaBin = ConfigManager.getJavaExecutable(this.serverModule.rawServer.id)
            if (javaBin.endsWith('javaw')) javaBin = javaBin.replace('/javaw', '/java')
            else if (javaBin.endsWith('javaw.exe')) javaBin = javaBin.replace('\\javaw.exe', '\\java.exe')

            const outputs = Object.entries(processor.outputs ?? {})
                .map(([k, v]) => ({ [this.normalizeArg(k)]: this.normalizeArg(v) }))
                .reduce((a, b) => Object.assign(a, b), {})

            for (const [k, v] of Object.entries(outputs)) {
                outputs[k] = v.replace(/'/g, "");
            }


            const cpArgs = []
            cpArgs.push(join(libDir, MavenUtil.mavenIdentifierAsPath(processor.jar)))

            for (const cpArg of processor.classpath) {
                cpArgs.push(join(libDir, MavenUtil.mavenIdentifierAsPath(cpArg)))
            }

            const args = ['-cp', cpArgs.join(getClasspathSeparator())]

            const mainClass = this.getProcessorMainClass(join(libDir, MavenUtil.mavenIdentifierAsPath(processor.jar)))

            args.push(mainClass)

            args.push(...processor.args.map((arg, index) => processor.args[index - 1] === '--input' && arg.startsWith('[') ? join(getLibraryDir(ConfigManager.getCommonDirectory()), MavenUtil.mavenIdentifierToPath(arg.replace('[', '').replace(']', ''))) : this.normalizeArg(arg)))


            const outputIndex = args.indexOf("--output") === -1 ? args.indexOf("--out-jar") : args.indexOf("--output");
            const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : undefined;
            if (outputFile && !outputs[outputFile]) {
                outputs[outputFile] = "";
            }

            await new Promise((resolve, reject) => {
                const child = child_process.spawn(ConfigManager.getJavaExecutable(this.serverModule.rawServer.id), args, {
                    cwd: this.gameDir,
                    detached: false
                })

                child.stdout.setEncoding('utf8')
                child.stderr.setEncoding('utf8')

                child.stdout.on('data', (data) => {
                    data.toString('utf-8').trim().split('\n').forEach(x => console.log(`\x1b[33m[Patcher]\x1b[0m ${x}`))

                })
                child.stderr.on('data', (data) => {
                    data.toString('utf-8').trim().split('\n').forEach(x => console.log(`\x1b[33m[Patcher]\x1b[0m ${x}`))
                })
                child.on('close', (code) => {
                    if (code === 0) return resolve()
                    else throw new Error('Unable to patch the game')
                })
            })

        }
    }

    /**
     * Gets an arg, and return a normalized one.
     * @param {string} argument - The argument to normalize
     * @returns {string}
     */
    normalizeArg(argument) {
        const forgeModule = this.serverModule.modules.filter(m => m.rawModule.type === "Forge" && m.isForgeGradle3())[0]
        const version = this.serverModule.rawServer.minecraftVersion
        const jarPath = getVersionJarPath(ConfigManager.getCommonDirectory(), version)
        const forgeVariables = Object.entries(forgeModule.rawModule.installerVariables).map(([key, value]) => ({ [key]: value.startsWith('[') ? join(getLibraryDir(ConfigManager.getCommonDirectory()), MavenUtil.mavenIdentifierAsPath(value.substring(1, value.length - 1))) : value.replace(/'/g, '') }))
            .reduce((key, value) => Object.assign(key, value), {})

        const values = {
            ...forgeVariables,
            SIDE: 'client',
            MINECRAFT_JAR: jarPath,
            BINPATCH: join(getLibraryDir(ConfigManager.getCommonDirectory()), MavenUtil.mavenIdentifierAsPath(forgeModule.rawModule.clientPatch.id, 'lzma'))
        }

        if (argument.startsWith('[') && argument.endsWith(']')) return join(getLibraryDir(ConfigManager.getCommonDirectory(), MavenUtil.mavenIdentifierAsPath(argument.substring(1, argument.length - 1))))

        return argument.replaceAll(/{([A-Za-z0-9_-]+)}/g, (_, key) => values[key] ?? `{${key}}`)


    }
}

module.exports = ForgePatcher