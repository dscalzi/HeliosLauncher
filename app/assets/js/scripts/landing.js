/**
 * Script for landing.ejs
 */
// Requirements
const cp                      = require('child_process')
const {URL}                   = require('url')

// Internal Requirements
const DiscordWrapper          = require('./assets/js/discordwrapper.js')
const Mojang                  = require('./assets/js/mojang.js')
const ProcessBuilder          = require('./assets/js/processbuilder.js')
const ServerStatus            = require('./assets/js/serverstatus.js')

// Launch Elements
const launch_content          = document.getElementById('launch_content')
const launch_details          = document.getElementById('launch_details')
const launch_progress         = document.getElementById('launch_progress')
const launch_progress_label   = document.getElementById('launch_progress_label')
const launch_details_text     = document.getElementById('launch_details_text')
const server_selection_button = document.getElementById('server_selection_button')
const user_text               = document.getElementById('user_text')

// News Elements
const newsContent             = document.getElementById('newsContent')
const newsArticleTitle        = document.getElementById('newsArticleTitle')
const newsArticleDate         = document.getElementById('newsArticleDate')
const newsArticleAuthor       = document.getElementById('newsArticleAuthor')
const newsArticleComments     = document.getElementById('newsArticleComments')
const newsNavigationStatus    = document.getElementById('newsNavigationStatus')
const newsArticleContent      = document.getElementById('newsArticleContentScrollable')
const newsErrorContainer      = document.getElementById('newsErrorContainer')
const nELoadSpan              = document.getElementById('nELoadSpan')

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

// Bind selected account
function updateSelectedAccount(authUser){
    let username = 'No Account Selected'
    if(authUser != null && authUser.username != null){
        username = authUser.displayName
    }
    user_text.innerHTML = username
}
updateSelectedAccount(ConfigManager.getSelectedAccount())

// Bind selected server
function updateSelectedServer(serverName){
    if(serverName == null){
        serverName = 'No Server Selected'
    }
    server_selection_button.innerHTML = '\u2022 ' + serverName
}
// Real text is set in uibinder.js on distributionIndexDone.
updateSelectedServer('Loading..')
server_selection_button.addEventListener('click', (e) => {
    e.target.blur()
    toggleServerSelection(true)
})

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
    const serv = AssetGuard.getServerById(ConfigManager.getSelectedServer())

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
// Server Status is refreshed in uibinder.js on distributionIndexDone.

// Set refresh rate to once every 5 minutes.
let mojangStatusListener = setInterval(() => refreshMojangStatuses(true), 300000)
let serverStatusListener = setInterval(() => refreshServerStatus(true), 300000)

/* System (Java) Scan */

let sysAEx
let scanAt

let extractListener

