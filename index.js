const remoteMain = require('@electron/remote/main')
remoteMain.initialize()

// Requirements
const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron')
const autoUpdater                       = require('electron-updater').autoUpdater
const AdmZip                            = require('adm-zip')
const child_process                     = require('child_process')
const ejse                              = require('ejs-electron')
const fs                                = require('fs')
const isDev                             = require('./app/assets/js/isdev')
const path                              = require('path')
const semver                            = require('semver')
const { pathToFileURL }                 = require('url')
const { AZURE_CLIENT_ID, MSFT_OPCODE, MSFT_REPLY_TYPE, MSFT_ERROR, SHELL_OPCODE } = require('./app/assets/js/ipcconstants')
const LangLoader                        = require('./app/assets/js/langloader')

// Keep launcher data stable while using a fresh cache after legacy migrations fail.
const userDataPath = path.join(app.getPath('appData'), 'Build Launcher')
app.setPath('userData', userDataPath)
app.setPath('cache', path.join(userDataPath, 'Cache-v2'))
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

// Setup Lang
LangLoader.setupLanguage()

// Setup auto updater.
let autoUpdaterInitialized = false
let autoUpdaterWebContents

function sendAutoUpdateNotification(...args) {
    if(autoUpdaterWebContents && !autoUpdaterWebContents.isDestroyed()) {
        autoUpdaterWebContents.send('autoUpdateNotification', ...args)
    }
}

function initAutoUpdater(event, data) {
    autoUpdaterWebContents = event.sender

    if(autoUpdaterInitialized) {
        return
    }

    const isPrereleaseVersion = semver.prerelease(app.getVersion()) != null
    autoUpdater.allowPrerelease = Boolean(data) || isPrereleaseVersion
    autoUpdaterInitialized = true
    
    if(isDev){
        autoUpdater.autoInstallOnAppQuit = false
        autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml')
    }
    if(process.platform === 'darwin'){
        autoUpdater.autoDownload = false
    }
    autoUpdater.on('update-available', (info) => {
        sendAutoUpdateNotification('update-available', info)
    })
    autoUpdater.on('update-downloaded', (info) => {
        sendAutoUpdateNotification('update-downloaded', info)
    })
    autoUpdater.on('update-not-available', (info) => {
        sendAutoUpdateNotification('update-not-available', info)
    })
    autoUpdater.on('checking-for-update', () => {
        sendAutoUpdateNotification('checking-for-update')
    })
    autoUpdater.on('error', (err) => {
        sendAutoUpdateNotification('realerror', err)
    }) 
}

// Open channel to listen for update actions.
ipcMain.on('autoUpdateAction', (event, arg, data) => {
    switch(arg){
        case 'initAutoUpdater':
            console.log('Initializing auto updater.')
            initAutoUpdater(event, data)
            event.sender.send('autoUpdateNotification', 'ready')
            break
        case 'checkForUpdate':
            autoUpdater.checkForUpdates()
                .catch(err => {
                    console.error('Failed to check for launcher updates.', err)
                })
            break
        case 'allowPrereleaseChange':
            if(!data){
                const preRelComp = semver.prerelease(app.getVersion())
                if(preRelComp != null && preRelComp.length > 0){
                    autoUpdater.allowPrerelease = true
                } else {
                    autoUpdater.allowPrerelease = data
                }
            } else {
                autoUpdater.allowPrerelease = data
            }
            break
        case 'installUpdateNow':
            autoUpdater.quitAndInstall()
            break
        default:
            console.log('Unknown argument', arg)
            break
    }
})
// Redirect distribution index event from preloader to renderer.
ipcMain.on('distributionIndexDone', (event, res) => {
    event.sender.send('distributionIndexDone', res)
})

// Handle trash item.
ipcMain.handle(SHELL_OPCODE.TRASH_ITEM, async (event, ...args) => {
    try {
        await shell.trashItem(args[0])
        return {
            result: true
        }
    } catch(error) {
        return {
            result: false,
            error: error
        }
    }
})

// Disable hardware acceleration.
// https://electronjs.org/docs/tutorial/offscreen-rendering
app.disableHardwareAcceleration()


const REDIRECT_URI_PREFIX = 'https://login.microsoftonline.com/common/oauth2/nativeclient?'

