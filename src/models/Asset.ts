/** Class representing a base asset. */
export class Asset {
    /**
     * Create an asset.
     * 
     * @param {any} id The id of the asset.
     * @param {string} hash The hash value of the asset.
     * @param {number} size The size in bytes of the asset.
     * @param {string} from The url where the asset can be found.
     * @param {string} to The absolute local file path of the asset.
     */
    constructor(
        public id: any,
        public hash: string,
        public size: number,
        public from: string,
        public to: string
    ) {
    }
}