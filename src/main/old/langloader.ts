import { readJSONSync } from 'fs-extra'
import { join } from 'path'

// TODO revisit

let lang: any

export function loadLanguage(id: string){
    lang = readJSONSync(join(__dirname, '..', 'assets', 'lang', `${id}.json`)) || {}
}

export function query(id: string){
    let query = id.split('.')
    let res = lang
    for(let q of query){
        res = res[q]
    }
    return res === lang ? {} : res
}

export function queryJS(id: string){
    return exports.query(`js.${id}`)
}