const {AssetGuard} = require('./assetguard.js')
const ConfigManager = require('./configmanager.js')
const {ipcRenderer} = require('electron')
const os = require('os')
const path = require('path')
const rimraf = require('rimraf')

console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Loading..')

// Load ConfigManager
ConfigManager.load()

// Ensure Distribution is downloaded and cached.
AssetGuard.retrieveDistributionData(ConfigManager.getLauncherDirectory(), false).then((data) => {
    console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Loaded distribution index.')

    // Resolve the selected server if its value has yet to be set.
    if(ConfigManager.getSelectedServer() == null){
        console.log('Determining default selected server..')
        ConfigManager.setSelectedServer(AssetGuard.resolveSelectedServer(ConfigManager.getLauncherDirectory()).id)
        ConfigManager.save()
    }

    ipcRenderer.send('distributionIndexDone', data)

}).catch(err => {
    console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Failed to load distribution index.')
    console.err(err)
})

// Clean up temp dir incase previous launches ended unexpectedly. 
rimraf(path.join(os.tmpdir(), ConfigManager.getTempNativeFolder()), (err) => {
    if(err){
        console.warn('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Error while cleaning natives directory', err)
    } else {
        console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Cleaned natives directory.')
    }
})