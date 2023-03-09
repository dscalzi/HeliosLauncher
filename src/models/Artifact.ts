/**
 * Represents the download information
 * for a specific module.
 */

export interface IArtifact {
    MD5: string,
    size: string,
    url: string,
    path: string,
}

export class Artifact {

    /**
     * Parse a JSON object into an Artifact.
     * 
     * @param {Object} json A JSON object representing an Artifact
     * 
     * @returns {Artifact} The parsed Artifact.
     */
    public static fromJSON(json: IArtifact) {
        return new Artifact(json.MD5, json.size, json.url, json.path)
    }

    constructor(
        public MD5: string,
        public size: string,
        public url: string,
        public path: string,
    ) { }

    //TODO: Remove those property

    /**
     * Get the MD5 hash of the artifact. This value may
     * be undefined for artifacts which are not to be
     * validated and updated.
     * 
     * @returns {string} The MD5 hash of the Artifact or undefined.
     */
    public getHash() {
        return this.MD5
    }

    /**
     * @returns {number} The download size of the artifact.
     */
    public getSize() {
        return this.size
    }

    /**
     * @returns {string} The download url of the artifact.
     */
    public getURL() {
        return this.url
    }

    /**
     * @returns {string} The artifact's destination path.
     */
    public getPath() {
        return this.path
    }

}