/**
 * Script for landing.ejs
 */
// Requirements
const cp                      = require('child_process')
const {URL}                   = require('url')

// Internal Requirements
const {AssetGuard}            = require(path.join(__dirname, 'assets', 'js', 'assetguard.js'))
const AuthManager             = require(path.join(__dirname, 'assets', 'js', 'authmanager.js'))
const DiscordWrapper          = require(path.join(__dirname, 'assets', 'js', 'discordwrapper.js'))
const Mojang                  = require(path.join(__dirname, 'assets', 'js', 'mojang.js'))
const ProcessBuilder          = require(path.join(__dirname, 'assets', 'js', 'processbuilder.js'))
const ServerStatus            = require(path.join(__dirname, 'assets', 'js', 'serverstatus.js'))

// Launch Elements
const launch_content          = document.getElementById('launch_content')
const launch_details          = document.getElementById('launch_details')
const launch_progress         = document.getElementById('launch_progress')
const launch_progress_label   = document.getElementById('launch_progress_label')
const launch_details_text     = document.getElementById('launch_details_text')
const server_selection_button = document.getElementById('server_selection_button')

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

/**
 * Enable or disable the launch button.
 * 
 * @param {boolean} val True to enable, false to disable.
 */
function setLaunchEnabled(val){
    document.getElementById('launch_button').disabled = !val
}

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

// Bind selected server
function updateSelectedServer(serverName){
    if(serverName == null){
        serverName = 'No Server Selected'
    }
    server_selection_button.innerHTML = '\u2022 ' + serverName
}
updateSelectedServer(AssetGuard.getServerById(ConfigManager.getGameDirectory(), ConfigManager.getSelectedServer()).name)
server_selection_button.addEventListener('click', (e) => {
    e.target.blur()
    toggleServerSelection(true)
})

// Test menu transform.
function slide_(up){
    const lCUpper = document.querySelector('#landingContainer > #upper')
    const lCLLeft = document.querySelector('#landingContainer > #lower > #left')
    const lCLCenter = document.querySelector('#landingContainer > #lower > #center')
    const lCLRight = document.querySelector('#landingContainer > #lower > #right')
    const menuBtn = document.querySelector('#landingContainer > #lower > #center #content')

    if(up){
        lCUpper.style.top = '-200vh'
        lCLLeft.style.top = '-200vh'
        lCLCenter.style.top = '-200vh'
        lCLRight.style.top = '-200vh'
        menuBtn.style.top = '130vh'
        setTimeout(() => {
            lCLCenter.style.transition = 'none'
            menuBtn.style.transition = 'none'
        }, 2000)
    } else {
        lCLCenter.style.transition = null
        menuBtn.style.transition = null
        lCUpper.style.top = '0px'
        lCLLeft.style.top = '0px'
        lCLCenter.style.top = '0px'
        lCLRight.style.top = '0px'
        menuBtn.style.top = '10px'
    }
}

// Update Mojang Status Color
const refreshMojangStatuses = async function(){
    console.log('Refreshing Mojang Statuses..')
    let status = 'grey'
    try {
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
    } catch (err) {
        console.warn('Unable to refresh Mojang service status.')
        console.debug(err)
    }
    document.getElementById('mojang_status_icon').style.color = Mojang.statusToHex(status)
}

const refreshServerStatus = async function(fade = false){
    console.log('Refreshing Server Status')
    const serv = AssetGuard.getServerById(ConfigManager.getGameDirectory(), ConfigManager.getSelectedServer())

    let pLabel = 'SERVER'
    let pVal = 'OFFLINE'

    try {
        const serverURL = new URL('my://' + serv.server_ip)
        const servStat = await ServerStatus.getStatus(serverURL.hostname, serverURL.port)
        if(servStat.online){
            pLabel = 'PLAYERS'
            pVal = servStat.onlinePlayers + '/' + servStat.maxPlayers
        }

    } catch (err) {
        console.warn('Unable to refresh server status, assuming offline.')
        console.debug(err)
    }
    if(fade){
        $('#server_status_wrapper').fadeOut(250, () => {
            document.getElementById('landingPlayerLabel').innerHTML = pLabel
            document.getElementById('player_count').innerHTML = pVal
            $('#server_status_wrapper').fadeIn(500)
        })
    } else {
        document.getElementById('landingPlayerLabel').innerHTML = pLabel
        document.getElementById('player_count').innerHTML = pVal
    }
    
}

refreshMojangStatuses()
refreshServerStatus()

// Set refresh rate to once every 5 minutes.
let mojangStatusListener = setInterval(() => refreshMojangStatuses(true), 300000)
let serverStatusListener = setInterval(() => refreshServerStatus(true), 300000)

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

            if(m.result == null){
                // If the result is null, no valid Java installation was found.
                // Show this information to the user.
                setOverlayContent(
                    'No Compatible<br>Java Installation Found',
                    'In order to join WesterosCraft, you need a 64-bit installation of Java 8. Would you like us to install a copy? By installing, you accept <a href="http://www.oracle.com/technetwork/java/javase/terms/license/index.html">Oracle\'s license agreement</a>.',
                    'Install Java',
                    'Install Manually'
                )
                setOverlayHandler(() => {
                    setLaunchDetails('Preparing Java Download..')
                    sysAEx.send({task: 0, content: '_enqueueOracleJRE', argsArr: [ConfigManager.getLauncherDirectory()]})
                    toggleOverlay(false)
                })
                setDismissHandler(() => {
                    $('#overlayContent').fadeOut(250, () => {
                        //$('#overlayDismiss').toggle(false)
                        setOverlayContent(
                            'Don\'t Forget!<br>Java is Required',
                            'A valid x64 installation of Java 8 is required to launch. Downloads can be found on <a href="http://www.oracle.com/technetwork/java/javase/downloads/jre8-downloads-2133155.html">Oracle\'s website</a>. Once installed, you will be able to connect to the server.<br><br>Please refer to our <a href="http://westeroscraft.wikia.com/wiki/Troubleshooting_Guide">Troubleshooting Guide</a> if you have any difficulty.',
                            'I Understand',
                            'Go Back'
                        )
                        setOverlayHandler(() => {
                            toggleLaunchArea(false)
                            toggleOverlay(false)
                        })
                        setDismissHandler(() => {
                            toggleOverlay(false, true)
                            asyncSystemScan()
                        })
                        $('#overlayContent').fadeIn(250)
                    })
                })
                toggleOverlay(true, true)

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
                    'Unexpected Issue:<br>Java Download Failed',
                    'Unfortunately we\'ve encountered an issue while attempting to install Java. You will need to manually install a copy. Please check out our <a href="http://westeroscraft.wikia.com/wiki/Troubleshooting_Guide">Troubleshooting Guide</a> for more details and instructions.',
                    'I Understand'
                )
                setOverlayHandler(() => {
                    toggleOverlay(false)
                    toggleLaunchArea(false)
                })
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
                const authUser = ConfigManager.getSelectedAccount()
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