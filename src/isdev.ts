'use strict'
const getFromEnv = parseInt(process.env.ELECTRON_IS_DEV as string, 10) === 1
const isEnvSet = 'ELECTRON_IS_DEV' in process.env

export default (isEnvSet ? getFromEnv : (process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath))) as boolean