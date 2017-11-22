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

        document.getElementById("menu_button").addEventListener('click', function(e){
            console.log('testing')
            testdownloads()
        })

    }
}

// Open web links in the user's default browser.
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    //console.log(os.homedir())
    shell.openExternal(this.href)
})

testdownloads = async function(){
    //const lp = require(path.join(__dirname, 'assets', 'js', 'launchprocess.js'))
    let versionData = await ag.loadVersionData('1.11.2', GAME_DIRECTORY)
    await ag.validateAssets(versionData, GAME_DIRECTORY)
    console.log('assets done')
    await ag.validateLibraries(versionData, GAME_DIRECTORY)
    console.log('libs done')
    await ag.validateMiscellaneous(versionData, GAME_DIRECTORY)
    console.log('files done')
    const serv = await ag.validateDistribution('WesterosCraft-1.11.2', GAME_DIRECTORY)
    console.log('forge stuff done')
    ag.instance.on('dlcomplete', async function(){
        const forgeData = await ag.loadForgeData('WesterosCraft-1.11.2', GAME_DIRECTORY)
        const authUser = await mojang.auth('EMAIL', 'PASS', DEFAULT_CONFIG.getClientToken(), {
            name: 'Minecraft',
            version: 1
        })
        //lp.launchMinecraft(versionData, forgeData, GAME_DIRECTORY)
        //lp.launchMinecraft(versionData, GAME_DIRECTORY)
        let pb = new ProcessBuilder(GAME_DIRECTORY, serv, versionData, forgeData, authUser)
        const proc = pb.build()
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