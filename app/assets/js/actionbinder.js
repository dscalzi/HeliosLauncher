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

                setLaunchDetails('Please wait..')
                toggleLaunchArea(true)
                setLaunchPercentage(0, 100)

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

/* Overlay Wrapper Functions */

/**
 * Toggle the visibility of the overlay.
 * 
 * @param {boolean} toggleState True to display, false to hide.
 */
function toggleOverlay(toggleState){
    if(toggleState == null){
        toggleState = !document.getElementById('main').hasAttribute('overlay')
    }
    if(toggleState){
        document.getElementById('main').setAttribute('overlay', true)
        $('#overlayContainer').fadeToggle(250)
    } else {
        document.getElementById('main').removeAttribute('overlay')
        $('#overlayContainer').fadeToggle(250)
    }
}

/**
 * Set the content of the overlay.
 * 
 * @param {string} title Overlay title text.
 * @param {string} description Overlay description text.
 * @param {string} acknowledge Acknowledge button text.
 */
function setOverlayContent(title, description, acknowledge){
    document.getElementById('overlayTitle').innerHTML = title
    document.getElementById('overlayDesc').innerHTML = description
    document.getElementById('overlayAcknowledge').innerHTML = acknowledge
}

/**
 * Set the onclick handler of the overlay acknowledge button.
 * If the handler is null, a default handler will be added.
 * 
 * @param {function} handler 
 */
function setOverlayHandler(handler){
    if(handler == null){
        document.getElementById('overlayAcknowledge').onclick = () => {
            toggleOverlay(false)
        }
    } else {
        document.getElementById('overlayAcknowledge').onclick = handler
    }
}

/* Launch Progress Wrapper Functions */

/**
 * Show/hide the loading area.
 * 
 * @param {boolean} loading True if the loading area should be shown, otherwise false.
 */
function toggleLaunchArea(loading){
    if(loading){
        launch_details.style.display = 'flex'
        launch_content.style.display = 'none'
    } else {
        launch_details.style.display = 'none'
        launch_content.style.display = 'inline-flex'
    }
}

/**
 * Set the details text of the loading area.
 * 
 * @param {string} details The new text for the loading details.
 */
function setLaunchDetails(details){
    launch_details_text.innerHTML = details
}

/**
 * Set the value of the loading progress bar and display that value.
 * 
 * @param {number} value The progress value.
 * @param {number} max The total size.
 * @param {number|string} percent Optional. The percentage to display on the progress label.
 */
function setLaunchPercentage(value, max, percent = ((value/max)*100)){
    launch_progress.setAttribute('max', max)
    launch_progress.setAttribute('value', value)
    launch_progress_label.innerHTML = percent + '%'
}

/**
 * Set the value of the OS progress bar and display that on the UI.
 * 
 * @param {number} value The progress value.
 * @param {number} max The total download size.
 * @param {number|string} percent Optional. The percentage to display on the progress label.
 */
function setDownloadPercentage(value, max, percent = ((value/max)*100)){
    remote.getCurrentWindow().setProgressBar(value/max)
    setLaunchPercentage(value, max, percent)
}

/* System (Java) Scan */

let sysAEx
let scanAt

function asyncSystemScan(launchAfter = true){

    setLaunchDetails('Please wait..')
    toggleLaunchArea(true)
    setLaunchPercentage(0, 100)

    // Fork a process to run validations.
    sysAEx = cp.fork(path.join(__dirname, 'assets', 'js', 'assetexec.js'), [
        ConfigManager.getGameDirectory(),
        ConfigManager.getJavaExecutable()
    ])
    
    sysAEx.on('message', (m) => {
        if(m.content === 'validateJava'){

            //m.result = null

            if(m.result == null){
                // If the result is null, no valid Java installation was found.
                // Show this information to the user.
                setOverlayContent(
                    'No Compatible<br>Java Installation Found..',
                    'In order to join WesterosCraft, you need a 64-bit installation of Java 8. Would you like us to install a copy? By installing, you accept <a href="http://www.oracle.com/technetwork/java/javase/terms/license/index.html">Oracle\'s license agreement</a>.',
                    'Install Java'
                )
                setOverlayHandler(() => {
                    setLaunchDetails('Preparing Java Download..')
                    sysAEx.send({task: 0, content: '_enqueueOracleJRE', argsArr: [ConfigManager.getLauncherDirectory()]})
                    toggleOverlay(false)
                })
                toggleOverlay(true)

                // TODO Add option to not install Java x64.

            } else {
                // Java installation found, use this to launch the game.
                ConfigManager.setJavaExecutable(m.result)
                ConfigManager.save()
                if(launchAfter){
                    dlAsync()
                }
                sysAEx.disconnect()
            }

        } else if(m.content === '_enqueueOracleJRE'){

            if(m.result === true){

                // Oracle JRE enqueued successfully, begin download.
                setLaunchDetails('Downloading Java..')
                sysAEx.send({task: 0, content: 'processDlQueues', argsArr: [[{id:'java', limit:1}]]})

            } else {

                // Oracle JRE enqueue failed. Probably due to a change in their website format.
                // User will have to follow the guide to install Java.
                setOverlayContent(
                    'Yikes!<br>Java download failed.',
                    'Unfortunately we\'ve encountered an issue while attempting to install Java. You will need to install a copy yourself. Please check out <a href="http://westeroscraft.wikia.com/wiki/Troubleshooting_Guide">this guide</a> for more details and instructions.',
                    'Got it'
                )
                setOverlayHandler(null)
                toggleOverlay(true)
                sysAEx.disconnect()

            }

        } else if(m.content === 'dl'){

            if(m.task === 0){
                // Downloading..
                setDownloadPercentage(m.value, m.total, m.percent)
            } else if(m.task === 1){
                // Download will be at 100%, remove the loading from the OS progress bar.
                remote.getCurrentWindow().setProgressBar(-1)

                // Wait for extration to complete.
                setLaunchDetails('Extracting..')

            } else if(m.task === 2){

                // Extraction completed successfully.
                ConfigManager.setJavaExecutable(m.jPath)
                ConfigManager.save()

                setLaunchDetails('Java Installed!')

                if(launchAfter){
                    dlAsync()
                }

                sysAEx.disconnect()
            } else {
                console.error('Unknown download data type.', m)
            }
        }
    })

    // Begin system Java scan.
    setLaunchDetails('Checking system info..')
    sysAEx.send({task: 0, content: 'validateJava', argsArr: [ConfigManager.getLauncherDirectory()]})

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

            // Asset validation can *potentially* take longer, so let's track progress.
            if(m.task === 0){
                const perc = (m.value/m.total)*20
                setLaunchPercentage(40+perc, 100, parseInt(40+perc))
            } else {
                setLaunchPercentage(60, 100)
                console.log('Asset Validation Complete')

                // Begin library validation.
                setLaunchDetails('Validating library integrity..')
                aEx.send({task: 0, content: 'validateLibraries', argsArr: [versionData]})
            }

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