export class LoggerUtil {

    constructor(
        protected prefix: string,
        protected style: string
    ){}

    public log(...args: any[]){
        console.log(this.prefix, this.style, ...args)
    }

    public info(...args: any[]){
        console.info(this.prefix, this.style, ...args)
    }

    public warn(...args: any[]){
        console.warn(this.prefix, this.style, ...args)
    }

    public debug(...args: any[]){
        console.debug(this.prefix, this.style, ...args)
    }

    public error(...args: any[]){
        console.error(this.prefix, this.style, ...args)
    }

}
