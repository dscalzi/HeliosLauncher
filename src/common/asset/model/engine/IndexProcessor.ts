import { Asset } from './Asset'

export abstract class IndexProcessor {

    constructor(
        protected commonDir: string
    ) {}

    abstract async init(): Promise<void>
    abstract async validate(): Promise<{[category: string]: Asset[]}>

}