/**
 * Core UI functions are initialized in this file. This prevents
 * unexpected errors from breaking the core features. Specifically,
 * actions in this file should not require the usage of any internal
 * modules, excluding dependencies.
 */
// Requirements
const $                                      = require('jquery')
const {ipcRenderer, remote, shell, webFrame} = require('electron')
const isDev                                  = require('./assets/js/isdev')
const LoggerUtil                             = require('./assets/js/loggerutil')
const ConfigManagerV2                        = require('./assets/js/configmanager')
const loggerUICore             = LoggerUtil('%c[UICore]', 'color: #000668; font-weight: bold')
const loggerAutoUpdater        = LoggerUtil('%c[AutoUpdater]', 'color: #000668; font-weight: bold')
const loggerAutoUpdaterSuccess = LoggerUtil('%c[AutoUpdater]', 'color: #209b07; font-weight: bold')
let builder=0

function a(){
    // Eeeğm öle işte
    
    document.title = ConfigManagerV2.getLD().Launcher.Name
    let fTT=document.querySelector("#frameTitleText")
    let sASB=document.querySelector("#settingsAboutSourceButton")
    let sAT=document.querySelector("#settingsAboutTitle")
    let lDT=document.querySelector(".loginDisclaimerText")
    let nB=document.querySelector("#newsButton")
    let foo=document.querySelector("#baby-foo")
    let framebar=document.querySelector("#frameBar")
    let frameSA=document.querySelector("#frameSeninAnan")
    if(fTT) {fTT.innerHTML = ConfigManagerV2.getLD().Launcher.Name;builder++}
    if(sASB) {sASB.href = ConfigManagerV2.getLD().Launcher.FileUrl;builder++}
    if(sAT) {sAT.innerHTML = ConfigManagerV2.getLD().Launcher.Name;builder++}
    if(lDT) {lDT.innerHTML = `${ConfigManagerV2.getLD().Launcher.Name} ile Mojang arasına bir iş birliği bulunmamaktadır`;builder++}
    if(foo) {foo.outerHTML = `<webview id="foo" src="${ConfigManagerV2.getLD().WebAddress}" style="width:100%; height:100%" autosize="on" minwidth="576" minheight="432" allowtransparency></webview>`;builder++}
    if(framebar) {framebar.style.backgroundColor = `rgba(${ConfigManagerV2.getLD().others.frameBarC.join(",")})`;builder++}
    if(nB) {
        if(ConfigManagerV2.getLD().WebAddress){
            nB.style.opacity = 1
            builder++
        }else{
            nB.style.top = "-100%";builder++
        }
    }
    if(frameSA){
        if(ConfigManagerV2.getLD().others.LNameBg) {
            frameSA.style.opacity=1
        };builder++
    }
    console.log(builder)
    if(!(builder>=10)) setTimeout(a, 15)
}
a()
// Log deprecation and process warnings.
process.traceProcessWarnings = true
process.traceDeprecation = true

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

// Initialize auto updates in production environments.
let updateCheckListener
if(!isDev){
    ipcRenderer.on('autoUpdateNotification', (event, arg, info) => {
        switch(arg){
            case 'checking-for-update':
                loggerAutoUpdater.log('Güncelleme aranıyor..')
                settingsUpdateButtonStatus('Güncelleme aranıyor..', true)
                break
            case 'update-available':
                loggerAutoUpdaterSuccess.log('Yeni güncelleme mevcut', info.version)
                
                if(process.platform === 'darwin'){
                    info.darwindownload = `https://github.com/dscalzi/PixargonLauncher/releases/download/v${info.version}/pixargonlauncher-setup-${info.version}.dmg`
                    showUpdateUI(info)
                }
                
                populateSettingsUpdateInformation(info)
                break
            case 'update-downloaded':
                loggerAutoUpdaterSuccess.log('Güncelleme ' + info.version + ' indirmeye hazır.')
                settingsUpdateButtonStatus('Şimdi indir', false, () => {
                    if(!isDev){
                        ipcRenderer.send('autoUpdateAction', 'installUpdateNow')
                    }
                })
                showUpdateUI(info)
                break
            case 'update-not-available':
                loggerAutoUpdater.log('Yeni güncelleme bulunamadı.')
                settingsUpdateButtonStatus('Güncellemeleri kontrol et')
                break
            case 'ready':
                updateCheckListener = setInterval(() => {
                    ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
                }, 1800000)
                ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
                break
            case 'realerror':
                if(info != null && info.code != null){
                    if(info.code === 'ERR_UPDATER_INVALID_RELEASE_FEED'){
                        loggerAutoUpdater.log('Uygun sürüm bulunamadı.')
                    } else if(info.code === 'ERR_XML_MISSED_ELEMENT'){
                        loggerAutoUpdater.log('Sürüm bulunamadı.')
                    } else {
                        loggerAutoUpdater.error('Güncelleme kontrolünde hata..', info)
                        loggerAutoUpdater.debug('Hata kodu:', info.code)
                    }
                }
                break
            default:
                loggerAutoUpdater.log('Bilinmeyen konu', arg)
                break
        }
    })
}

/**
 * Send a notification to the main process changing the value of
 * allowPrerelease. If we are running a prerelease version, then
 * this will always be set to true, regardless of the current value
 * of val.
 * 
 * @param {boolean} val The new allow prerelease value.
 */
function changeAllowPrerelease(val){
    ipcRenderer.send('autoUpdateAction', 'allowPrereleaseChange', val)
}

function showUpdateUI(info){
    //TODO Make this message a bit more informative `${info.version}`
    document.getElementById('image_seal_container').setAttribute('update', true)
    document.getElementById('image_seal_container').onclick = () => {
        /*setOverlayContent('Update Available', 'A new update for the launcher is available. Would you like to install now?', 'Install', 'Later')
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
        toggleOverlay(true, true)*/
        switchView(getCurrentView(), VIEWS.settings, 500, 500, () => {
            settingsNavItemListener(document.getElementById('settingsNavUpdate'), false)
        })
    }
}

/* jQuery Example
$(function(){
    loggerUICore.log('UICore Initialized');
})*/

document.addEventListener('readystatechange', function () {
    if (document.readyState === 'interactive'){
        loggerUICore.log('UICore Başlatılıyor..')

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

        // Remove focus from social media buttons once they're clicked.
        Array.from(document.getElementsByClassName('mediaURL')).map(val => {
            val.addEventListener('click', e => {
                document.activeElement.blur()
            })
        })

    } else if(document.readyState === 'complete'){

        
    }

}, false)

/**
 * Open web links in the user's default browser.
 */
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault()
    shell.openExternal(this.href)
})

/**
 * Opens DevTools window if you hold (ctrl + shift + i).
 * This will crash the program if you are using multiple
 * DevTools, for example the chrome debugger in VS Code. 
 */

document.addEventListener('keydown', function (e) {
        if((isDev) && (e.key === 'I' || e.key === 'i') && e.ctrlKey && e.shiftKey){
            let window = remote.getCurrentWindow()
            window.toggleDevTools()
        }
})

