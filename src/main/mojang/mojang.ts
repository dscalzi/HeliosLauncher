import { LoggerUtil } from '../logging/loggerutil'
import { Agent } from './model/auth/Agent'
import { Status, StatusColor } from './model/internal/Status'
import got, { RequestError, HTTPError, TimeoutError, GotError, ParseError } from 'got'
import { Session } from './model/auth/Session'
import { AuthPayload } from './model/auth/AuthPayload'
import { MojangResponse, MojangResponseCode, deciperResponseCode, isInternalError, MojangErrorBody } from './model/internal/Response'

export class Mojang {

    private static readonly logger = LoggerUtil.getLogger('Mojang')

    private static readonly TIMEOUT = 2500

    public static readonly AUTH_ENDPOINT = 'https://authserver.mojang.com'
    public static readonly STATUS_ENDPOINT = 'https://status.mojang.com'

    private static authClient = got.extend({
        prefixUrl: Mojang.AUTH_ENDPOINT,
        responseType: 'json',
        retry: 0
    })
    private static statusClient = got.extend({
        prefixUrl: Mojang.STATUS_ENDPOINT,
        responseType: 'json',
        retry: 0
    })

    public static readonly MINECRAFT_AGENT: Agent = {
        name: 'Minecraft',
        version: 1
    }

    protected static statuses: Status[] = [
        {
            service: 'sessionserver.mojang.com',
            status: StatusColor.GREY,
            name: 'Multiplayer Session Service',
            essential: true
        },
        {
            service: 'authserver.mojang.com',
            status: StatusColor.GREY,
            name: 'Authentication Service',
            essential: true
        },
        {
            service: 'textures.minecraft.net',
            status: StatusColor.GREY,
            name: 'Minecraft Skins',
            essential: false
        },
        {
            service: 'api.mojang.com',
            status: StatusColor.GREY,
            name: 'Public API',
            essential: false
        },
        {
            service: 'minecraft.net',
            status: StatusColor.GREY,
            name: 'Minecraft.net',
            essential: false
        },
        {
            service: 'account.mojang.com',
            status: StatusColor.GREY,
            name: 'Mojang Accounts Website',
            essential: false
        }
    ]

    /**
     * Converts a Mojang status color to a hex value. Valid statuses
     * are 'green', 'yellow', 'red', and 'grey'. Grey is a custom status
     * to our project which represents an unknown status.
     */
    public static statusToHex(status: string){
        switch(status.toLowerCase()){
            case StatusColor.GREEN:
                return '#a5c325'
            case StatusColor.YELLOW:
                return '#eac918'
            case StatusColor.RED:
                return '#c32625'
            case StatusColor.GREY:
            default:
                return '#848484'
        }
    }

    private static handleGotError<T>(operation: string, error: GotError, dataProvider: () => T): MojangResponse<T> {
        const response: MojangResponse<T> = {
            data: dataProvider(),
            responseCode: MojangResponseCode.ERROR,
            error
        }
        
        if(error instanceof HTTPError) {
            response.responseCode = deciperResponseCode(error.response.body as MojangErrorBody)
            Mojang.logger.error(`Error during ${operation} request (HTTP Response ${error.response.statusCode})`, error)
            Mojang.logger.debug('Response Details:')
            Mojang.logger.debug('Body:', error.response.body)
            Mojang.logger.debug('Headers:', error.response.headers)
        } else if(error instanceof RequestError) {
            Mojang.logger.error(`${operation} request recieved no response (${error.code}).`, error)
        } else if(error instanceof TimeoutError) {
            Mojang.logger.error(`${operation} request timed out (${error.timings.phases.total}ms).`)
        } else if(error instanceof ParseError) {
            Mojang.logger.error(`${operation} request recieved unexepected body (Parse Error).`)
        } else {
            // CacheError, ReadError, MaxRedirectsError, UnsupportedProtocolError, CancelError
            Mojang.logger.error(`Error during ${operation} request.`, error)
        }

        response.isInternalError = isInternalError(response.responseCode)

        return response
    }

