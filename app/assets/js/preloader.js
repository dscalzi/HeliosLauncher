const {AssetGuard} = require('./assetguard.js')
const ConfigManager = require('./configmanager.js')
const {ipcRenderer} = require('electron')
const os = require('os')
const path = require('path')
const rimraf = require('rimraf')

console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Loading..')

// Load ConfigManager
ConfigManager.load()

function onDistroLoad(data){
    if(data != null){
        
         // Resolve the selected server if its value has yet to be set.
        if(ConfigManager.getSelectedServer() == null || AssetGuard.getServerById(ConfigManager.getSelectedServer()) == null){
            console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Determining default selected server..')
            ConfigManager.setSelectedServer(AssetGuard.resolveSelectedServer().id)
            ConfigManager.save()
        }
    }
    ipcRenderer.send('distributionIndexDone', data)
}

// Ensure Distribution is downloaded and cached.
AssetGuard.refreshDistributionDataRemote(ConfigManager.getLauncherDirectory()).then((data) => {
    console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Loaded distribution index.')

   onDistroLoad(data)

}).catch((err) => {
    console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Failed to load distribution index.')
    console.error(err)

    console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Attempting to load an older version of the distribution index.')
    // Try getting a local copy, better than nothing.
    AssetGuard.refreshDistributionDateLocal(ConfigManager.getLauncherDirectory()).then((data) => {
        console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Successfully loaded an older version of the distribution index.')

        onDistroLoad(data)


    }).catch((err) => {

        console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Failed to load an older version of the distribution index.')
        console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Application cannot run.')
        console.error(err)

        onDistroLoad(null)

    })

})

// Clean up temp dir incase previous launches ended unexpectedly. 
rimraf(path.join(os.tmpdir(), ConfigManager.getTempNativeFolder()), (err) => {
    if(err){
        console.warn('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Error while cleaning natives directory', err)
    } else {
        console.log('%c[Preloader]', 'color: #a02d2a; font-weight: bold', 'Cleaned natives directory.')
    }
})