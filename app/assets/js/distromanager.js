const { DistributionAPI } = require('helios-core/common')

const ConfigManager = require('./configmanager')

// Old Graschatium url.
// exports.REMOTE_DISTRO_URL = 'https://graschatiumdistro.000webhostapp.com/distribution.json'
exports.REMOTE_DISTRO_URL = 'https://graschatiumdistro.000webhostapp.com/distribution.json'

const api = new DistributionAPI(
    ConfigManager.getLauncherDirectory(),
    null, // Injected forcefully by the preloader.
    null, // Injected forcefully by the preloader.
    exports.REMOTE_DISTRO_URL,
    false
)

exports.DistroAPI = api