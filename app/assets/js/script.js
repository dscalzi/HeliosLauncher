var $ = require('jQuery');
const remote = require('electron').remote
const shell = require('electron').shell
const path = require('path')

/* Open web links in the user's default browser. */
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    //testdownloads()
    shell.openExternal(this.href)
});

testdownloads = async function(){
    const ag = require(path.join(__dirname, 'assets', 'js', 'assetguard.js'))
    const lp = require(path.join(__dirname, 'assets', 'js', 'launchprocess.js'))
    const basePath = path.join(__dirname, '..', 'mcfiles')
    let versionData = await ag.loadVersionData('1.11.2', basePath)
    await ag.validateAssets(versionData, basePath)
    console.log('assets done')
    await ag.validateLibraries(versionData, basePath)
    console.log('libs done')
    await ag.validateMiscellaneous(versionData, basePath)
    console.log('files done')
    ag.instance.on('dlcomplete', function(){
        lp.launchMinecraft(versionData, basePath)
    })
    ag.processDlQueues()
}

/*Opens DevTools window if you type "wcdev" in sequence.
  This will crash the program if you are using multiple
  DevTools, for example the chrome debugger in VS Code. */
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