    private static expectSpecificSuccess(operation: string, expected: number, actual: number) {
        if(actual !== expected) {
            Mojang.logger.warn(`${operation} expected ${expected} response, recieved ${actual}.`)
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
    public static async status(): Promise<MojangResponse<Status[]>>{
        try {

            const res = await Mojang.statusClient.get<{[service: string]: StatusColor}[]>('check')

            Mojang.expectSpecificSuccess('Mojang Status', 200, res.statusCode)

            res.body.forEach(status => {
                const entry = Object.entries(status)[0]
                for(let i=0; i<Mojang.statuses.length; i++) {
                    if(Mojang.statuses[i].service === entry[0]) {
                        Mojang.statuses[i].status = entry[1]
                        break
                    }
                }
            })

            return {
                data: Mojang.statuses,
                responseCode: MojangResponseCode.SUCCESS
            }

        } catch(error) {

            return Mojang.handleGotError('Mojang Status', error as GotError, () => {
                for(let i=0; i<Mojang.statuses.length; i++){
                    Mojang.statuses[i].status = StatusColor.GREY
                }
                return Mojang.statuses
            })
        }
        
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
    public static async authenticate(
        username: string,
        password: string,
        clientToken: string | null,
        requestUser: boolean = true,
        agent: Agent = Mojang.MINECRAFT_AGENT
    ): Promise<MojangResponse<Session | null>> {

        try {

            const json: AuthPayload = {
                agent,
                username,
                password,
                requestUser
            }
            if(clientToken != null){
                json.clientToken = clientToken
            }

            const res = await Mojang.authClient.post<Session>('authenticate', { json })
            Mojang.expectSpecificSuccess('Mojang Authenticate', 200, res.statusCode)
            return {
                data: res.body,
                responseCode: MojangResponseCode.SUCCESS
            }

        } catch(err) {
            return Mojang.handleGotError('Mojang Authenticate', err as GotError, () => null)
        }

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
    public static async validate(accessToken: string, clientToken: string): Promise<MojangResponse<boolean>> {

        try {

            const json = {
                accessToken,
                clientToken
            }

            const res = await Mojang.authClient.post('validate', { json })
            Mojang.expectSpecificSuccess('Mojang Validate', 204, res.statusCode)

            return {
                data: res.statusCode === 204,
                responseCode: MojangResponseCode.SUCCESS
            }

        } catch(err) {
            if(err instanceof HTTPError && err.response.statusCode === 403) {
                return {
                    data: false,
                    responseCode: MojangResponseCode.SUCCESS
                }
            }
            return Mojang.handleGotError('Mojang Validate', err as GotError, () => false)
        }

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
    public static async invalidate(accessToken: string, clientToken: string): Promise<MojangResponse<undefined>> {

        try {

            const json = {
                accessToken,
                clientToken
            }

            const res = await Mojang.authClient.post('invalidate', { json })
            Mojang.expectSpecificSuccess('Mojang Invalidate', 204, res.statusCode)

            return {
                data: undefined,
                responseCode: MojangResponseCode.SUCCESS
            }

        } catch(err) {
            return Mojang.handleGotError('Mojang Invalidate', err as GotError, () => undefined)
        }

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
    public static async refresh(accessToken: string, clientToken: string, requestUser: boolean = true): Promise<MojangResponse<Session | null>> {

        try {

            const json = {
                accessToken,
                clientToken,
                requestUser
            }

            const res = await Mojang.authClient.post<Session>('refresh', { json })
            Mojang.expectSpecificSuccess('Mojang Refresh', 200, res.statusCode)

            return {
                data: res.body,
                responseCode: MojangResponseCode.SUCCESS
            }

        } catch(err) {
            return Mojang.handleGotError('Mojang Refresh', err as GotError, () => null)
        }

    }

}