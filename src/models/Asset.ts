/** Class representing a base asset. */

export interface IAsset {
    id: string,
    hash: string,
    size: number,
    from: string,
    to: string
}

export class Asset {
    /**
     * Create an asset.
     * 
     * @param {string} id The id of the asset.
     * @param {string} hash The hash value of the asset.
     * @param {number} size The size in bytes of the asset.
     * @param {string} from The url where the asset can be found.
     * @param {string} to The absolute local file path of the asset.
     */
    constructor(
        public id: string,
        public hash: string,
        public size: number,
        public from: string,
        public to: string
    ) {
    }
}