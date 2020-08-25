import { RequestError, HTTPError, TimeoutError, ParseError } from 'got'
import { Logger } from 'winston'

export enum RestResponseStatus {
    
    SUCCESS,
    ERROR

}

export interface RestResponse<T> {

    data: T
    responseStatus: RestResponseStatus
    error?: RequestError

}

export function handleGotError<T>(operation: string, error: RequestError, logger: Logger, dataProvider: () => T): RestResponse<T> {
    const response: RestResponse<T> = {
        data: dataProvider(),
        responseStatus: RestResponseStatus.ERROR,
        error
    }
    
    if(error instanceof HTTPError) {
        logger.error(`Error during ${operation} request (HTTP Response ${error.response.statusCode})`, error)
        logger.debug('Response Details:')
        logger.debug('Body:', error.response.body)
        logger.debug('Headers:', error.response.headers)
    } else if(Object.getPrototypeOf(error) instanceof RequestError) {
        logger.error(`${operation} request recieved no response (${error.code}).`, error)
    } else if(error instanceof TimeoutError) {
        logger.error(`${operation} request timed out (${error.timings.phases.total}ms).`)
    } else if(error instanceof ParseError) {
        logger.error(`${operation} request recieved unexepected body (Parse Error).`)
    } else {
        // CacheError, ReadError, MaxRedirectsError, UnsupportedProtocolError, CancelError
        logger.error(`Error during ${operation} request.`, error)
    }

    return response
}