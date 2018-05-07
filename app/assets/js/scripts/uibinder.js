/**
 * Initialize UI functions which depend on internal modules.
 * Loaded after core UI functions are initialized in uicore.js.
 */
// Requirements
const path          = require('path')
const ConfigManager = require(path.join(__dirname, 'assets', 'js', 'configmanager.js'))

let rscShouldLoad = false

// Synchronous Listener
document.addEventListener('readystatechange', function(){

    if (document.readyState === 'complete'){
        if(rscShouldLoad){
            if(ConfigManager.isFirstLaunch()){
                $('#welcomeContainer').fadeIn(500)
            } else {
                $('#landingContainer').fadeIn(500)
            }
        }
    }

    /*if (document.readyState === 'interactive'){
        
    }*/
}, false)

// Actions that must be performed after the distribution index is downloaded.
ipcRenderer.on('distributionIndexDone', (data) => {
    updateSelectedServer(AssetGuard.getServerById(ConfigManager.getLauncherDirectory(), ConfigManager.getSelectedServer()).name)
    refreshServerStatus()
    if(document.readyState === 'complete'){
        if(ConfigManager.isFirstLaunch()){
            $('#welcomeContainer').fadeIn(500)
        } else {
            $('#landingContainer').fadeIn(500)
        }
    } else {
        rscShouldLoad = true
    }
})
