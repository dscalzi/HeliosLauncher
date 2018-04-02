const cp = require('child_process')
const path = require('path')
const {AssetGuard} = require(path.join(__dirname, 'assets', 'js', 'assetguard.js'))
const ProcessBuilder = require(path.join(__dirname, 'assets', 'js', 'processbuilder.js'))
const ConfigManager = require(path.join(__dirname, 'assets', 'js', 'configmanager.js'))
const DiscordWrapper = require(path.join(__dirname, 'assets', 'js', 'discordwrapper.js'))
const Mojang = require(path.join(__dirname, 'assets', 'js', 'mojang.js'))
const AuthManager = require(path.join(__dirname, 'assets', 'js', 'authmanager.js'))

let mojangStatusListener

// Launch Elements
let launch_content, launch_details, launch_progress, launch_progress_label, launch_details_text

// Synchronous Listener
document.addEventListener('readystatechange', function(){

    if (document.readyState === 'complete'){
        if(ConfigManager.isFirstLaunch()){
            $('#welcomeContainer').fadeIn(500)
        } else {
            $('#landingContainer').fadeIn(500)
        }
    }

    if (document.readyState === 'interactive'){

        // Save a reference to the launch elements.
        launch_content = document.getElementById('launch_content')
        launch_details = document.getElementById('launch_details')
        launch_progress = document.getElementById('launch_progress')
        launch_progress_label = document.getElementById('launch_progress_label')
        launch_details_text = document.getElementById('launch_details_text')

        // Bind launch button
        document.getElementById('launch_button').addEventListener('click', function(e){
            console.log('Launching game..')
            //testdownloads()
            dlAsync()
        })

        // TODO convert this to dropdown menu.
        // Bind selected server
        document.getElementById('server_selection').innerHTML = '\u2022 ' + AssetGuard.getServerById(ConfigManager.getGameDirectory(), ConfigManager.getSelectedServer()).name


        // Update Mojang Status Color
        const refreshMojangStatuses = async function(){
            console.log('Refreshing Mojang Statuses..')
            try {
                let status = 'grey'
                const statuses = await Mojang.status()
                greenCount = 0
                for(let i=0; i<statuses.length; i++){
                    if(statuses[i].status === 'yellow' && status !== 'red'){
                        status = 'yellow'
                        continue
                    } else if(statuses[i].status === 'red'){
                        status = 'red'
                        break
                    }
                    ++greenCount
                }
                if(greenCount == statuses.length){
                    status = 'green'
                }

                document.getElementById('mojang_status_icon').style.color = Mojang.statusToHex(status)

            } catch (err) {
                console.error('Unable to refresh Mojang service status..', err)
            }
        }

        refreshMojangStatuses()
        // Set refresh rate to once every 5 minutes.
        mojangStatusListener = setInterval(refreshMojangStatuses, 300000)

    }
}, false)

// Keep reference to Minecraft Process
let proc
// Is DiscordRPC enabled
let hasRPC = false
// Joined server regex
const servJoined = /[[0-2][0-9]:[0-6][0-9]:[0-6][0-9]\] \[Client thread\/INFO\]: \[CHAT\] [a-zA-Z0-9_]{1,16} joined the game/g
const gameJoined = /\[[0-2][0-9]:[0-6][0-9]:[0-6][0-9]\] \[Client thread\/WARN\]: Skipping bad option: lastServer:/g
const gameJoined2 = /\[[0-2][0-9]:[0-6][0-9]:[0-6][0-9]\] \[Client thread\/INFO\]: Created: \d+x\d+ textures-atlas/g

let aEx
let currentProc
let serv
let versionData
let forgeData

