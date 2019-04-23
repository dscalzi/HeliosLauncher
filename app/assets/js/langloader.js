const fs = require('fs-extra')
const path = require('path')

let lang

exports.loadLanguage = function(id){
    lang = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lang', `${id}.json`))) || {}
}

exports.query = function(id){
    let query = id.split('.')
    let res = lang
    for(let q of query){
        res = res[q]
    }
    return res === lang ? {} : res
}

exports.queryJS = function(id){
    return exports.query(`js.${id}`)
}