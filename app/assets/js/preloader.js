// Note: The following modules CANNOT require enumerator.js
const {AssetGuard} = require('./assetguard.js')
const ConfigManager = require('./configmanager.js')
const constants = require('./enumerator.js').enum
const path = require('path')

console.log('Preloading')

// Ensure Distribution is downloaded and cached.
AssetGuard.retrieveDistributionDataSync(false)

// TODO: Resolve game directory based on windows, linux, or mac..
constants.GAME_DIRECTORY = path.join(__dirname, '..', '..', '..', 'target', 'test', 'mcfiles')
constants.DISTRO_DIRECTORY = path.join(constants.GAME_DIRECTORY, 'westeroscraft.json')

// Complete config setup
const conf = new ConfigManager(path.join(constants.GAME_DIRECTORY, 'config.json'))
if(conf.getSelectedServer() == null){
    console.log('Determining default selected server..')
    conf.setSelectedServer(AssetGuard.resolveSelectedServer(constants.GAME_DIRECTORY))
}
constants.DEFAULT_CONFIG = conf