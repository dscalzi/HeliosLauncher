/**
 * Utility Class to construct a packet conforming to Minecraft's
 * protocol. All data types are BE except VarInt and VarLong.
 * 
 * @see https://wiki.vg/Protocol
 */
export class ServerBoundPacket {

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
export class ClientBoundPacket {

    private buffer: number[]

    constructor(buffer: Buffer) {
        this.buffer = [...buffer]
    }

    public append(buffer: Buffer): void {
        this.buffer.push(...buffer)
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

export class ProtocolUtils {

    public static getVarIntSize(value: number): number {
        let size = 0
    
        do {
            value >>>= 7
            size++
        } while (value != 0)
    
        return size
    }

}