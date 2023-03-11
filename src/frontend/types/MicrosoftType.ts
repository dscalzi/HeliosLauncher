import { ConfigManager } from './manager/ConfigManager';
// NOTE FOR THIRD-PARTY
// REPLACE THIS CLIENT ID WITH YOUR APPLICATION ID.
// SEE https://github.com/dscalzi/HeliosLauncher/blob/master/docs/MicrosoftAuth.md
exports.AZURE_CLIENT_ID = ConfigManager.azureClientId;
// SEE NOTE ABOVE.


// Opcodes
export enum MSFT_OPCODE {
    OPEN_LOGIN = 'MSFT_AUTH_OPEN_LOGIN',
    OPEN_LOGOUT = 'MSFT_AUTH_OPEN_LOGOUT',
    REPLY_LOGIN = 'MSFT_AUTH_REPLY_LOGIN',
    REPLY_LOGOUT = 'MSFT_AUTH_REPLY_LOGOUT'
}
// Reply types for REPLY opcode.
export enum MSFT_REPLY_TYPE {
    SUCCESS = 'MSFT_AUTH_REPLY_SUCCESS',
    ERROR = 'MSFT_AUTH_REPLY_ERROR'
}
// Error types for ERROR reply.
export enum MSFT_ERROR {
    ALREADY_OPEN = 'MSFT_AUTH_ERR_ALREADY_OPEN',
    NOT_FINISHED = 'MSFT_AUTH_ERR_NOT_FINISHED'
}

export enum SHELL_OPCODE {
    TRASH_ITEM = 'TRASH_ITEM'
}