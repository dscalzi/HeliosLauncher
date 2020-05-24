export enum StatusColor {
    RED = 'red',
    YELLOW = 'yellow',
    GREEN = 'green',
    GREY = 'grey'
}

export interface Status {

    service: string
    status: StatusColor
    name: string
    essential: boolean

}
