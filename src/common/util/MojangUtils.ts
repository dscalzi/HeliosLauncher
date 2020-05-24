import { Rule, Natives } from "../asset/model/mojang/VersionJson"

export function getMojangOS(): string {
    const opSys = process.platform
    switch(opSys) {
        case 'darwin':
            return 'osx'
        case 'win32':
            return 'windows'
        case 'linux':
            return 'linux'
        default:
            return opSys
    }
}

export function validateLibraryRules(rules?: Rule[]): boolean {
    if(rules == null) {
        return false
    }
    for(const rule of rules){
        if(rule.action != null && rule.os != null){
            const osName = rule.os.name
            const osMoj = getMojangOS()
            if(rule.action === 'allow'){
                return osName === osMoj
            } else if(rule.action === 'disallow'){
                return osName !== osMoj
            }
        }
    }
    return true
}

export function validateLibraryNatives(natives?: Natives): boolean {
    return natives == null ? true : Object.hasOwnProperty.call(natives, getMojangOS())
}

export function isLibraryCompatible(rules?: Rule[], natives?: Natives): boolean {
    return rules == null ? validateLibraryNatives(natives) : validateLibraryRules(rules)
}

/**
 * Returns true if the actual version is greater than
 * or equal to the desired version.
 * 
 * @param {string} desired The desired version.
 * @param {string} actual The actual version.
 */
export function mcVersionAtLeast(desired: string, actual: string){
    const des = desired.split('.')
    const act = actual.split('.')

    for(let i=0; i<des.length; i++){
        if(!(parseInt(act[i]) >= parseInt(des[i]))){
            return false
        }
    }
    return true
}