function asyncSystemScan(launchAfter = true){

    setLaunchDetails('Please wait..')
    toggleLaunchArea(true)
    setLaunchPercentage(0, 100)

    // Fork a process to run validations.
    sysAEx = cp.fork(path.join(__dirname, 'assets', 'js', 'assetexec.js'), [
        ConfigManager.getGameDirectory(),
        ConfigManager.getLauncherDirectory(),
        ConfigManager.getJavaExecutable()
    ], {
        stdio: 'pipe'
    })
    // Stdout
    sysAEx.stdio[1].on('data', (data) => {
        console.log('%c[SysAEx]', 'color: #353232; font-weight: bold', data.toString('utf-8'))
    })
    // Stderr
    sysAEx.stdio[2].on('data', (data) => {
        console.log('%c[SysAEx]', 'color: #353232; font-weight: bold', data.toString('utf-8'))
    })
    
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
                const eLStr = 'Extracting'
                let dotStr = ''
                setLaunchDetails(eLStr)
                extractListener = setInterval(() => {
                    if(dotStr.length >= 3){
                        dotStr = ''
                    } else {
                        dotStr += '.'
                    }
                    setLaunchDetails(eLStr + dotStr)
                }, 750)

            } else if(m.task === 2){

                // Extraction completed successfully.
                ConfigManager.setJavaExecutable(m.jPath)
                ConfigManager.save()

                if(extractListener != null){
                    clearInterval(extractListener)
                    extractListener = null
                }

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

let progressListener

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
        ConfigManager.getLauncherDirectory(),
        ConfigManager.getJavaExecutable()
    ], {
        stdio: 'pipe'
    })
    // Stdout
    aEx.stdio[1].on('data', (data) => {
        console.log('%c[AEx]', 'color: #353232; font-weight: bold', data.toString('utf-8'))
    })
    // Stderr
    aEx.stdio[2].on('data', (data) => {
        console.log('%c[AEx]', 'color: #353232; font-weight: bold', data.toString('utf-8'))
    })

    // Establish communications between the AssetExec and current process.
    aEx.on('message', (m) => {
        if(m.content === 'validateDistribution'){

            setLaunchPercentage(20, 100)
            serv = m.result
            console.log('Validated distibution index.')

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

            } else if(m.task === 0.7){
                
                // Download done, extracting.
                const eLStr = 'Extracting libraries'
                let dotStr = ''
                setLaunchDetails(eLStr)
                progressListener = setInterval(() => {
                    if(dotStr.length >= 3){
                        dotStr = ''
                    } else {
                        dotStr += '.'
                    }
                    setLaunchDetails(eLStr + dotStr)
                }, 750)

            } else if(m.task === 0.9) {

                console.error(m.err)
                
                if(m.err.code === 'ENOENT'){
                    setOverlayContent(
                        'Download Error',
                        'Could not connect to the file server. Ensure that you are connected to the internet and try again.',
                        'Okay'
                    )
                    setOverlayHandler(null)
                } else {
                    setOverlayContent(
                        'Download Error',
                        'Check the console for more details. Please try again.',
                        'Okay'
                    )
                    setOverlayHandler(null)
                }

                toggleOverlay(true)
                toggleLaunchArea(false)

                // Disconnect from AssetExec
                aEx.disconnect()

            } else if(m.task === 1){

                // Download will be at 100%, remove the loading from the OS progress bar.
                remote.getCurrentWindow().setProgressBar(-1)
                if(progressListener != null){
                    clearInterval(progressListener)
                    progressListener = null
                }

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
                    const distro = AssetGuard.getDistributionData()
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

                    console.error('Error during launch', err)
                    setOverlayContent(
                        'Error During Launch',
                        'Please check the console for more details.',
                        'Okay'
                    )
                    setOverlayHandler(null)
                    toggleOverlay(true)
                    toggleLaunchArea(false)

                }
            }

            // Disconnect from AssetExec
            aEx.disconnect()

        }
    })

    // Begin Validations

    // Validate Forge files.
    setLaunchDetails('Loading server information..')

    if(AssetGuard.isLocalLaunch()){

        refreshDistributionIndex(false, (data) => {
            onDistroRefresh(data)
            aEx.send({task: 0, content: 'validateDistribution', argsArr: [ConfigManager.getSelectedServer()]})
        }, (err) => {
            console.error('Unable to refresh distribution index.', err)
            if(AssetGuard.getDistributionData() == null){
                setOverlayContent(
                    'Fatal Error',
                    'Could not load a copy of the distribution index. See the console for more details.',
                    'Okay'
                )
                setOverlayHandler(null)

                toggleOverlay(true)
                toggleLaunchArea(false)

                // Disconnect from AssetExec
                aEx.disconnect()
            } else {
                aEx.send({task: 0, content: 'validateDistribution', argsArr: [ConfigManager.getSelectedServer()]})
            }
        })

    } else {

        refreshDistributionIndex(true, (data) => {
            onDistroRefresh(data)
            aEx.send({task: 0, content: 'validateDistribution', argsArr: [ConfigManager.getSelectedServer()]})
        }, (err) => {
            refreshDistributionIndex(false, (data) => {
                onDistroRefresh(data)
            }, (err) => {
                console.error('Unable to refresh distribution index.', err)
                if(AssetGuard.getDistributionData() == null){
                    setOverlayContent(
                        'Fatal Error',
                        'Could not load a copy of the distribution index. See the console for more details.',
                        'Okay'
                    )
                    setOverlayHandler(null)
    
                    toggleOverlay(true)
                    toggleLaunchArea(false)
    
                    // Disconnect from AssetExec
                    aEx.disconnect()
                } else {
                    aEx.send({task: 0, content: 'validateDistribution', argsArr: [ConfigManager.getSelectedServer()]})
                }
            })
        })

    }
}

/**
 * News Loading Functions
 */

// News slide caches.
let newsActive = false
let newsGlideCount = 0

/**
 * Show the news UI via a slide animation.
 * 
 * @param {boolean} up True to slide up, otherwise false. 
 */
function slide_(up){
    const lCUpper = document.querySelector('#landingContainer > #upper')
    const lCLLeft = document.querySelector('#landingContainer > #lower > #left')
    const lCLCenter = document.querySelector('#landingContainer > #lower > #center')
    const lCLRight = document.querySelector('#landingContainer > #lower > #right')
    const newsBtn = document.querySelector('#landingContainer > #lower > #center #content')
    const landingContainer = document.getElementById('landingContainer')
    const newsContainer = document.querySelector('#landingContainer > #newsContainer')

    newsGlideCount++

    if(up){
        lCUpper.style.top = '-200vh'
        lCLLeft.style.top = '-200vh'
        lCLCenter.style.top = '-200vh'
        lCLRight.style.top = '-200vh'
        newsBtn.style.top = '130vh'
        newsContainer.style.top = '0px'
        //date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'})
        //landingContainer.style.background = 'rgba(29, 29, 29, 0.55)'
        landingContainer.style.background = 'rgba(0, 0, 0, 0.50)'
        setTimeout(() => {
            if(newsGlideCount === 1){
                lCLCenter.style.transition = 'none'
                newsBtn.style.transition = 'none'
            }
            newsGlideCount--
        }, 2000)
    } else {
        setTimeout(() => {
            newsGlideCount--
        }, 2000)
        landingContainer.style.background = null
        lCLCenter.style.transition = null
        newsBtn.style.transition = null
        newsContainer.style.top = '100%'
        lCUpper.style.top = '0px'
        lCLLeft.style.top = '0px'
        lCLCenter.style.top = '0px'
        lCLRight.style.top = '0px'
        newsBtn.style.top = '10px'
    }
}

