const { DistributionAPI } = require('helios-core/common')

const ConfigManager = require('./configmanager')

exports.REMOTE_DISTRO_URL = 'http://mc.westeroscraft.com/WesterosCraftLauncher/distribution.json'

const api = new DistributionAPI(
    ConfigManager.getLauncherDirectory(),
    exports.REMOTE_DISTRO_URL,
    false
)

exports.DistroAPI = api