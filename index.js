const {app, BrowserWindow} = require('electron')
const path = require('path')
const url = require('url')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow() {
    win = new BrowserWindow({ width: 925, height: 500, icon: getPlatformIcon('WesterosSealSquare')})

    win.loadURL(url.format({
        pathname: path.join(__dirname, 'app', 'index.html'),
        protocol: 'file:',
        slashes: true
    }))

    win.setMenu(null)

    //Code for testing, marked for removal one it's properly implemented.
    const assetdl = require('./app/assets/js/assetdownload.js')
    const basePath = path.join(__dirname, 'mcfiles')
    const dataPromise = assetdl.parseVersionData('1.11.2', basePath)
    dataPromise.then(function(data){
        //assetdl.downloadAssets(data, basePath)
        //assetdl.downloadClient(data, basePath)
        //assetdl.downloadLogConfig(data, basePath)
        //assetdl.downloadLibraries(data, basePath)
        require('./app/assets/js/launchprocess.js').launchMinecraft(data, basePath)
    })

    win.on('closed', () => {
        win = null
    })
}

function getPlatformIcon(filename){
    const opSys = process.platform
    if (opSys === 'darwin') {
        filename = filename + '.icns'
    } else if (opSys === 'win32') {
        filename = filename + '.ico'
    } else {
        filename = filename + '.png'
    }

    return path.join(__dirname, 'app', 'assets', 'images', filename)
}

app.on('ready', createWindow);

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