// Bind news button.
document.getElementById('newsButton').onclick = () => {
    slide_(!newsActive)
    newsActive = !newsActive
}

// Array to store article meta.
let newsArr = null

// News load animation listener.
let newsLoadingListener = null

/**
 * Set the news loading animation.
 * 
 * @param {boolean} val True to set loading animation, otherwise false.
 */
function setNewsLoading(val){
    if(val){
        const nLStr = 'Checking for News'
        let dotStr = '..'
        nELoadSpan.innerHTML = nLStr + dotStr
        newsLoadingListener = setInterval(() => {
            if(dotStr.length >= 3){
                dotStr = ''
            } else {
                dotStr += '.'
            }
            nELoadSpan.innerHTML = nLStr + dotStr
        }, 750)
    } else {
        if(newsLoadingListener != null){
            clearInterval(newsLoadingListener)
            newsLoadingListener = null
        }
    }
}

// Bind retry button.
newsErrorRetry.onclick = () => {
    $('#newsErrorFailed').fadeOut(250, () => {
        initNews()
        $('#newsErrorLoading').fadeIn(250)
    })
}

/**
 * Reload the news without restarting.
 */
async function reloadNews(){
    $('#newsContent').fadeOut(250, () => {
        $('#newsErrorLoading').fadeIn(250)
    })
    await initNews()
}

/**
 * Initialize News UI. This will load the news and prepare
 * the UI accordingly.
 */
async function initNews(){
    setNewsLoading(true)

    let news = {}

    try {
        news = await loadNews()
    } catch (err) {
        // Empty
    }

    newsArr = news.articles || null

    if(newsArr == null){
        // News Loading Failed
        setNewsLoading(false)

        $('#newsErrorLoading').fadeOut(250, () => {
            $('#newsErrorFailed').fadeIn(250)
        })
    } else if(newsArr.length === 0) {
        // No News Articles
        setNewsLoading(false)

        $('#newsErrorLoading').fadeOut(250, () => {
            $('#newsErrorNone').fadeIn(250)
        })
    } else {
        // Success
        setNewsLoading(false)

        $('#newsErrorContainer').fadeOut(250, () => {
            displayArticle(newsArr[0], 1)
            $('#newsContent').fadeIn(250)
        })

        const switchHandler = (forward) => {
            let cArt = parseInt(newsContent.getAttribute('article'))
            let nxtArt = forward ? (cArt >= newsArr.length-1 ? 0 : cArt + 1) : (cArt <= 0 ? newsArr.length-1 : cArt - 1)
    
            displayArticle(newsArr[nxtArt], nxtArt+1)
        }
    
        document.getElementById('newsNavigateRight').onclick = () => { switchHandler(true) }
        document.getElementById('newsNavigateLeft').onclick = () => { switchHandler(false) }
    }
}

/**
 * Display a news article on the UI.
 * 
 * @param {Object} articleObject The article meta object.
 * @param {number} index The article index.
 */
function displayArticle(articleObject, index){
    newsArticleTitle.innerHTML = articleObject.title
    newsArticleTitle.href = articleObject.link
    newsArticleAuthor.innerHTML = 'by ' + articleObject.author
    newsArticleDate.innerHTML = articleObject.date
    newsArticleComments.innerHTML = articleObject.comments
    newsArticleComments.href = articleObject.commentsLink
    newsArticleContent.innerHTML = articleObject.content
    newsNavigationStatus.innerHTML = index + ' of ' + newsArr.length
    newsContent.setAttribute('article', index-1)
}

/**
 * Load news information from the RSS feed specified in the
 * distribution index.
 */
function loadNews(){
    return new Promise((resolve, reject) => {
        const distroData = AssetGuard.getDistributionData()
        const newsFeed = distroData['news_feed']
        const newsHost = new URL(newsFeed).origin + '/'
        $.get(newsFeed, (data) => {
            const items = $(data).find('item')
            const articles = []

            for(let i=0; i<items.length; i++){
                // JQuery Element
                const el = $(items[i])

                // Resolve date.
                const date = new Date(el.find('pubDate').text()).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'})

                // Resolve comments.
                let comments = el.find('slash\\:comments').text() || '0'
                comments = comments + ' Comment' + (comments === '1' ? '' : 's')

                // Fix relative links in content.
                let content = el.find('content\\:encoded').text()
                let regex = /src="(?!http:\/\/|https:\/\/)(.+)"/g
                let matches
                while(matches = regex.exec(content)){
                    content = content.replace(matches[1], newsHost + matches[1])
                }

                let link   = el.find('link').text()
                let title  = el.find('title').text()
                let author = el.find('dc\\:creator').text()

                // Generate article.
                articles.push(
                    {
                        link,
                        title,
                        date,
                        author,
                        content,
                        comments,
                        commentsLink: link + '#comments'
                    }
                )
            }
            resolve({
                articles
            })
        }).catch(err => {
            reject(err)
        })
    })
}