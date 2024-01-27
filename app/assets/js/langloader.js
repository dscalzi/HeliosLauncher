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

exports.queryJS = function(id, placeHolders){
    return exports.query(`js.${id}`, placeHolders)
}

exports.queryEJS = function(id, placeHolders){
    return exports.query(`ejs.${id}`, placeHolders)
}

exports.setupLanguage = function(){
    // Load Language Files
    exports.loadLanguage('en_US')
    // Uncomment this when translations are ready
    // exports.loadLanguage('fr_FR')

    // Load Custom Language File for Launcher Customizer
    exports.loadLanguage('_custom')
}