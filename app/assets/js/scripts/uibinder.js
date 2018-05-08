/**
 * Initialize UI functions which depend on internal modules.
 * Loaded after core UI functions are initialized in uicore.js.
 */
// Requirements
const path          = require('path')
const ConfigManager = require('./assets/js/configmanager.js')

let rscShouldLoad = false
let fatalStartupError = false

function showMainUI(){
    updateSelectedServer(AssetGuard.getServerById(ConfigManager.getLauncherDirectory(), ConfigManager.getSelectedServer()).name)
    refreshServerStatus()
    setTimeout(() => {
        document.getElementById('frameBar').style.backgroundColor = 'rgba(1, 2, 1, 0.5)'
        document.body.style.backgroundImage = `url('assets/images/backgrounds/${document.body.getAttribute('bkid')}.jpg')`
        $('#main').show()

        if(ConfigManager.isFirstLaunch()){
            $('#welcomeContainer').fadeIn(1000)
        } else {
            $('#landingContainer').fadeIn(1000)
        }

        setTimeout(() => {
            $('#loadingContainer').fadeOut(750, () => {
                $('#loadSpinnerImage').removeClass('rotating')
            })
        }, 500)
        
    }, 750)
    initNews()
}

function showFatalStartupError(){
    setTimeout(() => {
        $('#loadingContainer').fadeOut(250, () => {
            document.getElementById('overlayContainer').style.background = 'none'
            setOverlayContent(
                'Fatal Error: Unable to Load Distribution Index',
                'A connection could not be established to our servers to download the distribution index. No local copies were available to load. <br><br>The distribution index is an essential file which provides the latest server information. The launcher is unable to start without it. Ensure you are connected to the internet and relaunch the application.',
                'Close'
            )
            setOverlayHandler(() => {
                const window = remote.getCurrentWindow()
                window.close()
            })
            toggleOverlay(true)
        })
    }, 750)
}

// Synchronous Listener
document.addEventListener('readystatechange', function(){

    if (document.readyState === 'complete'){
        if(rscShouldLoad){
            if(!fatalStartupError){
                showMainUI()
            } else {
                showFatalStartupError()
            }
        } 
    } else if(document.readyState === 'interactive'){
        //toggleOverlay(true, 'loadingContent')
    }

    /*if (document.readyState === 'interactive'){
        
    }*/
}, false)

// Actions that must be performed after the distribution index is downloaded.
ipcRenderer.on('distributionIndexDone', (event, data) => {
    if(data != null) {
        if(document.readyState === 'complete'){
            showMainUI()
        } else {
            rscShouldLoad = true
        }
    } else {
        fatalStartupError = true
        if(document.readyState === 'complete'){
           showFatalStartupError()
        } else {
            rscShouldLoad = true
        }
    }
})
