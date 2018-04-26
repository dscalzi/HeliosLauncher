/**
 * Initialize UI functions which depend on internal modules.
 * Loaded after core UI functions are initialized in uicore.js.
 */
// Requirements
const path          = require('path')
const ConfigManager = require(path.join(__dirname, 'assets', 'js', 'configmanager.js'))

// Synchronous Listener
document.addEventListener('readystatechange', function(){

    if (document.readyState === 'complete'){
        if(ConfigManager.isFirstLaunch()){
            $('#welcomeContainer').fadeIn(500)
        } else {
            $('#landingContainer').fadeIn(500)
        }
    }

    /*if (document.readyState === 'interactive'){
        
    }*/
}, false)
