const app = require('electron')
const remote = require('electron').BrowserWindow

/**
 * Doesn't work yet.
 */
exports.setIconBadge = function(text){
    if(process.platform === 'darwin'){
        app.dock.setBadge('' + text)
    } else if (process.platform === 'win32'){
        const win = remote.getFocusedWindow()
        if(text === ''){
            win.setOverlayIcon(null, '')
            return;
        }

        //Create badge
        const canvas = document.createElement('canvas')
        canvas.height = 140;
        canvas.width = 140;
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#a02d2a'
        ctx.beginPath()
        ctx.ellipse(70, 70, 70, 70, 0, 0, 2 * Math.PI)
        ctx.fill()
        ctx.textAlign = 'center'
        ctx.fillStyle = 'white'

        if(text.length > 2 ){
            ctx.font = '75px sans-serif'
            ctx.fillText('' + text, 70, 98)
        } else if (text.length > 1){
            ctx.font = '100px sans-serif'
            ctx.fillText('' + text, 70, 105)
        } else {
            ctx.font = '125px sans-serif'
            ctx.fillText('' + text, 70, 112)
        }

        const badgeDataURL = canvas.toDataURL()
        const img = NativeImage.createFromDataURL(badgeDataURL)
        win.setOverlayIcon(img, '' + text)
    }
}