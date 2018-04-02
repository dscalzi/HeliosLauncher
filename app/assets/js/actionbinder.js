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
            const jExe = ConfigManager.getJavaExecutable()
            if(jExe == null){
                asyncSystemScan()
            } else {
                AssetGuard._validateJavaBinary(jExe).then((v) => {
                    if(v){
                        dlAsync()
                    } else {
                        asyncSystemScan()
                    }
                })
            }
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

/* Launch Progress Wrapper Functions */

function toggleLaunchArea(loading){
    if(loading){
        launch_details.style.display = 'flex'
        launch_content.style.display = 'none'
    } else {
        launch_details.style.display = 'none'
        launch_content.style.display = 'inline-flex'
    }
}

function setLaunchDetails(details){
    launch_details_text.innerHTML = details
}

function setLaunchPercentage(value, max, percent = ((value/max)*100)){
    launch_progress.setAttribute('max', max)
    launch_progress.setAttribute('value', value)
    launch_progress_label.innerHTML = percent + '%'
}

function setDownloadPercentage(value, max, percent = ((value/max)*100)){
    remote.getCurrentWindow().setProgressBar(value/max)
    setLaunchPercentage(value, max, percent)
}

let sysAEx
let scanAt

function asyncSystemScan(){

    setLaunchDetails('Please wait..')
    toggleLaunchArea(true)
    setLaunchPercentage(0, 100)

    sysAEx = cp.fork(path.join(__dirname, 'assets', 'js', 'assetexec.js'), [
        ConfigManager.getGameDirectory(),
        ConfigManager.getJavaExecutable()
    ])
    
    sysAEx.on('message', (m) => {
        if(m.content === 'validateJava'){
            jPath = m.result
            console.log(m.result)
            sysAEx.disconnect()
        }
    })

    setLaunchDetails('Checking system info..')
    sysAEx.send({task: 0, content: 'validateJava', argsArr: [ConfigManager.getLauncherDirectory()]})

}

function overlayError(){

}

// Keep reference to Minecraft Process
let proc
// Is DiscordRPC enabled
let hasRPC = false
// Joined server regex
const servJoined = /[[0-2][0-9]:[0-6][0-9]:[0-6][0-9]\] \[Client thread\/INFO\]: \[CHAT\] [a-zA-Z0-9_]{1,16} joined the game/g
const gameJoined = /\[[0-2][0-9]:[0-6][0-9]:[0-6][0-9]\] \[Client thread\/WARN\]: Skipping bad option: lastServer:/g
const gameJoined2 = /\[[0-2][0-9]:[0-6][0-9]:[0-6][0-9]\] \[Client thread\/INFO\]: Created: \d+x\d+ textures-atlas/g

let aEx
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

    setLaunchDetails('Please wait..')
    toggleLaunchArea(true)
    setLaunchPercentage(0, 100)

    // Start AssetExec to run validations and downloads in a forked process.
    aEx = cp.fork(path.join(__dirname, 'assets', 'js', 'assetexec.js'), [
        ConfigManager.getGameDirectory(),
        ConfigManager.getJavaExecutable()
    ])

    // Establish communications between the AssetExec and current process.
    aEx.on('message', (m) => {
        if(m.content === 'validateDistribution'){

            setLaunchPercentage(20, 100)
            serv = m.result
            console.log('Forge Validation Complete.')

            // Begin version load.
            setLaunchDetails('Loading version information..')
            aEx.send({task: 0, content: 'loadVersionData', argsArr: [serv.mc_version]})

        } else if(m.content === 'loadVersionData'){

            setLaunchPercentage(40, 100)
            versionData = m.result
            console.log('Version data loaded.')

            // Begin asset validation.
            setLaunchDetails('Validating asset integrity..')
            aEx.send({task: 0, content: 'validateAssets', argsArr: [versionData]})

        } else if(m.content === 'validateAssets'){

            setLaunchPercentage(60, 100)
            console.log('Asset Validation Complete')

            // Begin library validation.
            setLaunchDetails('Validating library integrity..')
            aEx.send({task: 0, content: 'validateLibraries', argsArr: [versionData]})

        } else if(m.content === 'validateLibraries'){

            setLaunchPercentage(80, 100)
            console.log('Library validation complete.')

            // Begin miscellaneous validation.
            setLaunchDetails('Validating miscellaneous file integrity..')
            aEx.send({task: 0, content: 'validateMiscellaneous', argsArr: [versionData]})

        } else if(m.content === 'validateMiscellaneous'){

            setLaunchPercentage(100, 100)
            console.log('File validation complete.')

            // Download queued files.
            setLaunchDetails('Downloading files..')
            aEx.send({task: 0, content: 'processDlQueues'})

        } else if(m.content === 'dl'){

            if(m.task === 0){

                setDownloadPercentage(m.value, m.total, m.percent)

            } else if(m.task === 1){

                // Download will be at 100%, remove the loading from the OS progress bar.
                remote.getCurrentWindow().setProgressBar(-1)

                setLaunchDetails('Preparing to launch..')
                aEx.send({task: 0, content: 'loadForgeData', argsArr: [serv.id]})

            } else {

                console.error('Unknown download data type.', m)

            }

        } else if(m.content === 'loadForgeData'){

            forgeData = m.result

            if(login) {
                //if(!(await AuthManager.validateSelected())){
                    // 
                //}
                const authUser = ConfigManager.getSelectedAccount();
                console.log('authu', authUser)
                let pb = new ProcessBuilder(ConfigManager.getGameDirectory(), serv, versionData, forgeData, authUser)
                setLaunchDetails('Launching game..')
                try {
                    // Build Minecraft process.
                    proc = pb.build()
                    setLaunchDetails('Done. Enjoy the server!')

                    // Attach a temporary listener to the client output.
                    // Will wait for a certain bit of text meaning that
                    // the client application has started, and we can hide
                    // the progress bar stuff.
                    const tempListener = function(data){
                        if(data.indexOf('[Client thread/INFO]: -- System Details --') > -1){
                            toggleLaunchArea(false)
                            if(hasRPC){
                                DiscordWrapper.updateDetails('Loading game..')
                            }
                            proc.stdout.removeListener('data', tempListener)
                        }
                    }

                    // Listener for Discord RPC.
                    const gameStateChange = function(data){
                        if(servJoined.test(data)){
                            DiscordWrapper.updateDetails('Exploring the Realm!')
                        } else if(gameJoined.test(data)){
                            DiscordWrapper.updateDetails('Idling on Main Menu')
                        }
                    }

                    // Bind listeners to stdout.
                    proc.stdout.on('data', tempListener)
                    proc.stdout.on('data', gameStateChange)

                    // Init Discord Hook
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

                    // Show that there was an error then hide the
                    // progress area. Maybe switch this to an error
                    // alert in the future. TODO
                    setLaunchDetails('Error: See log for details..')
                    console.log(err)
                    setTimeout(function(){
                        toggleLaunchArea(false)
                    }, 5000)

                }
            }

            // Disconnect from AssetExec
            aEx.disconnect()

        }
    })

    // Begin Validations

    // Validate Forge files.
    setLaunchDetails('Loading server information..')
    aEx.send({task: 0, content: 'validateDistribution', argsArr: [ConfigManager.getSelectedServer()]})
}