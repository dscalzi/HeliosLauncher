import { RestResponse } from 'common/got/RestResponse'

/**
 * @see https://wiki.vg/Authentication#Errors
 */
export enum MojangErrorCode {
    ERROR_METHOD_NOT_ALLOWED,       // INTERNAL
    ERROR_NOT_FOUND,                // INTERNAL
    ERROR_USER_MIGRATED,
    ERROR_INVALID_CREDENTIALS,
    ERROR_RATELIMIT,
    ERROR_INVALID_TOKEN,
    ERROR_ACCESS_TOKEN_HAS_PROFILE, // ??
    ERROR_CREDENTIALS_ARE_NULL,     // INTERNAL
    ERROR_INVALID_SALT_VERSION,     // ??
    ERROR_UNSUPPORTED_MEDIA_TYPE,   // INTERNAL
    UNKNOWN
}

export interface MojangResponse<T> extends RestResponse<T> {
    mojangErrorCode?: MojangErrorCode
    isInternalError?: boolean
}

export interface MojangErrorBody {
    error: string
    errorMessage: string
    cause?: string
}

/**
 * Resolve the error response code from the response body.
 * 
 * @param body The mojang error body response.
 */
export function decipherErrorCode(body: MojangErrorBody): MojangErrorCode {

    if(body.error === 'Method Not Allowed') {
        return MojangErrorCode.ERROR_METHOD_NOT_ALLOWED
    } else if(body.error === 'Not Found') {
        return MojangErrorCode.ERROR_NOT_FOUND
    } else if(body.error === 'Unsupported Media Type') {
        return MojangErrorCode.ERROR_UNSUPPORTED_MEDIA_TYPE
    } else if(body.error === 'ForbiddenOperationException') {

        if(body.cause && body.cause === 'UserMigratedException') {
            return MojangErrorCode.ERROR_USER_MIGRATED
        }

        if(body.errorMessage === 'Invalid credentials. Invalid username or password.') {
            return MojangErrorCode.ERROR_INVALID_CREDENTIALS
        } else if(body.errorMessage === 'Invalid credentials.') {
            return MojangErrorCode.ERROR_RATELIMIT
        } else if(body.errorMessage === 'Invalid token.') {
            return MojangErrorCode.ERROR_INVALID_TOKEN
        }

    } else if(body.error === 'IllegalArgumentException') {

        if(body.errorMessage === 'Access token already has a profile assigned.') {
            return MojangErrorCode.ERROR_ACCESS_TOKEN_HAS_PROFILE
        } else if(body.errorMessage === 'credentials is null') {
            return MojangErrorCode.ERROR_CREDENTIALS_ARE_NULL
        } else if(body.errorMessage === 'Invalid salt version') {
            return MojangErrorCode.ERROR_INVALID_SALT_VERSION
        }

    }

    return MojangErrorCode.UNKNOWN

}

// These indicate problems with the code and not the data.
export function isInternalError(errorCode: MojangErrorCode): boolean {
    switch(errorCode) {
        case MojangErrorCode.ERROR_METHOD_NOT_ALLOWED:       // We've sent the wrong method to an endpoint. (ex. GET to POST)
        case MojangErrorCode.ERROR_NOT_FOUND:                // Indicates endpoint has changed. (404)
        case MojangErrorCode.ERROR_ACCESS_TOKEN_HAS_PROFILE: // Selecting profiles isn't implemented yet. (Shouldnt happen)
        case MojangErrorCode.ERROR_CREDENTIALS_ARE_NULL:     // Username/password was not submitted. (UI should forbid this)
        case MojangErrorCode.ERROR_INVALID_SALT_VERSION:     // ??? (Shouldnt happen)
        case MojangErrorCode.ERROR_UNSUPPORTED_MEDIA_TYPE:   // Data was not submitted as application/json
            return true
        default:
            return false
    }
}