// Microsoft Auth Login
let msftAuthWindow
let msftAuthSuccess
let msftAuthViewSuccess
let msftAuthViewOnClose
ipcMain.on(MSFT_OPCODE.OPEN_LOGIN, (ipcEvent, ...arguments_) => {
    if (msftAuthWindow) {
        ipcEvent.reply(MSFT_OPCODE.REPLY_LOGIN, MSFT_REPLY_TYPE.ERROR, MSFT_ERROR.ALREADY_OPEN, msftAuthViewOnClose)
        return
    }
    msftAuthSuccess = false
    msftAuthViewSuccess = arguments_[0]
    msftAuthViewOnClose = arguments_[1]
    msftAuthWindow = new BrowserWindow({
        title: LangLoader.queryJS('index.microsoftLoginTitle'),
        backgroundColor: '#222222',
        width: 520,
        height: 600,
        frame: true,
        icon: getPlatformIcon('SealCircle copy')
    })

    msftAuthWindow.on('closed', () => {
        msftAuthWindow = undefined
    })

    msftAuthWindow.on('close', () => {
        if(!msftAuthSuccess) {
            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGIN, MSFT_REPLY_TYPE.ERROR, MSFT_ERROR.NOT_FINISHED, msftAuthViewOnClose)
        }
    })

    msftAuthWindow.webContents.on('did-navigate', (_, uri) => {
        if (uri.startsWith(REDIRECT_URI_PREFIX)) {
            let queryMap = {}
            
            new URL(uri).searchParams.forEach((v, k) => {
                queryMap[k] = v;
            });

            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGIN, MSFT_REPLY_TYPE.SUCCESS, queryMap, msftAuthViewSuccess)

            msftAuthSuccess = true
            msftAuthWindow.close()
            msftAuthWindow = null
        }
    })

    msftAuthWindow.removeMenu()
    msftAuthWindow.loadURL(`https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?prompt=select_account&client_id=${AZURE_CLIENT_ID}&response_type=code&scope=XboxLive.signin%20offline_access&redirect_uri=https://login.microsoftonline.com/common/oauth2/nativeclient`)
        .catch(error => {
            console.error('Unable to open Microsoft sign-in:', error)
            msftAuthSuccess = true
            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGIN, MSFT_REPLY_TYPE.ERROR, 'MSFT_AUTH_ERR_LOAD_FAILED', msftAuthViewOnClose)
            msftAuthWindow?.close()
            msftAuthWindow = null
        })
})

        ipcMain.on(MSFT_OPCODE.CANCEL_LOGIN, () => {
            if(msftAuthWindow && !msftAuthWindow.isDestroyed()) {
                msftAuthWindow.close()
            }
        })

// Microsoft Auth Logout
let msftLogoutWindow
let msftLogoutSuccess
let msftLogoutSuccessSent
ipcMain.on(MSFT_OPCODE.OPEN_LOGOUT, (ipcEvent, uuid, isLastAccount) => {
    if (msftLogoutWindow) {
        ipcEvent.reply(MSFT_OPCODE.REPLY_LOGOUT, MSFT_REPLY_TYPE.ERROR, MSFT_ERROR.ALREADY_OPEN)
        return
    }

    msftLogoutSuccess = false
    msftLogoutSuccessSent = false
    msftLogoutWindow = new BrowserWindow({
        title: LangLoader.queryJS('index.microsoftLogoutTitle'),
        backgroundColor: '#222222',
        width: 520,
        height: 600,
        frame: true,
        icon: getPlatformIcon('SealCircle copy')
    })

    msftLogoutWindow.on('closed', () => {
        msftLogoutWindow = undefined
    })

    msftLogoutWindow.on('close', () => {
        if(!msftLogoutSuccess) {
            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGOUT, MSFT_REPLY_TYPE.ERROR, MSFT_ERROR.NOT_FINISHED)
        } else if(!msftLogoutSuccessSent) {
            msftLogoutSuccessSent = true
            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGOUT, MSFT_REPLY_TYPE.SUCCESS, uuid, isLastAccount)
        }
    })
    
    msftLogoutWindow.webContents.on('did-navigate', (_, uri) => {
        if(uri.startsWith('https://login.microsoftonline.com/common/oauth2/v2.0/logoutsession')) {
            msftLogoutSuccess = true
            setTimeout(() => {
                if(!msftLogoutSuccessSent) {
                    msftLogoutSuccessSent = true
                    ipcEvent.reply(MSFT_OPCODE.REPLY_LOGOUT, MSFT_REPLY_TYPE.SUCCESS, uuid, isLastAccount)
                }

                if(msftLogoutWindow) {
                    msftLogoutWindow.close()
                    msftLogoutWindow = null
                }
            }, 5000)
        }
    })
    
    msftLogoutWindow.removeMenu()
    msftLogoutWindow.loadURL('https://login.microsoftonline.com/common/oauth2/v2.0/logout')
})

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win
let otpProcess
let otpPort = 8787

