import { ensureDirSync, pathExistsSync, readdirSync, moveSync, readFileSync, writeFileSync, rename } from 'fs-extra'
import { join } from 'path'
import { shell } from 'electron'

// Group #1: File Name (without .disabled, if any)
// Group #2: File Extension (jar, zip, or litemod)
// Group #3: If it is disabled (if string 'disabled' is present)
const MOD_REGEX = /^(.+(jar|zip|litemod))(?:\.(disabled))?$/
const DISABLED_EXT = '.disabled'

const SHADER_REGEX = /^(.+)\.zip$/
const SHADER_OPTION = /shaderPack=(.+)/
const SHADER_DIR = 'shaderpacks'
const SHADER_CONFIG = 'optionsshaders.txt'

/**
 * Validate that the given directory exists. If not, it is
 * created.
 * 
 * @param {string} modsDir The path to the mods directory.
 */
export function validateDir(dir: string) {
    ensureDirSync(dir)
}

/**
 * Scan for drop-in mods in both the mods folder and version
 * safe mods folder.
 * 
 * @param {string} modsDir The path to the mods directory.
 * @param {string} version The minecraft version of the server configuration.
 * 
 * @returns {{fullName: string, name: string, ext: string, disabled: boolean}[]}
 * An array of objects storing metadata about each discovered mod.
 */
export function scanForDropinMods(modsDir: string, version: string) {
    const modsDiscovered = []
    if(pathExistsSync(modsDir)){
        let modCandidates = readdirSync(modsDir)
        let verCandidates: string[] = []
        const versionDir = join(modsDir, version)
        if(pathExistsSync(versionDir)){
            verCandidates = readdirSync(versionDir)
        }
        for(let file of modCandidates){
            const match = MOD_REGEX.exec(file)
            if(match != null){
                modsDiscovered.push({
                    fullName: match[0],
                    name: match[1],
                    ext: match[2],
                    disabled: match[3] != null
                })
            }
        }
        for(let file of verCandidates){
            const match = MOD_REGEX.exec(file)
            if(match != null){
                modsDiscovered.push({
                    fullName: join(version, match[0]),
                    name: match[1],
                    ext: match[2],
                    disabled: match[3] != null
                })
            }
        }
    }
    return modsDiscovered
}

/**
 * Add dropin mods.
 * 
 * @param {FileList} files The files to add.
 * @param {string} modsDir The path to the mods directory.
 */
export function addDropinMods(files: any, modsdir: string) {

    exports.validateDir(modsdir)

    for(let f of files) {
        if(MOD_REGEX.exec(f.name) != null) {
            moveSync(f.path, join(modsdir, f.name))
        }
    }

}

/**
 * Delete a drop-in mod from the file system.
 * 
 * @param {string} modsDir The path to the mods directory.
 * @param {string} fullName The fullName of the discovered mod to delete.
 * 
 * @returns {boolean} True if the mod was deleted, otherwise false.
 */
export function deleteDropinMod(modsDir: string, fullName: string){
    const res = shell.moveItemToTrash(join(modsDir, fullName))
    if(!res){
        shell.beep()
    }
    return res
}

/**
 * Toggle a discovered mod on or off. This is achieved by either 
 * adding or disabling the .disabled extension to the local file.
 * 
 * @param {string} modsDir The path to the mods directory.
 * @param {string} fullName The fullName of the discovered mod to toggle.
 * @param {boolean} enable Whether to toggle on or off the mod.
 * 
 * @returns {Promise.<void>} A promise which resolves when the mod has
 * been toggled. If an IO error occurs the promise will be rejected.
 */
export function toggleDropinMod(modsDir: string, fullName: string, enable: boolean){
    return new Promise((resolve, reject) => {
        const oldPath = join(modsDir, fullName)
        const newPath = join(modsDir, enable ? fullName.substring(0, fullName.indexOf(DISABLED_EXT)) : fullName + DISABLED_EXT)

        rename(oldPath, newPath, (err) => {
            if(err){
                reject(err)
            } else {
                resolve()
            }
        })
    })
}

/**
 * Check if a drop-in mod is enabled.
 * 
 * @param {string} fullName The fullName of the discovered mod to toggle.
 * @returns {boolean} True if the mod is enabled, otherwise false.
 */
export function isDropinModEnabled(fullName: string){
    return !fullName.endsWith(DISABLED_EXT)
}

/**
 * Scan for shaderpacks inside the shaderpacks folder.
 * 
 * @param {string} instanceDir The path to the server instance directory.
 * 
 * @returns {{fullName: string, name: string}[]}
 * An array of objects storing metadata about each discovered shaderpack.
 */
export function scanForShaderpacks(instanceDir: string){
    const shaderDir = join(instanceDir, SHADER_DIR)
    const packsDiscovered = [{
        fullName: 'OFF',
        name: 'Off (Default)'
    }]
    if(pathExistsSync(shaderDir)){
        let modCandidates = readdirSync(shaderDir)
        for(let file of modCandidates){
            const match = SHADER_REGEX.exec(file)
            if(match != null){
                packsDiscovered.push({
                    fullName: match[0],
                    name: match[1]
                })
            }
        }
    }
    return packsDiscovered
}

/**
 * Read the optionsshaders.txt file to locate the current
 * enabled pack. If the file does not exist, OFF is returned.
 * 
 * @param {string} instanceDir The path to the server instance directory.
 * 
 * @returns {string} The file name of the enabled shaderpack.
 */
export function getEnabledShaderpack(instanceDir: string){
    validateDir(instanceDir)

    const optionsShaders = join(instanceDir, SHADER_CONFIG)
    if(pathExistsSync(optionsShaders)){
        const buf = readFileSync(optionsShaders, {encoding: 'utf-8'})
        const match = SHADER_OPTION.exec(buf)
        if(match != null){
            return match[1]
        } else {
            console.warn('WARNING: Shaderpack regex failed.')
        }
    }
    return 'OFF'
}

/**
 * Set the enabled shaderpack.
 * 
 * @param {string} instanceDir The path to the server instance directory.
 * @param {string} pack the file name of the shaderpack.
 */
export function setEnabledShaderpack(instanceDir: string, pack: string){
    validateDir(instanceDir)

    const optionsShaders = join(instanceDir, SHADER_CONFIG)
    let buf
    if(pathExistsSync(optionsShaders)){
        buf = readFileSync(optionsShaders, {encoding: 'utf-8'})
        buf = buf.replace(SHADER_OPTION, `shaderPack=${pack}`)
    } else {
        buf = `shaderPack=${pack}`
    }
    writeFileSync(optionsShaders, buf, {encoding: 'utf-8'})
}

/**
 * Add shaderpacks.
 * 
 * @param {FileList} files The files to add.
 * @param {string} instanceDir The path to the server instance directory.
 */
export function addShaderpacks(files: any, instanceDir: string) {

    const p = join(instanceDir, SHADER_DIR)

    exports.validateDir(p)

    for(let f of files) {
        if(SHADER_REGEX.exec(f.name) != null) {
            moveSync(f.path, join(p, f.name))
        }
    }

}