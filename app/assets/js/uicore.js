/**
 * Core UI functions are initialized in this file. This prevents
 * unexpected errors from breaking the core features. Specifically,
 * actions in this file should not require the usage of any internal
 * modules, excluding dependencies.
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
 * Opens DevTools window if you hold (ctrl + shift + i).
 * This will crash the program if you are using multiple
 * DevTools, for example the chrome debugger in VS Code. 
 */
document.addEventListener('keydown', function (e) {
    if(e.keyCode == 73 && e.ctrlKey && e.shiftKey){
        let window = remote.getCurrentWindow()
        window.toggleDevTools()
    }
})