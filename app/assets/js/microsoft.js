const got = require('got').extend({
    responseType: 'json',
    resolveBodyOnly: true
})

// TODO: Add client ID (https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
const CLIENT_ID = ''

const TOKEN_URI = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
const AUTH_XBL_URI = 'https://user.auth.xboxlive.com/user/authenticate'
const AUTH_XSTS_URI = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const AUTH_MC_URI = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const PROFILE_URI = 'https://api.minecraftservices.com/minecraft/profile'

async function getXBLToken(accessToken) {
    const {
        Token: token,
        DisplayClaims: displayClaims
    } = await got.post(AUTH_XBL_URI, {
        json: {
            Properties: {
                AuthMethod: 'RPS',
                SiteName: 'user.auth.xboxlive.com',
                RpsTicket: `d=${accessToken}`
            },
            RelyingParty: 'http://auth.xboxlive.com',
            TokenType: 'JWT'
        }
    })

    return {
        token,
        uhs: displayClaims.xui[0].uhs
    }
}

async function getXSTSToken(XBLToken) {
    const data = await got.post(AUTH_XSTS_URI, {
        json: {
            Properties: {
                SandboxId: 'RETAIL',
                UserTokens: [XBLToken]
            },
            RelyingParty: 'rp://api.minecraftservices.com/',
            TokenType: 'JWT'
        }
    })

    if (data.XErr) {
        switch (data.XErr) {
            case 2148916233:
                throw {
                    message: 'Your Microsoft account is not connected to an Xbox account. Please create one.<br>'
                }
            case 2148916238:
                throw {
                    message: 'Since you are not yet 18 years old, an adult must add you to a family in order for you to use Helios Launcher!'
                }
        }
        throw data
    }

    return data.Token
}

async function getMCAccessToken(UHS, XSTSToken) {
    const data = await got.post(AUTH_MC_URI, {
        json: {
            identityToken: `XBL3.0 x=${UHS};${XSTSToken}`
        }
    })

    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in)

    return {
        expired_at: expiresAt,
        access_token: data.access_token
    }
}

exports.getAccessToken = async authCode => {
    const {
        expires_in,
        access_token,
        refresh_token
    } = await got.post(TOKEN_URI, {
        form: {
            client_id: CLIENT_ID,
            code: authCode,
            scope: 'XboxLive.signin',
            redirect_uri: 'https://login.microsoftonline.com/common/oauth2/nativeclient',
            grant_type: 'authorization_code'
        }
    })

    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in)

    return {
        expires_at: expiresAt,
        access_token,
        refresh_token
    }
}

exports.refreshAccessToken = async refreshToken => {
    const {
        expires_in,
        access_token
    } = await got.post(TOKEN_URI, {
        form: {
            client_id: CLIENT_ID,
            refresh_token: refreshToken,
            scope: 'XboxLive.signin',
            redirect_uri: 'https://login.microsoftonline.com/common/oauth2/nativeclient',
            grant_type: 'refresh_token'
        },
        responseType: 'json'
    })

    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in)

    return {
        expires_at: expiresAt,
        access_token
    }
}

exports.authMinecraft = async accessToken => {
    const XBLToken = await getXBLToken(accessToken)
    const XSTSToken = await getXSTSToken(XBLToken.token)
    const MCToken = await getMCAccessToken(XBLToken.uhs, XSTSToken)

    return MCToken
}

exports.checkMCStore = async access_token => {
    try {
        const {items} = await got('https://api.minecraftservices.com/entitlements/mcstore', {
            headers: {
                Authorization: 'Bearer ' + access_token
            },
            responseType: 'json'
        })

        return items && items.length > 0
    } catch {
        return false
    }
}

exports.getMCProfile = async MCAccessToken => {
    const data = await got(PROFILE_URI, {
        headers: {
            Authorization: `Bearer ${MCAccessToken}`
        }
    })

    return data
}