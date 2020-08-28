import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getServerStatus, ServerStatus } from 'common/mojang/net/ServerStatusAPI'

chai.use(chaiAsPromised)

describe('[Server Status API] Errors', () => {

    it('Server Status (Not Found)', async () => {

        await expect(getServerStatus(47, 'a', 25565)).to.eventually.be.null

    }).timeout(5000)

    it('Server Status (Wrong Port)', async () => {

        await expect(getServerStatus(47, 'play.hypixel.net', 34454)).to.eventually.be.null

    }).timeout(5000)

})

function verifyResult(res: ServerStatus): void {
    expect(res).to.not.be.null
    expect(res).to.be.an('object')
    expect(res).to.have.property('version')
    expect(res).to.have.property('players')
    expect(res).to.have.property('description')
    expect(res.players).to.be.an('object')
    expect(res.players).to.have.property('max')
    expect(res.players).to.have.property('online')
    expect(res.description).to.be.an('object')
    expect(res.description).to.have.property('text')
}

const serversToCheck = [
    'play.hypixel.net',
    'play.hivemc.com',
    'us.mineplex.com'
]

describe('[Server Status API] Server Status', () => {

    for(const server of serversToCheck) {
        it(`Server Status (${server})`, async () => {

            verifyResult((await getServerStatus(47, server, 25565))!)
    
        })
    }

})