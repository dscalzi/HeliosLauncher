/**
 * Core UI functions are initialized in this file. This prevents
 * unexpected errors from breaking the core features.
 */
const $ = require('jquery');
const {remote, shell} = require('electron')

/* jQuery Example
$(function(){
    console.log('UICore Initialized');
})*/

document.addEventListener('readystatechange', function () {
    if (document.readyState === 'interactive'){
        console.log('UICore Initializing..');

        // Bind close button.
        document.getElementById("frame_btn_close").addEventListener("click", function (e) {
            const window = remote.getCurrentWindow()
            window.close()
        })

        // Bind restore down button.
        document.getElementById("frame_btn_restoredown").addEventListener("click", function (e) {
            const window = remote.getCurrentWindow()
            if(window.isMaximized()){
                window.unmaximize();
            } else {
                window.maximize()
            }
        })

        // Bind minimize button.
        document.getElementById("frame_btn_minimize").addEventListener("click", function (e) {
            const window = remote.getCurrentWindow()
            window.minimize()
        })

    } else if(document.readyState === 'complete'){

        // Bind progress bar length to length of bot wrapper
        const targetWidth = document.getElementById("launch_content").getBoundingClientRect().width
        const targetWidth2 = document.getElementById("server_selection").getBoundingClientRect().width
        const targetWidth3 = document.getElementById("launch_button").getBoundingClientRect().width
        document.getElementById("launch_details").style.maxWidth = targetWidth
        document.getElementById("launch_progress").style.width = targetWidth2
        document.getElementById("launch_details_right").style.maxWidth = targetWidth2
        document.getElementById("launch_progress_label").style.width = targetWidth3
        
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
 * Opens DevTools window if you type "wcdev" in sequence.
 * This will crash the program if you are using multiple
 * DevTools, for example the chrome debugger in VS Code. 
 */
const match = [87, 67, 68, 69, 86]
let at = 0;

document.addEventListener('keydown', function (e) {
    switch(e.keyCode){
        case match[0]:
            if(at === 0) ++at
            break
        case match[1]:
            if(at === 1) ++at
            break
        case match[2]:
            if(at === 2) ++at
            break
        case match[3]:
            if(at === 3) ++at
            break
        case match[4]:
            if(at === 4) ++at
            break
        default:
            at = 0
    }
    if(at === 5) {
        var window = remote.getCurrentWindow()
        window.toggleDevTools()
        at = 0
    }
})