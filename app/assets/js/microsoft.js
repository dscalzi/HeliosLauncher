// Requirements
const request = require('request')

// Constants
const clientId = '0c7c8228-98ff-4ed8-ae28-af41852ba6ab'

const tokenUri = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
const authXBLUri = 'https://user.auth.xboxlive.com/user/authenticate'
const authXSTSUri = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const authMCUri = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const profileURI = 'https://api.minecraftservices.com/minecraft/profile'

// Functions
function requestPromise(uri, options) {
    return new Promise((resolve, reject) => {
        request(uri, options, (error, response, body) => {
            if (error) {
                reject(error)
            } else if (response.statusCode !== 200) {
                reject([response.statusCode, response.statusMessage, response])
            } else {
                resolve(response)
            }
        })
    })
}

function getXBLToken(accessToken) {
    return new Promise((resolve, reject) => {
        const data = new Object()

        const options = {
            method: 'post',
            json: {
                Properties: {
                    AuthMethod: 'RPS',
                    SiteName: 'user.auth.xboxlive.com',
                    RpsTicket: `d=${accessToken}`
                },
                RelyingParty: 'http://auth.xboxlive.com',
                TokenType: 'JWT'
            }
        }
        requestPromise(authXBLUri, options).then(response => {
            const body = response.body

            data.token = body.Token
            data.uhs = body.DisplayClaims.xui[0].uhs

            resolve(data)
        }).catch(error => {
            reject(error)
        })
    })
}

function getXSTSToken(XBLToken) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'post',
            json: {
                Properties: {
                    SandboxId: 'RETAIL',
                    UserTokens: [XBLToken]
                },
                RelyingParty: 'rp://api.minecraftservices.com/',
                TokenType: 'JWT'
            }
        }
        requestPromise(authXSTSUri, options).then(response => {
            if (response.body.XErr) {
                switch (response.body.XErr) {
                    case 2148916233:
                        reject({
                            message: 'Your Microsoft account is not connected to an Xbox account. Please create one.<br>'
                        })
                        return
        
                    case 2148916238: 
                        reject({
                            message: 'Since you are not yet 18 years old, an adult must add you to a family in order for you to use the ArdacraftLauncher!'
                        })
                        return
                
                }
                reject(response.body)
            }
            resolve(response.body.Token)
        }).catch(error => {
            reject(error)
        })
    })
}

function getMCAccessToken(UHS, XSTSToken) {
    return new Promise((resolve, reject) => {
        const data = new Object()
        const expiresAt = new Date()

        const options = {
            method: 'post',
            json: {
                identityToken: `XBL3.0 x=${UHS};${XSTSToken}`
            }
        }
        requestPromise(authMCUri, options).then(response => {
            const body = response.body

            expiresAt.setSeconds(expiresAt.getSeconds() + body.expires_in)
            data.access_token = body.access_token
            data.expires_at = expiresAt

            resolve(data)
        }).catch(error => {
            reject(error)
        })
    })
}

// Exports
exports.getAccessToken = authCode => {
    return new Promise((resolve, reject) => {
        const expiresAt = new Date()
        const data = new Object()

        const options = {
            method: 'post',
            formData: {
                client_id: clientId,
                code: authCode,
                scope: 'XboxLive.signin',
                redirect_uri: 'https://login.microsoftonline.com/common/oauth2/nativeclient',
                grant_type: 'authorization_code'
            }
        }
        requestPromise(tokenUri, options).then(response => {
            const body = JSON.parse(response.body)
            expiresAt.setSeconds(expiresAt.getSeconds() + body.expires_in)
            data.expires_at = expiresAt
            data.access_token = body.access_token
            data.refresh_token = body.refresh_token

            resolve(data)
        }).catch(error => {
            reject(error)
        })
    })
}

exports.refreshAccessToken = refreshToken => {
    return new Promise((resolve, reject) => {
        const expiresAt = new Date()
        const data = new Object()

        const options = {
            method: 'post',
            formData: {
                client_id: clientId,
                refresh_token: refreshToken,
                scope: 'XboxLive.signin',
                redirect_uri: 'https://login.microsoftonline.com/common/oauth2/nativeclient',
                grant_type: 'refresh_token'
            }
        }
        requestPromise(tokenUri, options).then(response => {
            const body = JSON.parse(response.body)
            expiresAt.setSeconds(expiresAt.getSeconds() + body.expires_in)
            data.expires_at = expiresAt
            data.access_token = body.access_token

            resolve(data)
        }).catch(error => {
            reject(error)
        })
    })
}

exports.authMinecraft = async accessToken => {
    try {
        const XBLToken = await getXBLToken(accessToken)
        const XSTSToken = await getXSTSToken(XBLToken.token)
        const MCToken = await getMCAccessToken(XBLToken.uhs, XSTSToken)

        return MCToken
    } catch (error) {
        Promise.reject(error)
    }
}

exports.checkMCStore = async function(access_token){
    return new Promise((resolve, reject) => {
        request.get({
            url: 'https://api.minecraftservices.com/entitlements/mcstore',
            json: true,
            headers: {
                Authorization: 'Bearer ' + access_token
            }
        }, (err, res, body) => {
            if (err) {
                resolve(false)
                return
            }
            if(body.items && body.items.length > 0) resolve(true)
            else resolve(false)
        })
    })
}

exports.getMCProfile = MCAccessToken => {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'get',
            headers: {
                Authorization: `Bearer ${MCAccessToken}`
            }
        }
        requestPromise(profileURI, options).then(response => {
            const body = JSON.parse(response.body)

            resolve(body)
        }).catch(error => {
            reject(error)
        })
    })
}  
