import { GotError } from "got/dist/source"

/**
 * @see https://wiki.vg/Authentication#Errors
 */
export enum MojangResponseCode {
    SUCCESS,
    ERROR,
    ERROR_METHOD_NOT_ALLOWED, // INTERNAL
    ERROR_NOT_FOUND, // INTERNAL
    ERROR_USER_MIGRATED,
    ERROR_INVALID_CREDENTIALS,
    ERROR_RATELIMIT,
    ERROR_INVALID_TOKEN,
    ERROR_ACCESS_TOKEN_HAS_PROFILE, // ??
    ERROR_CREDENTIALS_ARE_NULL, // INTERNAL
    ERROR_INVALID_SALT_VERSION, // ??
    ERROR_UNSUPPORTED_MEDIA_TYPE // INTERNAL
}

export interface MojangResponse<T> {

    data: T
    responseCode: MojangResponseCode
    error?: GotError
    isInternalError?: boolean

}

export interface MojangErrorBody {
    error: string
    errorMessage: string
    cause?: string
}

export function deciperResponseCode(body: MojangErrorBody): MojangResponseCode {

    if(body.error === 'Method Not Allowed') {
        return MojangResponseCode.ERROR_METHOD_NOT_ALLOWED
    } else if(body.error === 'Not Found') {
        return MojangResponseCode.ERROR_NOT_FOUND
    } else if(body.error === 'Unsupported Media Type') {
        return MojangResponseCode.ERROR_UNSUPPORTED_MEDIA_TYPE
    } else if(body.error === 'ForbiddenOperationException') {

        if(body.cause && body.cause === 'UserMigratedException') {
            return MojangResponseCode.ERROR_USER_MIGRATED
        }

        if(body.errorMessage === 'Invalid credentials. Invalid username or password.') {
            return MojangResponseCode.ERROR_INVALID_CREDENTIALS
        } else if(body.errorMessage === 'Invalid credentials.') {
            return MojangResponseCode.ERROR_RATELIMIT
        } else if(body.errorMessage === 'Invalid token.') {
            return MojangResponseCode.ERROR_INVALID_TOKEN
        }

    } else if(body.error === 'IllegalArgumentException') {

        if(body.errorMessage === 'Access token already has a profile assigned.') {
            return MojangResponseCode.ERROR_ACCESS_TOKEN_HAS_PROFILE
        } else if(body.errorMessage === 'credentials is null') {
            return MojangResponseCode.ERROR_CREDENTIALS_ARE_NULL
        } else if(body.errorMessage === 'Invalid salt version') {
            return MojangResponseCode.ERROR_INVALID_SALT_VERSION
        }

    }

    return MojangResponseCode.ERROR

}

// These indicate problems with the code and not the data.
export function isInternalError(responseCode: MojangResponseCode): boolean {
    switch(responseCode) {
        // We've sent the wrong method to an endpoint. (ex. GET to POST)
        case MojangResponseCode.ERROR_METHOD_NOT_ALLOWED:
        // Indicates endpoint has changed. (404)
        case MojangResponseCode.ERROR_NOT_FOUND:
        // Selecting profiles isn't implemented yet. (Shouldnt happen)
        case MojangResponseCode.ERROR_ACCESS_TOKEN_HAS_PROFILE:
        // Username/password was not submitted. (UI should forbid this)
        case MojangResponseCode.ERROR_CREDENTIALS_ARE_NULL:
        // ??? (Shouldnt happen)
        case MojangResponseCode.ERROR_INVALID_SALT_VERSION:
        // Data was not submitted as application/json
        case MojangResponseCode.ERROR_UNSUPPORTED_MEDIA_TYPE:
            return true
        default:
            return false
    }
}