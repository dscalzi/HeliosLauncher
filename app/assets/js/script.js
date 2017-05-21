var $ = require('jQuery');
const remote = require('electron').remote
const shell = require('electron').shell
const path = require('path')
const os = require('os');
const ag = require(path.join(__dirname, 'assets', 'js', 'assetguard.js'))

function timestamp(){
    let date = new Date();
    const month = date.getMonth() < 9 ? '0'.concat((date.getMonth()+1)) : date.getMonth()
    const day = date.getDate() < 10 ? '0'.concat(date.getDate()) : date.getDate();
    let hour = date.getHours() > 12 ? date.getHours() - 12 : date.getHours();
    hour = hour < 10 ? '0'.concat(hour) : hour
    const min = date.getMinutes() < 10 ? '0'.concat(date.getMinutes()) : date.getMinutes();
    const sec = date.getSeconds() < 10 ? '0'.concat(date.getSeconds()) : date.getSeconds();

    return os.EOL + '[' + month + '/' + day + '/' + date.getFullYear() + ' ' + hour  + ':' + min + ':' + sec + ']'
}

$(document).on('ready', function(){
    $(".toggle-btn input[type=radio]").addClass("visuallyhidden");
    $(".toggle-btn input[type=radio]").change(function() {
        if($(this).attr("name")) {
            $(this).parent().addClass("success").siblings().removeClass("success")
        } else {
            $(this).parent().toggleClass("success")
        }
    })
    /*console.log = function(){
        $('#launcher-log').append(timestamp() + ' [Log] - ' + Array.prototype.slice.call(arguments).join(' '))
    }
    console.error = function(){
        $('#launcher-log').append(timestamp() + ' [Error] - ' + Array.prototype.slice.call(arguments).join(' '))
    }
    console.log('test')
    //console.debug('test')*/
})

/* Open web links in the user's default browser. */
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    testdownloads()
    //console.log(os.homedir())
    //shell.openExternal(this.href)
});



testdownloads = async function(){
    const lp = require(path.join(__dirname, 'assets', 'js', 'launchprocess.js'))
    const basePath = path.join(__dirname, '..', 'mcfiles')
    let versionData = await ag.loadVersionData('1.11.2', basePath)
    await ag.validateAssets(versionData, basePath)
    console.log('assets done')
    await ag.validateLibraries(versionData, basePath)
    console.log('libs done')
    await ag.validateMiscellaneous(versionData, basePath)
    console.log('files done')
    await ag.validateDistribution('WesterosCraft-1.11.2', basePath)
    console.log('forge stuff done')
    ag.instance.on('dlcomplete', function(){
        //lp.launchMinecraft(versionData, basePath)
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