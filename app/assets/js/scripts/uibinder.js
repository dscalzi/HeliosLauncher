/**
 * Initialize UI functions which depend on internal modules.
 * Loaded after core UI functions are initialized in uicore.js.
 */
// Requirements
const path          = require('path')
const AuthManager   = require('./assets/js/authmanager.js')
const {AssetGuard}  = require('./assets/js/assetguard.js')
const ConfigManager = require('./assets/js/configmanager.js')

let rscShouldLoad = false
let fatalStartupError = false

// Mapping of each view to their container IDs.
const VIEWS = {
    landing: '#landingContainer',
    login: '#loginContainer',
    settings: '#settingsContainer',
    welcome: '#welcomeContainer'
}

// The currently shown view container.
let currentView = VIEWS.landing

/**
 * Switch launcher views.
 * 
 * @param {string} current The ID of the current view container. 
 * @param {*} next The ID of the next view container.
 * @param {*} currentFadeTime Optional. The fade out time for the current view.
 * @param {*} nextFadeTime Optional. The fade in time for the next view.
 * @param {*} onCurrentFade Optional. Callback function to execute when the current
 * view fades out.
 * @param {*} onNextFade Optional. Callback function to execute when the next view
 * fades in.
 */
function switchView(current, next, currentFadeTime = 500, nextFadeTime = 500, onCurrentFade = () => {}, onNextFade = () => {}){
    currentView = next
    $(`${current}`).fadeOut(currentFadeTime, () => {
        onCurrentFade()
        $(`${next}`).fadeIn(nextFadeTime, () => {
            onNextFade()
        })
    })
}

/**
 * Get the currently shown view container.
 * 
 * @returns {string} The currently shown view container.
 */
function getCurrentView(){
    return currentView
}

function showMainUI(){
    updateSelectedServer(AssetGuard.getServerById(ConfigManager.getSelectedServer()).name)
    refreshServerStatus()
    setTimeout(() => {
        document.getElementById('frameBar').style.backgroundColor = 'rgba(1, 2, 1, 0.5)'
        document.body.style.backgroundImage = `url('assets/images/backgrounds/${document.body.getAttribute('bkid')}.jpg')`
        $('#main').show()

        // If this is enabled in a development environment we'll get ratelimited.
        // The relaunch frequency is usually far too high.
        if(!isDev){
            validateSelectedAccount().then((v) => {
                if(v){
                    console.log('%c[AuthManager]', 'color: #209b07; font-weight: bold', 'Account access token validated.')
                } else {
                    console.log('%c[AuthManager]', 'color: #a02d2a; font-weight: bold', 'Account access token  is invalid.')
                }
            })
        }

        if(ConfigManager.isFirstLaunch()){
            $(VIEWS.welcome).fadeIn(1000)
        } else {
            $(VIEWS.landing).fadeIn(1000)
        }

        setTimeout(() => {
            $('#loadingContainer').fadeOut(500, () => {
                $('#loadSpinnerImage').removeClass('rotating')
            })
        }, 250)
        
    }, 750)
    // Disable tabbing to the news container.
    initNews().then(() => {
        $("#newsContainer *").attr('tabindex', '-1')
    })
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

function onDistroRefresh(data){
    updateSelectedServer(AssetGuard.getServerById(ConfigManager.getSelectedServer()).name)
    refreshServerStatus()
    initNews()
}

function refreshDistributionIndex(remote, onSuccess, onError){
    if(remote){
        AssetGuard.refreshDistributionDataRemote(ConfigManager.getLauncherDirectory())
        .then(onSuccess)
        .catch(onError)
    } else {
        AssetGuard.refreshDistributionDataLocal(ConfigManager.getLauncherDirectory())
        .then(onSuccess)
        .catch(onError)
    }
}

async function validateSelectedAccount(){
    const selectedAcc = ConfigManager.getSelectedAccount()
    if(selectedAcc != null){
        const val = await AuthManager.validateSelected()
        if(!val){
            ConfigManager.removeAuthAccount(selectedAcc.uuid)
            ConfigManager.save()
            const accLen = Object.keys(ConfigManager.getAuthAccounts()).length
            setOverlayContent(
                'Failed to Refresh Login',
                `We were unable to refresh the login for <strong>${selectedAcc.displayName}</strong>. Please ${accLen > 0 ? 'select another account or ' : ''} login again.`,
                'Login',
                'Select Another Account'
            )
            setOverlayHandler(() => {
                document.getElementById('loginUsername').value = selectedAcc.username
                validateEmail(selectedAcc.username)
                switchView(getCurrentView(), VIEWS.login)
                toggleOverlay(false)
            })
            setDismissHandler(() => {
                if(accLen > 1){
                    prepareAccountSelectionList()
                    $('#overlayContent').fadeOut(250, () => {
                        $('#accountSelectContent').fadeIn(250)
                    })
                } else {
                    const accountsObj = ConfigManager.getAuthAccounts()
                    const accounts = Array.from(Object.keys(accountsObj), v => accountsObj[v]);
                    // This function validates the account switch.
                    setSelectedAccount(accounts[0].uuid)
                    toggleOverlay(false)
                }
            })
            toggleOverlay(true, accLen > 0)
        } else {
            return true
        }
    } else {
        return true
    }
}

/**
 * Temporary function to update the selected account along
 * with the relevent UI elements.
 * 
 * @param {string} uuid The UUID of the account.
 */
function setSelectedAccount(uuid){
    const authAcc = ConfigManager.setSelectedAccount(uuid)
    ConfigManager.save()
    updateSelectedAccount(authAcc)
    validateSelectedAccount()
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
