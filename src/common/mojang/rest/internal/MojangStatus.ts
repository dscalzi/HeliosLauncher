export enum MojangStatusColor {
    RED = 'red',
    YELLOW = 'yellow',
    GREEN = 'green',
    GREY = 'grey'
}

export interface MojangStatus {

    service: string
    status: MojangStatusColor
    name: string
    essential: boolean

}
