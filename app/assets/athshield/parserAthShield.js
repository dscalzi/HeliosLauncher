const fs = require('fs')
const path = require('path')

// Chemin vers le fichier de configuration
const configPath = path.join(__dirname, 'variables.athshield')

// Classe pour gérer Athena's Shield
class AthenaShield {
    constructor() {
        this.config = this.loadConfig()
    }

    // Charger les variables depuis le fichier
    loadConfig() {
        const rawData = fs.readFileSync(configPath)
        return JSON.parse(rawData.toString())
    }

    // Récupérer le statut d'Athena's Shield
    get status() {
        return this.config.athenaShieldActivated
    }

    // Récupérer la visibilité du menu
    get type() {
        return this.config.menuVisibility
    }
}

// Exporter une instance de la classe
const athenaShieldInstance = new AthenaShield()
module.exports = athenaShieldInstance
