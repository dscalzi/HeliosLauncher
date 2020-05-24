import { createHash } from 'crypto'
import { join } from 'path'
import { pathExists, readFile } from 'fs-extra'

export function calculateHash(buf: Buffer, algo: string) {
    return createHash(algo).update(buf).digest('hex')
}

export async function validateLocalFile(path: string, algo: string, hash?: string): Promise<boolean> {
    if(await pathExists(path)) {
        if(hash == null) {
            return true
        }
        const buf = await readFile(path)
        return calculateHash(buf, algo) === hash
    }
    return false
}

function getVersionExtPath(commonDir: string, version: string, ext: string) {
    return join(commonDir, 'versions', version, `${version}.${ext}`)
}

export function getVersionJsonPath(commonDir: string, version: string) {
    return getVersionExtPath(commonDir, version, 'json')
}

export function getVersionJarPath(commonDir: string, version: string) {
    return getVersionExtPath(commonDir, version, 'jar')
}

export function getLibraryDir(commonDir: string) {
    return join(commonDir, 'libraries')
}