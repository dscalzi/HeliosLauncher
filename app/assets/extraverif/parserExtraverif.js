const fs = require('fs')
const path = require('path')

const configPath = path.join(__dirname, 'variables.json')

class ExtraFileVerification {
    constructor() {
        this.config = this.loadConfig()
    }

    loadConfig() {
        const rawData = fs.readFileSync(configPath)
        return JSON.parse(rawData.toString())
    }

    get status() {
        return this.config.extraFileVerifActivated
    }

    get type() {
        return this.config.menuVisibility
    }

    get debug() {
        return this.config.debug
    }
}

const ExtraFileVerificationInstance = new ExtraFileVerification()
module.exports = ExtraFileVerificationInstance
