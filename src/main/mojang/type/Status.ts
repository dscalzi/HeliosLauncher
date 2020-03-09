export interface Status {

    service: string
    status: 'red' | 'yellow' | 'green' | 'grey'
    name: string
    essential: boolean

}
