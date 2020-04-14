import { LoggerUtil } from '../logging/loggerutil'
import { Agent } from '../model/mojang/auth/Agent'
import { Status, StatusColor } from './type/Status'
import axios, { AxiosError } from 'axios'
import { Session } from '../model/mojang/auth/Session'
import { AuthPayload } from '../model/mojang/auth/AuthPayload'
import { MojangResponse, MojangResponseCode, deciperResponseCode, isInternalError } from './type/Response'

export class Mojang {

    private static readonly logger = LoggerUtil.getLogger('Mojang')

    private static readonly TIMEOUT = 2500

    public static readonly AUTH_ENDPOINT = 'https://authserver.mojang.com'
    public static readonly STATUS_ENDPOINT = 'https://status.mojang.com/check'

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

    private static handleAxiosError<T>(operation: string, error: AxiosError, dataProvider: () => T): MojangResponse<T> {
        const response: MojangResponse<T> = {
            data: dataProvider(),
            responseCode: MojangResponseCode.ERROR,
            error
        }

        if(error.response) {
            response.responseCode = deciperResponseCode(error.response.data)
            Mojang.logger.error(`Error during ${operation} request (HTTP Response ${error.response.status})`, error)
            Mojang.logger.debug('Response Details:')
            Mojang.logger.debug('Data:', error.response.data)
            Mojang.logger.debug('Headers:', error.response.headers)
        } else if(error.request) {
            Mojang.logger.error(`${operation} request recieved no response.`, error)
        } else {
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

            const res = await axios.get<{[service: string]: StatusColor}[]>(Mojang.STATUS_ENDPOINT, { timeout: Mojang.TIMEOUT })

            Mojang.expectSpecificSuccess('Mojang Status', 200, res.status)

            res.data.forEach(status => {
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

            return Mojang.handleAxiosError('Mojang Status', error as AxiosError, () => {
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

            const data: AuthPayload = {
                agent,
                username,
                password,
                requestUser
            }
            if(clientToken != null){
                data.clientToken = clientToken
            }

            const res = await axios.post<Session>(`${Mojang.AUTH_ENDPOINT}/authenticate`, data)
            Mojang.expectSpecificSuccess('Mojang Authenticate', 200, res.status)
            return {
                data: res.data,
                responseCode: MojangResponseCode.SUCCESS
            }

        } catch(err) {
            return Mojang.handleAxiosError('Mojang Authenticate', err, () => null)
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

            const data = {
                accessToken,
                clientToken
            }

            const res = await axios.post(`${Mojang.AUTH_ENDPOINT}/validate`, data)
            Mojang.expectSpecificSuccess('Mojang Validate', 204, res.status)

            return {
                data: res.status === 204,
                responseCode: MojangResponseCode.SUCCESS
            }

        } catch(err) {
            if(err.response && err.response.status === 403) {
                return {
                    data: false,
                    responseCode: MojangResponseCode.SUCCESS
                }
            }
            return Mojang.handleAxiosError('Mojang Validate', err, () => false)
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

            const data = {
                accessToken,
                clientToken
            }

            const res = await axios.post(`${Mojang.AUTH_ENDPOINT}/invalidate`, data)
            Mojang.expectSpecificSuccess('Mojang Invalidate', 204, res.status)

            return {
                data: undefined,
                responseCode: MojangResponseCode.SUCCESS
            }

        } catch(err) {
            return Mojang.handleAxiosError('Mojang Invalidate', err, () => undefined)
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

            const data = {
                accessToken,
                clientToken,
                requestUser
            }

            const res = await axios.post<Session>(`${Mojang.AUTH_ENDPOINT}/refresh`, data)
            Mojang.expectSpecificSuccess('Mojang Refresh', 200, res.status)

            return {
                data: res.data,
                responseCode: MojangResponseCode.SUCCESS
            }

        } catch(err) {
            return Mojang.handleAxiosError('Mojang Refresh', err, () => null)
        }

    }

}