async function showOtpConfigurationDialog(envPath, missingEnv = []) {
    const requiredFields = missingEnv.length > 0
        ? missingEnv.join(', ')
        : 'DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, ADMIN_DISCORD_IDS, OTP_PEPPER'
    const { response } = await dialog.showMessageBox({
        type: 'warning',
        title: 'Configuration OTP requise',
        message: 'Le service OTP Discord n’est pas configuré.',
        detail: `Renseigne ${requiredFields} dans ce fichier, puis redémarre BuildLauncher :\n${envPath}`,
        buttons: ['Ouvrir le fichier', 'Plus tard'],
        defaultId: 0,
        cancelId: 1
    })

    if(response === 0) {
        const error = await shell.openPath(envPath)
        if(error) console.error(`Unable to open OTP configuration file: ${error}`)
    }
}

function readOtpPort(envContent) {
    const configuredPort = process.env.PORT || envContent.match(/^\s*PORT\s*=\s*["']?(\d+)["']?\s*(?:#.*)?$/m)?.[1]
    if(configuredPort == null) {
        return 8787
    }

    const port = Number(configuredPort)
    if(!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('Invalid OTP PORT. Use a number between 1 and 65535.')
    }
    return port
}

async function startOtpService() {
    if(otpProcess) return

    const serviceResourceDirectory = app.isPackaged
        ? path.join(process.resourcesPath, 'bot-otp')
        : path.join(__dirname, 'bot-otp')
    const configDirectory = app.isPackaged
        ? path.join(userDataPath, 'bot-otp')
        : serviceResourceDirectory
    const envPath = path.join(configDirectory, '.env')

    if(!fs.existsSync(envPath) && app.isPackaged) {
        fs.mkdirSync(configDirectory, { recursive: true })
        fs.copyFileSync(path.join(serviceResourceDirectory, '.env.example'), envPath)
        console.warn(`[OTP] Configure Discord credentials in ${envPath}, then restart the launcher.`)
        await showOtpConfigurationDialog(envPath)
        return
    }

    if(!fs.existsSync(envPath)) {
        console.warn(`[OTP] No configuration found at ${envPath}; the service was not started.`)
        return
    }

    const envContent = fs.readFileSync(envPath, 'utf8')
    otpPort = readOtpPort(envContent)
    const requiredEnv = ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'ADMIN_DISCORD_IDS', 'OTP_PEPPER']
    const missingEnv = requiredEnv.filter(name => !new RegExp(`^${name}=\\s*[^\\s#]+`, 'm').test(envContent))
    if(missingEnv.length > 0) {
        console.warn(`[OTP] Complete ${missingEnv.join(', ')} in ${envPath}; the service was not started.`)
        if(app.isPackaged) await showOtpConfigurationDialog(envPath, missingEnv)
        return
    }

    try {
        const response = await fetch(`http://127.0.0.1:${otpPort}/health`, {
            signal: AbortSignal.timeout(1000)
        })
        if(response.ok) {
            console.log('[OTP] Existing OTP service detected; reusing it.')
            return
        }
    } catch {}

    let serviceDirectory = serviceResourceDirectory
    if(app.isPackaged) {
        serviceDirectory = path.join(configDirectory, 'runtime')
        if(!fs.existsSync(path.join(serviceDirectory, 'server.js'))) {
            fs.mkdirSync(serviceDirectory, { recursive: true })
            new AdmZip(path.join(serviceResourceDirectory, 'bot-otp-runtime.zip')).extractAllTo(serviceDirectory, true)
        }
    }

    const executable = app.isPackaged
        ? process.execPath
        : (process.platform === 'win32' ? 'node.exe' : 'node')
    const serverArgs = [path.join(serviceDirectory, 'server.js')]
    otpProcess = child_process.spawn(executable, app.isPackaged ? serverArgs : ['server.js'], {
        cwd: serviceDirectory,
        env: {
            ...process.env,
            PORT: String(otpPort),
            DOTENV_CONFIG_PATH: envPath,
            ...(app.isPackaged ? { ELECTRON_RUN_AS_NODE: '1' } : {})
        },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    otpProcess.stdout.on('data', data => console.log(`[OTP] ${data.toString().trim()}`))
    otpProcess.stderr.on('data', data => console.error(`[OTP] ${data.toString().trim()}`))
    otpProcess.on('error', error => console.error('Unable to start OTP service:', error))
    otpProcess.on('exit', (code, signal) => {
        console.log(`OTP service stopped (${code ?? signal})`)
        otpProcess = null
    })
}

function stopOtpService() {
    if(otpProcess && !otpProcess.killed) {
        otpProcess.kill()
        otpProcess = null
    }
}

function createWindow() {

    win = new BrowserWindow({
        width: 980,
        height: 552,
        show: false,
        icon: getPlatformIcon('SealCircle copy'),
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'app', 'assets', 'js', 'preloader.js'),
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#171614'
    })
    remoteMain.enable(win.webContents)

    const data = {
        bkid: Math.floor((Math.random() * fs.readdirSync(path.join(__dirname, 'app', 'assets', 'images', 'backgrounds')).length)),
        otpPort,
        lang: (str, placeHolders) => LangLoader.queryEJS(str, placeHolders)
    }
    Object.entries(data).forEach(([key, val]) => ejse.data(key, val))

    win.loadURL(pathToFileURL(path.join(__dirname, 'app', 'app.ejs')).toString())

    const showFallback = setTimeout(() => {
        if (win && !win.isDestroyed()) {
            win.show()
        }
    }, 3000)

    win.once('ready-to-show', () => {
        clearTimeout(showFallback)
        win.show()
    })

    win.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
        console.error(`Renderer load failed (${errorCode}): ${errorDescription} - ${validatedURL}`)
    })

    win.webContents.on('render-process-gone', (_, details) => {
        console.error('Renderer process exited:', details)
    })

    win.removeMenu()

    win.resizable = true

    win.on('closed', () => {
        win = null
    })
}

