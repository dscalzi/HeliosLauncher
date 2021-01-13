// Requirements
const request = require('request')
// const logger = require('./loggerutil')('%c[Microsoft]', 'color: #01a6f0; font-weight: bold')

// Constants
const clientId = 'Client ID(Azure)'
const tokenUri = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
const authXBLUri = 'https://user.auth.xboxlive.com/user/authenticate'
const authXSTSUri = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const authMCUri = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const profileURI ='https://api.minecraftservices.com/minecraft/profile'

// Functions
function requestPromise(uri, options) {
    return new Promise((resolve, reject) => {
        request(uri, options, (error, response, body) => {
            if (error) {
                reject(error)
            } else if (response.statusCode !== 200){
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
            const body = response.body

            resolve(body.Token)
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