const fs = require('fs')
const readline = require('readline')
const path = require('path')

const configPath = path.join(__dirname, 'variables.json')

function loadConfig() {
    const rawData = fs.readFileSync(configPath)
    return JSON.parse(rawData.toString())
}

function saveConfig(config) {
    const data = JSON.stringify(config, null, 2)
    fs.writeFileSync(configPath, data)
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function startCLI() {
    const config = loadConfig()

    rl.question('Would you like to activate extra file verification? (yes/no): ', (answer) => {
        if (answer.trim().startsWith('//')) {
            console.log('This is a comment; the line is ignored.')
            rl.close()
            return
        }

        if (answer.toLowerCase() === 'yes') {
            config.extraFileVerifActivated = true

            rl.question('Would you like to activate debug mode? (yes/no): ', (debugAnswer) => {
                config.debug = debugAnswer.toLowerCase() === 'yes'

                rl.question('Would you like to hide or block the menu? (hide/block): ', (menuAnswer) => {
                    if (menuAnswer.trim().startsWith('//')) {
                        console.log('This is a comment; the line is ignored.')
                        rl.close()
                        return
                    }

                    if (menuAnswer.toLowerCase() === 'hide') {
                        config.menuVisibility = 'hidden'
                        console.log('Extra file verification activated. Menu hidden.')
                    } else if (menuAnswer.toLowerCase() === 'block') {
                        config.menuVisibility = 'blocked'
                        console.log('Extra file verification activated. Menu blocked.')
                    } else {
                        console.log('Invalid option for the menu.')
                        rl.close()
                        return
                    }

                    saveConfig(config)
                    rl.close()
                })
            })
        } else if (answer.toLowerCase() === 'no') {
            console.log('Extra file verification not activated. Closing the CLI.')
            config.extraFileVerifActivated = false
            config.menuVisibility = 'visible'
            config.debug = false

            saveConfig(config)
            rl.close()
        } else {
            console.log('Invalid response.')
            rl.close()
        }
    })
}

startCLI()
