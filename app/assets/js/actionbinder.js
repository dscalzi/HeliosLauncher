const mojang = require('mojang')
const path = require('path')
const AssetGuard = require(path.join(__dirname, 'assets', 'js', 'assetguard.js'))
const ProcessBuilder = require(path.join(__dirname, 'assets', 'js', 'processbuilder.js'))
const {GAME_DIRECTORY, DEFAULT_CONFIG} = require(path.join(__dirname, 'assets', 'js', 'constants.js'))

document.onreadystatechange = function(){
    if (document.readyState === 'interactive'){

        // Bind launch button
        document.getElementById("launch_button").addEventListener('click', function(e){
            console.log('Launching game..')
            testdownloads()
        })

    }
}

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
    const versionData = await AssetGuard.loadVersionData('1.11.2', GAME_DIRECTORY)
    progress.setAttribute('value', 20)
    progress_text.innerHTML = '20%'

    det_text.innerHTML = 'Validating asset integrity..'
    await AssetGuard.validateAssets(versionData, GAME_DIRECTORY)
    progress.setAttribute('value', 40)
    progress_text.innerHTML = '40%'
    console.log('assets done')

    det_text.innerHTML = 'Validating library integrity..'
    await AssetGuard.validateLibraries(versionData, GAME_DIRECTORY)
    progress.setAttribute('value', 60)
    progress_text.innerHTML = '60%'
    console.log('libs done')

    det_text.innerHTML = 'Validating miscellaneous file integrity..'
    await AssetGuard.validateMiscellaneous(versionData, GAME_DIRECTORY)
    progress.setAttribute('value', 80)
    progress_text.innerHTML = '80%'
    console.log('files done')

    det_text.innerHTML = 'Validating server distribution files..'
    const serv = await AssetGuard.validateDistribution('WesterosCraft-1.11.2', GAME_DIRECTORY)
    progress.setAttribute('value', 100)
    progress_text.innerHTML = '100%'
    console.log('forge stuff done')

    det_text.innerHTML = 'Downloading files..'
    AssetGuard.instance.on('totaldlprogress', function(data){
        progress.setAttribute('max', data.total)
        progress.setAttribute('value', data.acc)
        progress_text.innerHTML = parseInt((data.acc/data.total)*100) + '%'
    })

    AssetGuard.instance.on('dlcomplete', async function(){
        det_text.innerHTML = 'Preparing to launch..'
        const forgeData = await AssetGuard.loadForgeData('WesterosCraft-1.11.2', GAME_DIRECTORY)
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
            const tempListener = function(data){
                if(data.indexOf('[Client thread/INFO]: -- System Details --') > -1){
                    details.style.display = 'none'
                    content.style.display = 'inline-flex'
                    proc.stdout.removeListener('data', tempListener)
                }
            }
            proc.stdout.on('data', tempListener)
        } catch(err) {
            //det_text.innerHTML = 'Error: ' + err.message;
            det_text.innerHTML = 'Error: See log for details..';
            console.log(err)
            setTimeout(function(){
                details.style.display = 'none'
                content.style.display = 'inline-flex'
            }, 5000)
        }
    })
    AssetGuard.processDlQueues()
}