const path = require('path')
const ConfigManager = require('./configmanager')

//TODO: Resolve game directory based on windows, linux, or mac..
const GAME_DIRECTORY = path.join(__dirname, '..', '..', '..', 'target', 'test', 'mcfiles')
const DISTRO_DIRECTORY = path.join(GAME_DIRECTORY, 'westeroscraft.json')
const DEFAULT_CONFIG = new ConfigManager(path.join(GAME_DIRECTORY, 'config.json'))

module.exports = {
    GAME_DIRECTORY,
    DISTRO_DIRECTORY,
    DEFAULT_CONFIG
}