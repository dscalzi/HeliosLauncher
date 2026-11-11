const fs        = require('fs-extra')
const path      = require('path')

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
exports.validateDir = function(dir) {
    fs.ensureDirSync(dir)
}

/**
 * Scan for shaderpacks inside the shaderpacks folder.
 * 
 * @param {string} instanceDir The path to the server instance directory.
 * 
 * @returns {{fullName: string, name: string}[]}
 * An array of objects storing metadata about each discovered shaderpack.
 */
exports.scanForShaderpacks = function(instanceDir){
    const shaderDir = path.join(instanceDir, SHADER_DIR)
    const packsDiscovered = [{
        fullName: 'OFF',
        name: 'Off (Default)'
    }]
    if(fs.existsSync(shaderDir)){
        let modCandidates = fs.readdirSync(shaderDir)
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
exports.getEnabledShaderpack = function(instanceDir){
    exports.validateDir(instanceDir)

    const optionsShaders = path.join(instanceDir, SHADER_CONFIG)
    if(fs.existsSync(optionsShaders)){
        const buf = fs.readFileSync(optionsShaders, {encoding: 'utf-8'})
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
exports.setEnabledShaderpack = function(instanceDir, pack){
    exports.validateDir(instanceDir)

    const optionsShaders = path.join(instanceDir, SHADER_CONFIG)
    let buf
    if(fs.existsSync(optionsShaders)){
        buf = fs.readFileSync(optionsShaders, {encoding: 'utf-8'})
        buf = buf.replace(SHADER_OPTION, `shaderPack=${pack}`)
    } else {
        buf = `shaderPack=${pack}`
    }
    fs.writeFileSync(optionsShaders, buf, {encoding: 'utf-8'})
}

/**
 * Add shaderpacks.
 * 
 * @param {FileList} files The files to add.
 * @param {string} instanceDir The path to the server instance directory.
 */
exports.addShaderpacks = function(files, instanceDir) {

    const p = path.join(instanceDir, SHADER_DIR)

    exports.validateDir(p)

    for(let f of files) {
        if(SHADER_REGEX.exec(f.name) != null) {
            fs.moveSync(f.path, path.join(p, f.name))
        }
    }

}