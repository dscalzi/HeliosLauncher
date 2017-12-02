const {AssetGuard} = require('./assetguard.js')

console.log('Preloading')

// Ensure Distribution is downloaded and cached.
AssetGuard.retrieveDistributionDataSync(false)