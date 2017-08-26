const fs = require('fs')

/**
 * Class used to configure mod launch args.
 */
export class ModList {

    /**
     * Construct a ModList.
     * 
     * @param {String} repositoryRoot - the base path of the mod locations.
     * @param {Array.<String>} modRef - array containing the mod artifact ids.
     * @param {String} parentList - parent ModList file path, null if none.
     */
    constructor(repositoryRoot, modRef, parentList){
        if(!arguments.length){
            this.repositoryRoot = ''
            this.modRef = []
        }
        this.repositoryRoot
        this.modRef = modRef
        if(parentList != null) this.parentList = parentList
    }

    /**
     * Exports a ModList object to the specified file path.
     * 
     * @param {ModList} modList - the ModList object to export.
     * @param {String} filePath - desired filepath.
     * @returns {Promise.<String>} - a promise which resolves FML modList argument.
     */
    static exportModList(modList, filePath){
        return new Promise(function(resolve, reject){
            fs.writeFile(filePath, JSON.stringify(modList), (err) => {
                if(err){
                    reject(err.message)
                }
                resolve('--modListFile ' + filePath)
            })
        })
    }

    /**
     * 
     * @param {Object} distro - the distribution index. 
     */
    static generateModList(distro){
        
    }

}