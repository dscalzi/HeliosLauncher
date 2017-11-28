const $ = require('jquery');
const remote = require('electron').remote
const shell = require('electron').shell
const path = require('path')
const os = require('os');
const ag = require(path.join(__dirname, 'assets', 'js', 'assetguard.js'))
const ProcessBuilder = require(path.join(__dirname, 'assets', 'js', 'processbuilder.js'))
const mojang = require('mojang')
const {GAME_DIRECTORY, DEFAULT_CONFIG} = require(path.join(__dirname, 'assets', 'js', 'constants.js'))

$(document).on('ready', function(){
    console.log('okay');
})

document.onreadystatechange = function () {
    if (document.readyState == "complete") {

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

        // Bind launch button
        document.getElementById("launch_button").addEventListener('click', function(e){
            console.log('Launching game..')
            testdownloads()
        })

        // Bind progress bar length to length of bot wrapper
        const targetWidth = document.getElementById("launch_content").getBoundingClientRect().width
        const targetWidth2 = document.getElementById("server_selection").getBoundingClientRect().width
        const targetWidth3 = document.getElementById("launch_button").getBoundingClientRect().width
        document.getElementById("launch_details").style.maxWidth = targetWidth
        document.getElementById("launch_progress").style.width = targetWidth2
        document.getElementById("launch_details_right").style.maxWidth = targetWidth2
        document.getElementById("launch_progress_label").style.width = targetWidth3
    }
}

// Open web links in the user's default browser.
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    //console.log(os.homedir())
    shell.openExternal(this.href)
})

testdownloads = async function(){
    const content = document.getElementById("launch_content")
    const details = document.getElementById("launch_details")
    const progress = document.getElementById("launch_progress")
    const progress_text = document.getElementById("launch_progress_label")
    const det_text = document.getElementById("launch_details_text")

    det_text.innerHTML = 'Please wait..'
    progress.setAttribute('max', '100')
    details.style.display = 'flex'
    content.style.display = 'none'

    det_text.innerHTML = 'Loading version information..'
    const versionData = await ag.loadVersionData('1.11.2', GAME_DIRECTORY)
    progress.setAttribute('value', 20)
    progress_text.innerHTML = '20%'

    det_text.innerHTML = 'Validating asset integrity..'
    await ag.validateAssets(versionData, GAME_DIRECTORY)
    progress.setAttribute('value', 40)
    progress_text.innerHTML = '40%'
    console.log('assets done')

    det_text.innerHTML = 'Validating library integrity..'
    await ag.validateLibraries(versionData, GAME_DIRECTORY)
    progress.setAttribute('value', 60)
    progress_text.innerHTML = '60%'
    console.log('libs done')

    det_text.innerHTML = 'Validating miscellaneous file integrity..'
    await ag.validateMiscellaneous(versionData, GAME_DIRECTORY)
    progress.setAttribute('value', 80)
    progress_text.innerHTML = '80%'
    console.log('files done')

    det_text.innerHTML = 'Validating server distribution files..'
    const serv = await ag.validateDistribution('WesterosCraft-1.11.2', GAME_DIRECTORY)
    progress.setAttribute('value', 100)
    progress_text.innerHTML = '100%'
    console.log('forge stuff done')

    det_text.innerHTML = 'Downloading files..'
    ag.instance.on('totaldlprogress', function(data){
        progress.setAttribute('max', data.total)
        progress.setAttribute('value', data.acc)
        progress_text.innerHTML = parseInt((data.acc/data.total)*100) + '%'
    })

    ag.instance.on('dlcomplete', async function(){
        det_text.innerHTML = 'Preparing to launch..'
        const forgeData = await ag.loadForgeData('WesterosCraft-1.11.2', GAME_DIRECTORY)
        const authUser = await mojang.auth('EMAIL', 'PASS', DEFAULT_CONFIG.getClientToken(), {
            name: 'Minecraft',
            version: 1
        })
        let pb = new ProcessBuilder(GAME_DIRECTORY, serv, versionData, forgeData, authUser)
        det_text.innerHTML = 'Launching game..'
        let proc;
        try{
            proc = pb.build()
            det_text.innerHTML = 'Done. Enjoy the server!'
        } catch(err) {
            //det_text.innerHTML = 'Error: ' + err.message;
            det_text.innerHTML = 'Error: See log for details..';
        }
        setTimeout(function(){
            details.style.display = 'none'
            content.style.display = 'inline-flex'
        }, 5000)
    })
    ag.processDlQueues()
}

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