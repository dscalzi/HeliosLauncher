const fs        = require('fs')
const path      = require('path')
const { shell } = require('electron')

// Group #1: File Name (without .disabled, if any)
// Group #2: File Extension (jar, zip, or litemod)
// Group #3: If it is disabled (if string 'disabled' is present)
const MOD_REGEX = /^(.+(jar|zip|litemod))(?:\.(disabled))?$/
const DISABLED_EXT = '.disabled'

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
exports.scanForDropinMods = function(modsDir, version) {
    const modsDiscovered = []
    if(fs.existsSync(modsDir)){
        let modCandidates = fs.readdirSync(modsDir)
        let verCandidates = []
        const versionDir = path.join(modsDir, version)
        if(fs.existsSync(versionDir)){
            verCandidates = fs.readdirSync(versionDir)
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
                    fullName: path.join(version, match[0]),
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
 * Delete a drop-in mod from the file system.
 * 
 * @param {string} modsDir The path to the mods directory.
 * @param {string} fullName The fullName of the discovered mod to delete.
 * 
 * @returns {boolean} True if the mod was deleted, otherwise false.
 */
exports.deleteDropinMod = function(modsDir, fullName){
    const res = shell.moveItemToTrash(path.join(modsDir, fullName))
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
exports.toggleDropinMod = function(modsDir, fullName, enable){
    return new Promise((resolve, reject) => {
        const oldPath = path.join(modsDir, fullName)
        const newPath = path.join(modsDir, enable ? fullName.substring(0, fullName.indexOf(DISABLED_EXT)) : fullName + DISABLED_EXT)

        fs.rename(oldPath, newPath, (err) => {
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
exports.isDropinModEnabled = function(fullName){
    return !fullName.endsWith(DISABLED_EXT)
}