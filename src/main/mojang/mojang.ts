import request from 'request'
import { LoggerUtil } from '../loggerutil'
import { Agent } from '../model/mojang/auth/Agent'
import { AuthPayload } from '../model/mojang/auth/AuthPayload'
import { Session } from '../model/mojang/auth/Session'
import { Status } from './type/Status'

export class Mojang {

    private static readonly logger = new LoggerUtil('%c[Mojang]', 'color: #a02d2a; font-weight: bold')

    public static readonly AUTH_ENDPOINT = 'https://authserver.mojang.com'
    public static readonly MINECRAFT_AGENT: Agent = {
        name: 'Minecraft',
        version: 1
    }

    protected static statuses: Status[] = [
        {
            service: 'sessionserver.mojang.com',
            status: 'grey',
            name: 'Multiplayer Session Service',
            essential: true
        },
        {
            service: 'authserver.mojang.com',
            status: 'grey',
            name: 'Authentication Service',
            essential: true
        },
        {
            service: 'textures.minecraft.net',
            status: 'grey',
            name: 'Minecraft Skins',
            essential: false
        },
        {
            service: 'api.mojang.com',
            status: 'grey',
            name: 'Public API',
            essential: false
        },
        {
            service: 'minecraft.net',
            status: 'grey',
            name: 'Minecraft.net',
            essential: false
        },
        {
            service: 'account.mojang.com',
            status: 'grey',
            name: 'Mojang Accounts Website',
            essential: false
        }
    ]

    /**
     * Converts a Mojang status color to a hex value. Valid statuses
     * are 'green', 'yellow', 'red', and 'grey'. Grey is a custom status
     * to our project which represents an unknown status.
     * 
     * @param {string} status A valid status code.
     * @returns {string} The hex color of the status code.
     */
    public static statusToHex(status: string){
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
    public static status(): Promise<Status[]>{
        return new Promise((resolve, reject) => {
            request.get('https://status.mojang.com/check',
                {
                    json: true,
                    timeout: 2500
                },
                function(error, response, body: {[service: string]: 'red' | 'yellow' | 'green'}[]){

                    if(error || response.statusCode !== 200){
                        Mojang.logger.warn('Unable to retrieve Mojang status.')
                        Mojang.logger.debug('Error while retrieving Mojang statuses:', error)
                        //reject(error || response.statusCode)
                        for(let i=0; i<Mojang.statuses.length; i++){
                            Mojang.statuses[i].status = 'grey'
                        }
                        resolve(Mojang.statuses)
                    } else {
                        for(let i=0; i<body.length; i++){
                            const key = Object.keys(body[i])[0]
                            inner:
                            for(let j=0; j<Mojang.statuses.length; j++){
                                if(Mojang.statuses[j].service === key) {
                                    Mojang.statuses[j].status = body[i][key]
                                    break inner
                                }
                            }
                        }
                        resolve(Mojang.statuses)
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
    public static authenticate(
        username: string,
        password: string,
        clientToken: string | null,
        requestUser: boolean = true,
        agent: Agent = Mojang.MINECRAFT_AGENT
    ): Promise<Session> {
        return new Promise((resolve, reject) => {

            const body: AuthPayload = {
                agent,
                username,
                password,
                requestUser
            }
            if(clientToken != null){
                body.clientToken = clientToken
            }

            request.post(Mojang.AUTH_ENDPOINT + '/authenticate',
                {
                    json: true,
                    body
                },
                function(error, response, body){
                    if(error){
                        Mojang.logger.error('Error during authentication.', error)
                        reject(error)
                    } else {
                        if(response.statusCode === 200){
                            resolve(body)
                        } else {
                            reject(body || {code: 'ENOTFOUND'})
                        }
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
    public static validate(accessToken: string, clientToken: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            request.post(Mojang.AUTH_ENDPOINT + '/validate',
                {
                    json: true,
                    body: {
                        accessToken,
                        clientToken
                    }
                },
                function(error, response, body){
                    if(error){
                        Mojang.logger.error('Error during validation.', error)
                        reject(error)
                    } else {
                        if(response.statusCode === 403){
                            resolve(false)
                        } else {
                        // 204 if valid
                            resolve(true)
                        }
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
    public static invalidate(accessToken: string, clientToken: string): Promise<void>{
        return new Promise((resolve, reject) => {
            request.post(Mojang.AUTH_ENDPOINT + '/invalidate',
                {
                    json: true,
                    body: {
                        accessToken,
                        clientToken
                    }
                },
                function(error, response, body){
                    if(error){
                        Mojang.logger.error('Error during invalidation.', error)
                        reject(error)
                    } else {
                        if(response.statusCode === 204){
                            resolve()
                        } else {
                            reject(body)
                        }
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
    public static refresh(accessToken: string, clientToken: string, requestUser: boolean = true): Promise<Session> {
        return new Promise((resolve, reject) => {
            request.post(Mojang.AUTH_ENDPOINT + '/refresh',
                {
                    json: true,
                    body: {
                        accessToken,
                        clientToken,
                        requestUser
                    }
                },
                function(error, response, body){
                    if(error){
                        Mojang.logger.error('Error during refresh.', error)
                        reject(error)
                    } else {
                        if(response.statusCode === 200){
                            resolve(body)
                        } else {
                            reject(body)
                        }
                    }
                })
        })
    }

}