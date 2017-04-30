
exports.mojangFriendlyOS = function(){
    const opSys = process.platform
    if (opSys === 'darwin') {
        return 'osx';
    } else if (opSys === 'win32'){
        return 'windows';
    } else if (opSys === 'linux'){
        return 'linux';
    } else {
        return 'unknown_os';
    }
}

exports.validateRules = function(rules){
    if(rules == null) return true

    let result = true
    rules.forEach(function(rule){
        const action = rule['action']
        const osProp = rule['os']
        if(action != null){
            if(osProp != null){
                 const osName = osProp['name']
                 const osMoj = exports.mojangFriendlyOS()
                 if(action === 'allow'){
                     result = osName === osMoj
                     return
                 } else if(action === 'disallow'){
                     result = osName !== osMoj
                     return
                 }
            }
        }
    })
    return result
}