const fs = require('fs')
const readline = require('readline')
const path = require('path')

// Path to the configuration file
const configPath = path.join(__dirname, 'variables.athshield')

// Load the variables from the file
function loadConfig() {
    const rawData = fs.readFileSync(configPath)
    return JSON.parse(rawData.toString()) // Convert Buffer to string
}

// Save the variables to the file
function saveConfig(config) {
    const data = JSON.stringify(config, null, 2)
    fs.writeFileSync(configPath, data)
}

// Create the readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

// Function to ask questions to the user
function startCLI() {
    const config = loadConfig()

    rl.question('Would you like to activate Athena\'s Shield? (yes/no): ', (answer) => {
        if (answer.trim().startsWith('//')) {
            console.log('This is a comment; the line is ignored.')
            rl.close()
            return
        }

        if (answer.toLowerCase() === 'yes') {
            config.athenaShieldActivated = true

            rl.question('Would you like to hide or block the menu? (hide/block): ', (menuAnswer) => {
                if (menuAnswer.trim().startsWith('//')) {
                    console.log('This is a comment; the line is ignored.')
                    rl.close()
                    return
                }

                if (menuAnswer.toLowerCase() === 'hide') {
                    config.menuVisibility = 'hidden' // Change to 'hidden'
                    console.log('Athena\'s Shield activated. Menu hidden.')
                } else if (menuAnswer.toLowerCase() === 'block') {
                    config.menuVisibility = 'blocked' // Change to 'blocked'
                    console.log('Athena\'s Shield activated. Menu blocked.')
                } else {
                    console.log('Invalid option for the menu.')
                    rl.close()
                    return
                }

                // Save the modified configuration
                saveConfig(config)
                rl.close()
            })
        } else if (answer.toLowerCase() === 'no') {
            console.log('Athena\'s Shield not activated. Closing the CLI.')
            config.athenaShieldActivated = false
            config.menuVisibility = 'visible' // Reset to default value

            // Save the modified configuration
            saveConfig(config)
            rl.close()
        } else {
            console.log('Invalid response.')
            rl.close()
        }
    })
}

// Launch the CLI
startCLI()
