const path = require('path')
const ConfigManager = require('./configmanager')

//TODO: Resolve game directory based on windows, linux, or mac..
exports.GAME_DIRECTORY = path.join(__dirname, '..', '..', '..', 'target', 'test', 'mcfiles')
exports.DEFAULT_CONFIG = new ConfigManager(path.join(exports.GAME_DIRECTORY, 'config.yml'))