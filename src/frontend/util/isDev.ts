const getFromEnv = parseInt(process.env.ELECTRON_IS_DEV ?? "", 10) === 1
const isEnvSet = 'ELECTRON_IS_DEV' in process.env

export class DevUtil {
    private static enforceDevMode = false;

    public static get IsDev() {
        //@ts-ignore
        return this.enforceDevMode ?? isEnvSet ? getFromEnv : (process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath))
    }

    public static set IsDev(value) {
        this.enforceDevMode = value;
    }
}