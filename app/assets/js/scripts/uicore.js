/**
 * Core UI functions are initialized in this file. This prevents
 * unexpected errors from breaking the core features. Specifically,
 * actions in this file should not require the usage of any internal
 * modules, excluding dependencies.
 */
// Requirements
const $                                      = require('jquery');
const {ipcRenderer, remote, shell, webFrame} = require('electron')
const isDev                                  = require('electron-is-dev')

// Disable eval function.
// eslint-disable-next-line
window.eval = global.eval = function () {
    throw new Error('Sorry, this app does not support window.eval().')
}

// Display warning when devtools window is opened.
remote.getCurrentWebContents().on('devtools-opened', () => {
    console.log('%cThe console is dark and full of terrors.', 'color: white; -webkit-text-stroke: 4px #a02d2a; font-size: 60px; font-weight: bold')
    console.log('%cIf you\'ve been told to paste something here, you\'re being scammed.', 'font-size: 16px')
    console.log('%cUnless you know exactly what you\'re doing, close this window.', 'font-size: 16px')
})

// Disable zoom, needed for darwin.
webFrame.setZoomLevel(0)
webFrame.setVisualZoomLevelLimits(1, 1)
webFrame.setLayoutZoomLevelLimits(0, 0)

// Initialize auto updates in production environments.
// TODO Make this the case after implementation is done.
let updateCheckListener
if(!isDev){
    ipcRenderer.on('autoUpdateNotification', (event, arg, info) => {
        switch(arg){
            case 'checking-for-update':
                console.log('%c[AutoUpdater]', 'color: #a02d2a; font-weight: bold', 'Checking for update..')
                break
            case 'update-available':
                console.log('%c[AutoUpdater]', 'color: #a02d2a; font-weight: bold', 'New update available', info.version)
                break
            case 'update-downloaded':
                console.log('%c[AutoUpdater]', 'color: #a02d2a; font-weight: bold', 'Update ' + info.version + ' ready to be installed.')
                showUpdateUI(info)
                break
            case 'update-not-available':
                console.log('%c[AutoUpdater]', 'color: #a02d2a; font-weight: bold', 'No new update found.')
                break
            case 'ready':
                updateCheckListener = setInterval(() => {
                    ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
                }, 1800000)
                ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
            case 'realerror':
                if(info != null && info.code != null){
                    if(info.code === 'ERR_UPDATER_INVALID_RELEASE_FEED'){
                        console.log('%c[AutoUpdater]', 'color: #a02d2a; font-weight: bold', 'No suitable releases found.')
                    } else if(info.code === 'ERR_XML_MISSED_ELEMENT'){
                        console.log('%c[AutoUpdater]', 'color: #a02d2a; font-weight: bold', 'No releases found.')
                    } else {
                        console.error('%c[AutoUpdater]', 'color: #a02d2a; font-weight: bold', 'Error during update check..', info)
                        console.debug('%c[AutoUpdater]', 'color: #a02d2a; font-weight: bold', 'Error Code:', info.code)
                    }
                }
                break
            default:
                console.log('%c[AutoUpdater]', 'color: #a02d2a; font-weight: bold', 'Unknown argument', arg)
                break
        }
    })
    ipcRenderer.send('autoUpdateAction', 'initAutoUpdater')
}

function showUpdateUI(info){
    //TODO Make this message a bit more informative `${info.version}`
    document.getElementById('image_seal_container').setAttribute('update', true)
    document.getElementById('image_seal_container').onclick = () => {
        setOverlayContent('Update Available', 'A new update for the launcher is available. Would you like to install now?', 'Install', 'Later')
        setOverlayHandler(() => {
            if(!isDev){
                ipcRenderer.send('autoUpdateAction', 'installUpdateNow')
            } else {
                console.error('Cannot install updates in development environment.')
                toggleOverlay(false)
            }
        })
        setDismissHandler(() => {
            toggleOverlay(false)
        })
        toggleOverlay(true, true)
    }
}

/* jQuery Example
$(function(){
    console.log('UICore Initialized');
})*/

document.addEventListener('readystatechange', function () {
    if (document.readyState === 'interactive'){
        console.log('UICore Initializing..');

        // Bind close button.
        Array.from(document.getElementsByClassName('fCb')).map((val) => {
            val.addEventListener('click', e => {
                const window = remote.getCurrentWindow()
                window.close()
            })
        })

        // Bind restore down button.
        Array.from(document.getElementsByClassName('fRb')).map((val) => {
            val.addEventListener('click', e => {
                const window = remote.getCurrentWindow()
                if(window.isMaximized()){
                    window.unmaximize()
                } else {
                    window.maximize()
                }
                document.activeElement.blur()
            })
        })

        // Bind minimize button.
        Array.from(document.getElementsByClassName('fMb')).map((val) => {
            val.addEventListener('click', e => {
                const window = remote.getCurrentWindow()
                window.minimize()
                document.activeElement.blur()
            })
        })

    } else if(document.readyState === 'complete'){

        //266.01
        //170.8
        //53.21
        // Bind progress bar length to length of bot wrapper
        //const targetWidth = document.getElementById("launch_content").getBoundingClientRect().width
        //const targetWidth2 = document.getElementById("server_selection").getBoundingClientRect().width
        //const targetWidth3 = document.getElementById("launch_button").getBoundingClientRect().width

        document.getElementById("launch_details").style.maxWidth = 266.01
        document.getElementById("launch_progress").style.width = 170.8
        document.getElementById("launch_details_right").style.maxWidth = 170.8
        document.getElementById("launch_progress_label").style.width = 53.21
        
    }

}, false)

/**
 * Open web links in the user's default browser.
 */
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    //console.log(os.homedir())
    shell.openExternal(this.href)
})

/**
 * Opens DevTools window if you hold (ctrl + shift + i).
 * This will crash the program if you are using multiple
 * DevTools, for example the chrome debugger in VS Code. 
 */
document.addEventListener('keydown', function (e) {
    if((e.key === 'I' || e.key === 'i') && e.ctrlKey && e.shiftKey){
        let window = remote.getCurrentWindow()
        window.toggleDevTools()
    }
})