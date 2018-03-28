const request = require('request')

const minecraftAgent = {
    name: 'Minecraft',
    version: 1
}
const authpath = 'https://authserver.mojang.com'
const statuses = [
    {
        service: 'minecraft.net',
        status: 'grey',
        name: 'Minecraft.net'
    },
    {
        service: 'api.mojang.com',
        status: 'grey',
        name: 'Public API'
    },
    {
        service: 'textures.minecraft.net',
        status: 'grey',
        name: 'Minecraft Skins'
    },
    {
        service: 'authserver.mojang.com',
        status: 'grey',
        name: 'Authentication Service'
    },
    {
        service: 'sessionserver.mojang.com',
        status: 'grey',
        name: 'Multiplayer Session Service'
    },
    {
        service: 'account.mojang.com',
        status: 'grey',
        name: 'Mojang accounts website'
    }
]

/**
 * Converts a Mojang status color to a hex value. Valid statuses
 * are 'green', 'yellow', 'red', and 'grey'. Grey is a custom status
 * to our project which represends an unknown status.
 * 
 * @param {string} status A valid status code.
 * @returns {string} The hex color of the status code.
 */
exports.statusToHex = function(status){
    switch(status.toLowerCase()){
        case 'green':
            return '#a5c325'
        case 'yellow':
            return '#eac918'
        case 'red':
            return '#c32625'
        case 'grey':
        default:
            return '#848484'
    }
}

/**
 * Retrieves the status of Mojang's services.
 * The response is condensed into a single object. Each service is
 * a key, where the value is an object containing a status and name
 * property.
 * 
 * @see http://wiki.vg/Mojang_API#API_Status
 */
exports.status = function(){
    return new Promise(function(fulfill, reject) {
        request.get('https://status.mojang.com/check',
        {
            json: true
        },
        function(error, response, body){
            if(response.statusCode === 200){
                for(let i=0; i<body.length; i++){
                    const key = Object.keys(body[i])[0]
                    inner:
                    for(let j=0; j<statuses.length; j++){
                        if(statuses[j].service === key) {
                            statuses[j].status = body[i][key]
                            break inner
                        }
                    }
                }
                fulfill(statuses)
            } else {
                reject()
            }
        })
    })
}

/**
 * Authenticate a user with their Mojang credentials.
 * 
 * @param {string} username The user's username, this is often an email.
 * @param {string} password The user's password.
 * @param {string} clientToken The launcher's Client Token.
 * @param {boolean} requestUser Optional. Adds user object to the reponse.
 * @param {Object} agent Optional. Provided by default. Adds user info to the response.
 * 
 * @see http://wiki.vg/Authentication#Authenticate
 */
exports.authenticate = function(username, password, clientToken, requestUser = true, agent = minecraftAgent){
    return new Promise(function(fulfill, reject){
        request.post(authpath + '/authenticate',
        {
            json: true,
            body: {
                agent,
                username,
                password,
                clientToken,
                requestUser
            }
        },
        function(error, response, body){
            if(response.statusCode === 200){
                fulfill(body)
            } else {
                reject(body)
            }
        })
    })
}

/**
 * Validate an access token. This should always be done before launching.
 * The client token should match the one used to create the access token.
 * 
 * @param {string} accessToken The access token to validate.
 * @param {string} clientToken The launcher's client token.
 * 
 * @see http://wiki.vg/Authentication#Validate
 */
exports.validate = function(accessToken, clientToken){
    return new Promise(function(fulfill, reject){
        request.post(authpath + '/validate',
        {
            json: true,
            body: {
                accessToken,
                clientToken
            }
        },
        function(error, response, body){
            if(response.statusCode === 403){
                fulfill(false)
            } else {
                // 204 if valid
                fulfill(true)
            }
        })
    })
}

/**
 * Invalidates an access token. The clientToken must match the
 * token used to create the provided accessToken.
 * 
 * @param {string} accessToken The access token to invalidate.
 * @param {string} clientToken The launcher's client token.
 * 
 * @see http://wiki.vg/Authentication#Invalidate
 */
exports.invalidate = function(accessToken, clientToken){
    return new Promise(function(fulfill, reject){
        request.post(authpath + '/invalidate',
        {
            json: true,
            body: {
                accessToken,
                clientToken
            }
        },
        function(error, response, body){
            if(response.statusCode === 200){
                fulfill()
            } else {
                reject()
            }
        })
    })
}

/**
 * Refresh a user's authentication. This should be used to keep a user logged
 * in without asking them for their credentials again. A new access token will
 * be generated using a recent invalid access token. See Wiki for more info.
 * 
 * @param {string} accessToken The old access token.
 * @param {string} clientToken The launcher's client token.
 * @param {boolean} requestUser Optional. Adds user object to the reponse.
 * 
 * @see http://wiki.vg/Authentication#Refresh
 */
exports.refresh = function(accessToken, clientToken, requestUser = true){
    return new Promise(function(fulfill, reject){
        request.post(authpath + '/refresh',
        {
            json: true,
            body: {
                accessToken,
                clientToken,
                requestUser
            }
        },
        function(error, response, body){
            if(response.statusCode === 200){
                fulfill(body)
            } else {
                reject(response.body)
            }
        })
    })
}