function dlAsync(login = true){

    // Login parameter is temporary for debug purposes. Allows testing the validation/downloads without
    // launching the game.

    if(login) {
        if(ConfigManager.getSelectedAccount() == null){
            console.error('login first.')
            //in devtools AuthManager.addAccount(username, pass)
            return
        }
    }

    launch_details_text.innerHTML = 'Please wait..'
    launch_progress.setAttribute('max', '100')
    launch_details.style.display = 'flex'
    launch_content.style.display = 'none'

    aEx = cp.fork(path.join(__dirname, 'assets', 'js', 'assetexec.js'), [
        ConfigManager.getGameDirectory(),
        ConfigManager.getJavaExecutable()
    ])

    aEx.on('message', (m) => {
        if(currentProc === 'validateDistribution'){

            launch_progress.setAttribute('value', 20)
            launch_progress_label.innerHTML = '20%'
            serv = m.result
            console.log('forge stuff done')

            // Begin version load.
            launch_details_text.innerHTML = 'Loading version information..'
            currentProc = 'loadVersionData'
            aEx.send({task: 0, content: currentProc, argsArr: [serv.mc_version]})

        } else if(currentProc === 'loadVersionData'){

            launch_progress.setAttribute('value', 40)
            launch_progress_label.innerHTML = '40%'
            versionData = m.result

            // Begin asset validation.
            launch_details_text.innerHTML = 'Validating asset integrity..'
            currentProc = 'validateAssets'
            aEx.send({task: 0, content: currentProc, argsArr: [versionData]})

        } else if(currentProc === 'validateAssets'){

            launch_progress.setAttribute('value', 60)
            launch_progress_label.innerHTML = '60%'
            console.log('assets done')

            // Begin library validation.
            launch_details_text.innerHTML = 'Validating library integrity..'
            currentProc = 'validateLibraries'
            aEx.send({task: 0, content: currentProc, argsArr: [versionData]})

        } else if(currentProc === 'validateLibraries'){

            launch_progress.setAttribute('value', 80)
            launch_progress_label.innerHTML = '80%'
            console.log('libs done')

            // Begin miscellaneous validation.
            launch_details_text.innerHTML = 'Validating miscellaneous file integrity..'
            currentProc = 'validateMiscellaneous'
            aEx.send({task: 0, content: currentProc, argsArr: [versionData]})

        } else if(currentProc === 'validateMiscellaneous'){

            launch_progress.setAttribute('value', 100)
            launch_progress_label.innerHTML = '100%'
            console.log('files done')

            launch_details_text.innerHTML = 'Downloading files..'
            currentProc = 'processDlQueues'
            aEx.send({task: 0, content: currentProc})

        } else if(currentProc === 'processDlQueues'){
            if(m.task === 0){
                remote.getCurrentWindow().setProgressBar(m.value/m.total)
                launch_progress.setAttribute('max', m.total)
                launch_progress.setAttribute('value', m.value)
                launch_progress_label.innerHTML = m.percent + '%'
            } else if(m.task === 1){
                remote.getCurrentWindow().setProgressBar(-1)

                launch_details_text.innerHTML = 'Preparing to launch..'
                currentProc = 'loadForgeData'
                aEx.send({task: 0, content: currentProc, argsArr: [serv.id]})

            } else {
                console.error('Unknown download data type.', m)
            }
        } else if(currentProc === 'loadForgeData'){

            forgeData = m.result

            if(login) {
                //if(!(await AuthManager.validateSelected())){
                    // 
                //}
                const authUser = ConfigManager.getSelectedAccount();
                console.log('authu', authUser)
                let pb = new ProcessBuilder(ConfigManager.getGameDirectory(), serv, versionData, forgeData, authUser)
                launch_details_text.innerHTML = 'Launching game..'
                try{
                    proc = pb.build()
                    launch_details_text.innerHTML = 'Done. Enjoy the server!'
                    const tempListener = function(data){
                        if(data.indexOf('[Client thread/INFO]: -- System Details --') > -1){
                            launch_details.style.display = 'none'
                            launch_content.style.display = 'inline-flex'
                            if(hasRPC){
                                DiscordWrapper.updateDetails('Loading game..')
                            }
                            proc.stdout.removeListener('data', tempListener)
                        }
                    }
                    const gameStateChange = function(data){
                        if(servJoined.test(data)){
                            DiscordWrapper.updateDetails('Exploring the Realm!')
                        } else if(gameJoined.test(data)){
                            DiscordWrapper.updateDetails('Idling on Main Menu')
                        }
                    }
                    proc.stdout.on('data', tempListener)
                    proc.stdout.on('data', gameStateChange)
                    // Init Discord Hook (Untested)
                    const distro = AssetGuard.retrieveDistributionDataSync(ConfigManager.getGameDirectory)
                    if(distro.discord != null && serv.discord != null){
                        DiscordWrapper.initRPC(distro.discord, serv.discord)
                        hasRPC = true
                        proc.on('close', (code, signal) => {
                            console.log('Shutting down Discord Rich Presence..')
                            DiscordWrapper.shutdownRPC()
                            hasRPC = false
                            proc = null
                        })
                    }
                } catch(err) {
                    //launch_details_text.innerHTML = 'Error: ' + err.message;
                    launch_details_text.innerHTML = 'Error: See log for details..';
                    console.log(err)
                    setTimeout(function(){
                        launch_details.style.display = 'none'
                        launch_content.style.display = 'inline-flex'
                    }, 5000)
                }
            }

            // Disconnect from AssetExec
            aEx.disconnect()

        }
    })

    launch_details_text.innerHTML = 'Loading server information..'
    currentProc = 'validateDistribution'
    aEx.send({task: 0, content: currentProc, argsArr: [ConfigManager.getSelectedServer()]})
}