/* eslint-disable no-control-regex */
import { connect } from 'net'
import { LoggerUtil } from 'common/logging/loggerutil'
import { ServerBoundPacket, ClientBoundPacket, ProtocolUtils } from './Protocol'

const logger = LoggerUtil.getLogger('ServerStatusUtil')

export interface ServerStatus {
    version: {
        name: string
        protocol: number
    }
    players: {
        max: number
        online: number
        sample: {
            name: string
            id: string
        }[]
    }
    description: {
        text: string
    }
    favicon: string
    modinfo?: {             // Only for modded servers
        type: string        // Ex. FML
        modList: {
            modid: string
            version: string
        }[]
    }
}

/**
 * Get the handshake packet.
 * 
 * @param protocol The client's protocol version.
 * @param address The server address.
 * @param port The server port.
 * 
 * @see https://wiki.vg/Server_List_Ping#Handshake
 */
function getHandshakePacket(protocol: number, address: string, port: number): Buffer {

    return ServerBoundPacket.build()
        .writeVarInt(0x00)         // Packet Id 
        .writeVarInt(protocol)
        .writeString(address)
        .writeUnsignedShort(port)
        .writeVarInt(1)            // State, 1 = status
        .toBuffer()
}

/**
 * Get the request packet.
 * 
 * @see https://wiki.vg/Server_List_Ping#Request
 */
function getRequestPacket(): Buffer {

    return ServerBoundPacket.build()
        .writeVarInt(0x00)
        .toBuffer()
}

/**
 * Some servers do not return the same status object. Unify
 * the response so that the caller need only worry about
 * handling a single format.
 * 
 * @param resp The servevr status response.
 */
function unifyStatusResponse(resp: ServerStatus): ServerStatus {
    // Some servers don't wrap their description in a text object.
    if(typeof resp.description === 'string') {
        resp.description = {
            text: resp.description
        }
    }
    return resp
}

export function getServerStatus(protocol: number, address: string, port = 25565): Promise<ServerStatus | null> {

    return new Promise((resolve, reject) => {

        const socket = connect(port, address, () => {
            socket.write(getHandshakePacket(protocol, address, port))
            socket.write(getRequestPacket())
        })

        socket.setTimeout(5000, () => {
            socket.destroy()
            logger.error(`Server Status Socket timed out (${address}:${port})`)
            reject(new Error(`Server Status Socket timed out (${address}:${port})`))
        })

        const maxTries = 2
        let iterations = 0
        let bytesLeft = -1

        socket.once('data', (data) => {

            const inboundPacket = new ClientBoundPacket(data)
            
            // Length of Packet ID + Data
            const packetLength = inboundPacket.readVarInt() // First VarInt is packet length.
            const packetType = inboundPacket.readVarInt()   // Second VarInt is packet type.

            if(packetType !== 0x00) {
                // TODO
                socket.destroy()
                reject(new Error(`Invalid response. Expected packet type ${0x00}, received ${packetType}!`))
                return
            }

            // Size of packetLength VarInt is not included in the packetLength.
            bytesLeft = packetLength + ProtocolUtils.getVarIntSize(packetLength)

            // Listener to keep reading until we have read all the bytes into the buffer.
            const packetReadListener = (nextData: Buffer, doAppend: boolean) => {

                if(iterations > maxTries) {
                    socket.destroy()
                    reject(new Error(`Data read from ${address}:${port} exceeded ${maxTries} iterations, closing connection.`))
                    return
                }
                ++iterations

                if(bytesLeft > 0) {
                    bytesLeft -= nextData.length
                    if(doAppend) {
                        inboundPacket.append(nextData)
                    }
                }

                // All bytes read, attempt conversion.
                if(bytesLeft === 0) {
            
                    // Remainder of Buffer is the server status json.
                    const result = inboundPacket.readString()

                    try {
                        const parsed = JSON.parse(result)
                        socket.end()
                        resolve(unifyStatusResponse(parsed))
                    } catch(err) {
                        socket.destroy()
                        logger.error('Failed to parse server status JSON', err)
                        reject(new Error('Failed to parse server status JSON'))
                    }
                }
            }

            // Read the data we just received.
            packetReadListener(data, false)
            // Add a listener to keep reading if the data is too long.
            socket.on('data', (data) => packetReadListener(data, true))

        })

        socket.on('error', (err: NodeJS.ErrnoException) => {
            socket.destroy()

            if(err.code === 'ENOTFOUND') {
                // ENOTFOUND = Unable to resolve.
                logger.error(`Server ${address}:${port} not found!`)
                resolve(null)
                return
            } else if(err.code === 'ECONNREFUSED') {
                // ECONNREFUSED = Unable to connect to port.
                logger.error(`Server ${address}:${port} refused to connect, is the port correct?`)
                resolve(null)
                return
            } else {
                logger.error(`Error trying to pull server status (${address}:${port})`, err)
                resolve(null)
                return
            }
        })

    })

}
