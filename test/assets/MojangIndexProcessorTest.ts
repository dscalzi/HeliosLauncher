import nock from 'nock'
import { URL } from 'url'
import { MojangIndexProcessor } from '../../src/main/asset/processor/MojangIndexProcessor'
import { dirname, join } from 'path'
import { expect } from 'chai'
import { remove, pathExists } from 'fs-extra'
import { getVersionJsonPath } from '../../src/main/util/FileUtils'

// @ts-ignore (JSON Modules enabled in tsconfig.test.json)
import versionManifest from './files/version_manifest.json'
// @ts-ignore (JSON Modules enabled in tsconfig.test.json)
import versionJson115 from './files/1.15.2.json'
// @ts-ignore (JSON Modules enabled in tsconfig.test.json)
import versionJson1710 from './files/1.7.10.json'
// @ts-ignore (JSON Modules enabled in tsconfig.test.json)
import index115 from './files/index_1.15.json'

const commonDir = join(__dirname, 'files')
const assetDir = join(commonDir, 'assets')
const jsonPath115 = getVersionJsonPath(commonDir, '1.15.2')
const indexPath115 = join(assetDir, 'indexes', '1.15.json')
const jsonPath1710 = getVersionJsonPath(commonDir, '1.7.10')

describe('Mojang Index Processor', () => {

    after(async () => {
        nock.cleanAll()
        await remove(dirname(jsonPath115))
        await remove(indexPath115)
        await remove(dirname(jsonPath1710))
    })

    it('[ MIP ] Validate Full Remote (1.15.2)', async () => {

        const manifestUrl = new URL(MojangIndexProcessor.VERSION_MANIFEST_ENDPOINT)
        const versionJsonUrl = new URL('https://launchermeta.mojang.com/v1/packages/1a36ca2e147f4fdc4a8b9c371450e1581732c354/1.15.2.json')
        const assetIndexUrl = new URL('https://launchermeta.mojang.com/v1/packages/5406d9a75dfb58f549070d8bae279562c38a68f6/1.15.json')

        nock(manifestUrl.origin)
            .get(manifestUrl.pathname)
            .reply(200, versionManifest)

        nock(versionJsonUrl.origin)
            .get(versionJsonUrl.pathname)
            .reply(200, versionJson115)

        nock(assetIndexUrl.origin)
            .get(assetIndexUrl.pathname)
            .reply(200, index115)

        const mojangIndexProcessor = new MojangIndexProcessor(commonDir, '1.15.2')
        await mojangIndexProcessor.init()

        const notValid = await mojangIndexProcessor.validate()

        const savedJson = await pathExists(jsonPath115)
        const savedIndex = await pathExists(indexPath115)

        expect(notValid).to.haveOwnProperty('assets')
        expect(notValid.assets).to.have.lengthOf(2109-2)
        expect(notValid).to.haveOwnProperty('libraries')
        // Natives are different per OS
        expect(notValid.libraries).to.have.length.gte(24)
        expect(notValid).to.haveOwnProperty('client')
        expect(notValid.client).to.have.lengthOf(1)
        expect(notValid).to.haveOwnProperty('misc')
        expect(notValid.misc).to.have.lengthOf(1)

        expect(savedJson).to.equal(true)
        expect(savedIndex).to.equal(true)

    })

    it('[ MIP ] Validate Full Local (1.12.2)', async () => {

        const manifestUrl = new URL(MojangIndexProcessor.VERSION_MANIFEST_ENDPOINT)

        nock(manifestUrl.origin)
            .get(manifestUrl.pathname)
            .reply(200, versionManifest)

        const mojangIndexProcessor = new MojangIndexProcessor(commonDir, '1.12.2')
        await mojangIndexProcessor.init()

        const notValid = await mojangIndexProcessor.validate()
        expect(notValid).to.haveOwnProperty('assets')
        expect(notValid.assets).to.have.lengthOf(1305-2)
        expect(notValid).to.haveOwnProperty('libraries')
        // Natives are different per OS
        expect(notValid.libraries).to.have.length.gte(27)
        expect(notValid).to.haveOwnProperty('client')
        expect(notValid.client).to.have.lengthOf(1)
        expect(notValid).to.haveOwnProperty('misc')
        expect(notValid.misc).to.have.lengthOf(1)

    })

    it('[ MIP ] Validate Half Remote (1.7.10)', async () => {

        const manifestUrl = new URL(MojangIndexProcessor.VERSION_MANIFEST_ENDPOINT)
        const versionJsonUrl = new URL('https://launchermeta.mojang.com/v1/packages/2e818dc89e364c7efcfa54bec7e873c5f00b3840/1.7.10.json')

        nock(manifestUrl.origin)
            .get(manifestUrl.pathname)
            .reply(200, versionManifest)

        nock(versionJsonUrl.origin)
            .get(versionJsonUrl.pathname)
            .reply(200, versionJson1710)

        const mojangIndexProcessor = new MojangIndexProcessor(commonDir, '1.7.10')
        await mojangIndexProcessor.init()

        const notValid = await mojangIndexProcessor.validate()

        const savedJson = await pathExists(jsonPath1710)

        expect(notValid).to.haveOwnProperty('assets')
        expect(notValid.assets).to.have.lengthOf(686-2)
        expect(notValid).to.haveOwnProperty('libraries')
        // Natives are different per OS
        expect(notValid.libraries).to.have.length.gte(27)
        expect(notValid).to.haveOwnProperty('client')
        expect(notValid.client).to.have.lengthOf(1)
        expect(notValid).to.haveOwnProperty('misc')
        expect(notValid.misc).to.have.lengthOf(1)

        expect(savedJson).to.equal(true)

    })

})