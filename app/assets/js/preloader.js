const {AssetGuard} = require('./assetguard.js')
const ConfigManager = require('./configmanager.js')
const path = require('path')

console.log('Preloading')

// Load ConfigManager
ConfigManager.load()

// Ensure Distribution is downloaded and cached.
AssetGuard.retrieveDistributionDataSync(ConfigManager.getGameDirectory(), false)

// Resolve the selected server if its value has yet to be set.
if(ConfigManager.getSelectedServer() == null){
    console.log('Determining default selected server..')
    ConfigManager.setSelectedServer(AssetGuard.resolveSelectedServer(ConfigManager.getGameDirectory()))
    ConfigManager.save()
}