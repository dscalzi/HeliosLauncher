export class MinecraftUtil {

    /**
     * Returns true if the actual version is greater than
     * or equal to the desired version.
     * 
     * @param {string} desired The desired version.
     * @param {string} actual The actual version.
     */
    public static mcVersionAtLeast(desired: string, actual: string) {
        const des = desired.split(".");
        const act = actual.split(".");

        for (let i = 0; i < des.length; i++) {
            if (!(parseInt(act[i]) >= parseInt(des[i]))) {
                return false;
            }
        }
        return true;
    }

    public static isForgeGradle3(mcVersion: string, forgeVersion: string) {

        if (this.mcVersionAtLeast('1.13', mcVersion)) return true;

        try {
            const forgeVer = forgeVersion.split('-')[1]
            const maxFG2 = [14, 23, 5, 2847]
            const verSplit = forgeVer.split('.').map(v => Number(v))

            for (let i = 0; i < maxFG2.length; i++) {
                if (verSplit[i] > maxFG2[i]) {
                    return true
                } else if (verSplit[i] < maxFG2[i]) {
                    return false
                }
            }
            return false
        } catch (err) {
            throw new Error('Forge version is complex (changed).. launcher requires a patch.')
        }
    }

    public static isAutoconnectBroken(forgeVersion: string) {
        const minWorking = [31, 2, 15]
        const verSplit = forgeVersion.split('.').map(v => Number(v))

        if (verSplit[0] === 31) {
            for (let i = 0; i < minWorking.length; i++) {
                if (verSplit[i] > minWorking[i]) {
                    return false
                } else if (verSplit[i] < minWorking[i]) {
                    return true
                }
            }
        }

        return false
    }

}
