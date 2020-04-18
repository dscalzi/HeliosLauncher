import { Mojang } from "../../src/main/mojang/mojang"
import { expect } from 'chai'
import nock from 'nock'
import { Session } from "../../src/main/mojang/model/auth/Session"
import { MojangResponseCode } from "../../src/main/mojang/model/internal/Response"

function expectMojangResponse(res: any, responseCode: MojangResponseCode, negate = false) {
    expect(res).to.not.be.an('error')
    expect(res).to.be.an('object')
    expect(res).to.have.property('responseCode')
    if(!negate) {
        expect(res.responseCode).to.equal(responseCode)
    } else {
        expect(res.responseCode).to.not.equal(responseCode)
    }
}

describe('Mojang Errors', () => {

    after(() => {
        nock.cleanAll()
    })

    it('Status (Offline)', async () => {

        const defStatusHack = Mojang['statuses']

        nock(Mojang.STATUS_ENDPOINT)
            .get('/check')
            .reply(500, 'Service temprarily offline.')

        const res = await Mojang.status();
        expectMojangResponse(res, MojangResponseCode.SUCCESS, true)
        expect(res.data).to.be.an('array')
        expect(res.data).to.deep.equal(defStatusHack)

    }).timeout(2500)

    it('Authenticate (Invalid Credentials)', async () => {

        nock(Mojang.AUTH_ENDPOINT)
            .post('/authenticate')
            .reply(403, (uri, requestBody: any): { error: string, errorMessage: string } => {
                return {
                    error: 'ForbiddenOperationException',
                    errorMessage: 'Invalid credentials. Invalid username or password.'
                }
            })

        const res = await Mojang.authenticate('user', 'pass', 'xxx', true)
        expectMojangResponse(res, MojangResponseCode.ERROR_INVALID_CREDENTIALS)
        expect(res.data).to.be.a('null')
        expect(res.error).to.not.be.a('null')

    })
})

describe('Mojang Status', () => {

    it('Status (Online)', async () => {

        const defStatusHack = Mojang['statuses']

        nock(Mojang.STATUS_ENDPOINT)
            .get('/check')
            .reply(200, defStatusHack)

        const res = await Mojang.status();
        expectMojangResponse(res, MojangResponseCode.SUCCESS)
        expect(res.data).to.be.an('array')
        expect(res.data).to.deep.equal(defStatusHack)

    }).timeout(2500)

})

describe('Mojang Auth', () => {
    
    it('Authenticate', async () => {

        nock(Mojang.AUTH_ENDPOINT)
            .post('/authenticate')
            .reply(200, (uri, requestBody: any): Session => {
                const mockResponse: Session = {
                    accessToken: 'abc',
                    clientToken: requestBody.clientToken,
                    selectedProfile: {
                        id: 'def',
                        name: 'username'
                    }
                }

                if(requestBody.requestUser) {
                    mockResponse.user = {
                        id: 'def',
                        properties: []
                    }
                }

                return mockResponse
            })

        const res = await Mojang.authenticate('user', 'pass', 'xxx', true)
        expectMojangResponse(res, MojangResponseCode.SUCCESS)
        expect(res.data!.clientToken).to.equal('xxx')
        expect(res.data).to.have.property('user')

    })

    it('Validate', async () => {

        nock(Mojang.AUTH_ENDPOINT)
            .post('/validate')
            .times(2)
            .reply((uri, requestBody: any) => {
                return [
                    requestBody.accessToken === 'abc' ? 204 : 403
                ]
            })

        const res = await Mojang.validate('abc', 'def')

        expectMojangResponse(res, MojangResponseCode.SUCCESS)
        expect(res.data).to.be.a('boolean')
        expect(res.data).to.equal(true)

        const res2 = await Mojang.validate('def', 'def')

        expectMojangResponse(res2, MojangResponseCode.SUCCESS)
        expect(res2.data).to.be.a('boolean')
        expect(res2.data).to.equal(false)

    })

    it('Invalidate', async () => {

        nock(Mojang.AUTH_ENDPOINT)
            .post('/invalidate')
            .reply(204)

        const res = await Mojang.invalidate('adc', 'def')

        expectMojangResponse(res, MojangResponseCode.SUCCESS)

    })

    it('Refresh', async () => {

        nock(Mojang.AUTH_ENDPOINT)
            .post('/refresh')
            .reply(200, (uri, requestBody: any): Session => {
                const mockResponse: Session = {
                    accessToken: 'abc',
                    clientToken: requestBody.clientToken,
                    selectedProfile: {
                        id: 'def',
                        name: 'username'
                    }
                }

                if(requestBody.requestUser) {
                    mockResponse.user = {
                        id: 'def',
                        properties: []
                    }
                }

                return mockResponse
            })

        const res = await Mojang.refresh('gfd', 'xxx', true)
        expectMojangResponse(res, MojangResponseCode.SUCCESS)
        expect(res.data!.clientToken).to.equal('xxx')
        expect(res.data).to.have.property('user')

    })

})