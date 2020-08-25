/* eslint-disable @typescript-eslint/no-explicit-any */
import { Mojang } from 'common/mojang/mojang'
import { expect } from 'chai'
import nock from 'nock'
import { Session } from 'common/mojang/model/auth/Session'
import { MojangErrorCode, MojangResponse } from 'common/mojang/model/internal/MojangResponse'
import { RestResponseStatus, RestResponse } from 'common/got/RestResponse'

function assertResponse(res: RestResponse<unknown>) {
    expect(res).to.not.be.an('error')
    expect(res).to.be.an('object')
}

function expectSuccess(res: RestResponse<unknown>) {
    assertResponse(res)
    expect(res).to.have.property('responseStatus')
    expect(res.responseStatus).to.equal(RestResponseStatus.SUCCESS)
}

function expectFailure(res: RestResponse<unknown>) {
    expect(res.responseStatus).to.not.equal(RestResponseStatus.SUCCESS)
}

function expectMojangResponse(res: MojangResponse<unknown>, responseCode: MojangErrorCode, negate = false) {
    assertResponse(res)
    expect(res).to.have.property('mojangErrorCode')
    if(!negate) {
        expect(res.mojangErrorCode).to.equal(responseCode)
    } else {
        expect(res.mojangErrorCode).to.not.equal(responseCode)
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

        const res = await Mojang.status()
        expectFailure(res)
        expect(res.data).to.be.an('array')
        expect(res.data).to.deep.equal(defStatusHack)

    }).timeout(2500)

    it('Authenticate (Invalid Credentials)', async () => {

        nock(Mojang.AUTH_ENDPOINT)
            .post('/authenticate')
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .reply(403, (uri, requestBody: unknown): { error: string, errorMessage: string } => {
                return {
                    error: 'ForbiddenOperationException',
                    errorMessage: 'Invalid credentials. Invalid username or password.'
                }
            })

        const res = await Mojang.authenticate('user', 'pass', 'xxx', true)
        expectMojangResponse(res, MojangErrorCode.ERROR_INVALID_CREDENTIALS)
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

        const res = await Mojang.status()
        expectSuccess(res)
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
        expectSuccess(res)
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

        expectSuccess(res)
        expect(res.data).to.be.a('boolean')
        expect(res.data).to.equal(true)

        const res2 = await Mojang.validate('def', 'def')

        expectSuccess(res2)
        expect(res2.data).to.be.a('boolean')
        expect(res2.data).to.equal(false)

    })

    it('Invalidate', async () => {

        nock(Mojang.AUTH_ENDPOINT)
            .post('/invalidate')
            .reply(204)

        const res = await Mojang.invalidate('adc', 'def')

        expectSuccess(res)

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
        expectSuccess(res)
        expect(res.data!.clientToken).to.equal('xxx')
        expect(res.data).to.have.property('user')

    })

})