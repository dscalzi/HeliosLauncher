/* eslint-disable no-control-regex */
import { connect } from 'net'
import { LoggerUtil } from 'common/logging/loggerutil'

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
 * Utility Class to construct a packet conforming to Minecraft's
 * protocol. All data types are BE except VarInt and VarLong.
 * 
 * @see https://wiki.vg/Protocol
 */
class ServerBoundPacket {

    private buffer: number[]

    protected constructor() {
        this.buffer = []
    }

    public static build(): ServerBoundPacket {
        return new ServerBoundPacket()
    }

    /**
     * Packet is prefixed with its data length as a VarInt.
     * 
     * @see https://wiki.vg/Protocol#Packet_format
     */
    public toBuffer(): Buffer {
        const finalizedPacket = new ServerBoundPacket()
        finalizedPacket.writeVarInt(this.buffer.length)
        finalizedPacket.writeBytes(...this.buffer)

        return Buffer.from(finalizedPacket.buffer)
    }

    public writeBytes(...bytes: number[]): ServerBoundPacket {
        this.buffer.push(...bytes)
        return this
    }

    /**
     * @see https://wiki.vg/Protocol#VarInt_and_VarLong
     */
    public writeVarInt(value: number): ServerBoundPacket {
        do {
            let temp = value & 0b01111111

            value >>>= 7

            if (value != 0) {
                temp |= 0b10000000
            }

            this.writeBytes(temp)
        } while (value != 0)

        return this
    }

    /**
     * Strings are prefixed with their length as a VarInt.
     * 
     * @see https://wiki.vg/Protocol#Data_types
     */
    public writeString(string: string): ServerBoundPacket {
        this.writeVarInt(string.length)
        for (let i=0; i<string.length; i++) {
            this.writeBytes(string.codePointAt(i)!)
        }

        return this
    }

    public writeUnsignedShort(short: number): ServerBoundPacket {
        const buf = Buffer.alloc(2)
        buf.writeUInt16BE(short, 0)
        this.writeBytes(...buf)

        return this
    }
 
}

/**
 * Utility Class to read a client-bound packet conforming to
 * Minecraft's protocol. All data types are BE except VarInt
 * and VarLong.
 * 
 * @see https://wiki.vg/Protocol
 */
class ClientBoundPacket {

    private buffer: number[]

    constructor(buffer: Buffer) {
        this.buffer = [...buffer]
    }

    public readByte(): number {
        return this.buffer.shift()!
    }

    public readBytes(length: number): number[] {
        const value = this.buffer.slice(0, length)
        this.buffer.splice(0, length)
        return value
    }

    public readVarInt(): number {

        let numRead = 0
        let result = 0
        let read

        do {
            read = this.readByte()
            const value = (read & 0b01111111)
            result |= (value << (7 * numRead))

            numRead++
            if (numRead > 5) {
                throw new Error('VarInt is too big')
            }
        } while ((read & 0b10000000) != 0)

        return result
    }

    public readString(): string {
        const length = this.readVarInt()
        const data = this.readBytes(length)

        let value = ''

        for (let i=0; i<data.length; i++) {
            value += String.fromCharCode(data[i])
        }

        return value
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

export function getServerStatus(protocol: number, address: string, port = 25565): Promise<ServerStatus | null> {

    return new Promise((resolve, reject) => {

        const socket = connect(port, address, () => {
            socket.write(getHandshakePacket(protocol, address, port))
            socket.write(getRequestPacket())
        })

        socket.setTimeout(2500, () => {
            socket.destroy()
            logger.error(`Server Status Socket timed out (${address}:${port})`)
            reject(new Error(`Server Status Socket timed out (${address}:${port})`))
        })

        socket.on('data', (data) => {

            const inboundPacket = new ClientBoundPacket(data)

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const packetLength = inboundPacket.readVarInt() // First VarInt is packet length.
            const packetType = inboundPacket.readVarInt()   // Second VarInt is packet type.

            if(packetType !== 0x00) {
                // TODO
                socket.destroy()
                reject(new Error(`Invalid response. Expected packet type ${0x00}, received ${packetType}!`))
                return
            }

            const res = inboundPacket.readString() // Remainder of Buffer is the server status json.

            socket.end()
            resolve(JSON.parse(res))
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
                logger.error(`Error trying to pull server status (${address}:${port}})`, err)
                resolve(null)
                return
            }
        })

    })

}
