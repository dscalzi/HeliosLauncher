const fs = require('fs')
const readline = require('readline')
const path = require('path')

// Chemin vers le fichier de configuration
const configPath = path.join(__dirname, 'variables.athshield')

// Charger les variables depuis le fichier
function loadConfig() {
    const rawData = fs.readFileSync(configPath)
    return JSON.parse(rawData.toString()) // Convertir Buffer en string
}

// Sauvegarder les variables dans le fichier
function saveConfig(config) {
    const data = JSON.stringify(config, null, 2)
    fs.writeFileSync(configPath, data)
}

// Création de l'interface readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

// Fonction pour poser les questions à l'utilisateur
function startCLI() {
    const config = loadConfig()

    rl.question('Voulez-vous activer Athena\'s Shield ? (oui/non) : ', (answer) => {
        if (answer.trim().startsWith('//')) {
            console.log('Ceci est un commentaire, la ligne est ignorée.')
            rl.close()
            return
        }

        if (answer.toLowerCase() === 'oui') {
            config.athenaShieldActivated = true

            rl.question('Voulez-vous cacher ou bloquer le menu ? (cacher/bloquer) : ', (menuAnswer) => {
                if (menuAnswer.trim().startsWith('//')) {
                    console.log('Ceci est un commentaire, la ligne est ignorée.')
                    rl.close()
                    return
                }

                if (menuAnswer.toLowerCase() === 'cacher') {
                    config.menuVisibility = 'hidden' // Change to 'hidden'
                    console.log(`Athena's Shield activé. Menu caché.`)
                } else if (menuAnswer.toLowerCase() === 'bloquer') {
                    config.menuVisibility = 'blocked' // Change to 'blocked'
                    console.log(`Athena's Shield activé. Menu bloqué.`)
                } else {
                    console.log('Option non valide pour le menu.')
                    rl.close()
                    return
                }

                // Sauvegarder la configuration modifiée
                saveConfig(config)
                rl.close()
            })
        } else if (answer.toLowerCase() === 'non') {
            console.log('Athena\'s Shield non activé. Fermeture du CLI.')
            config.athenaShieldActivated = false
            config.menuVisibility = 'visible' // Remettre la valeur par défaut

            // Sauvegarder la configuration modifiée
            saveConfig(config)
            rl.close()
        } else {
            console.log('Réponse non valide.')
            rl.close()
        }
    })
}

// Lancer le CLI
startCLI()