function createMenu() {
    
    if(process.platform === 'darwin') {

        // Extend default included application menu to continue support for quit keyboard shortcut
        let applicationSubMenu = {
            label: 'Application',
            submenu: [{
                label: 'About Application',
                selector: 'orderFrontStandardAboutPanel:'
            }, {
                type: 'separator'
            }, {
                label: 'Quit',
                accelerator: 'Command+Q',
                click: () => {
                    app.quit()
                }
            }]
        }

        // New edit menu adds support for text-editing keyboard shortcuts
        let editSubMenu = {
            label: 'Edit',
            submenu: [{
                label: 'Undo',
                accelerator: 'CmdOrCtrl+Z',
                selector: 'undo:'
            }, {
                label: 'Redo',
                accelerator: 'Shift+CmdOrCtrl+Z',
                selector: 'redo:'
            }, {
                type: 'separator'
            }, {
                label: 'Cut',
                accelerator: 'CmdOrCtrl+X',
                selector: 'cut:'
            }, {
                label: 'Copy',
                accelerator: 'CmdOrCtrl+C',
                selector: 'copy:'
            }, {
                label: 'Paste',
                accelerator: 'CmdOrCtrl+V',
                selector: 'paste:'
            }, {
                label: 'Select All',
                accelerator: 'CmdOrCtrl+A',
                selector: 'selectAll:'
            }]
        }

        // Bundle submenus into a single template and build a menu object with it
        let menuTemplate = [applicationSubMenu, editSubMenu]
        let menuObject = Menu.buildFromTemplate(menuTemplate)

        // Assign it to the application
        Menu.setApplicationMenu(menuObject)

    }

}

function getPlatformIcon(filename){
    const imageDir = path.join(__dirname, 'app', 'assets', 'images')
    const extCandidates = process.platform === 'win32'
        ? ['ico', 'png']
        : ['png', 'ico']

    for (const ext of extCandidates) {
        const fullPath = path.join(imageDir, `${filename}.${ext}`)
        if (fs.existsSync(fullPath)) {
            return fullPath
        }
    }

    const fallbackExt = process.platform === 'win32' ? 'ico' : 'png'
    return path.join(imageDir, `${filename}.${fallbackExt}`)
}

app.on('ready', () => {
    startOtpService().catch(error => console.error('Unable to initialize OTP service:', error))
    createWindow()
})
app.on('ready', createMenu)

app.on('before-quit', stopOtpService)

app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
})
