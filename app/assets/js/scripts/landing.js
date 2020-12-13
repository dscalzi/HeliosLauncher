/**
 * Script for landing.ejs
 */
// Requirements
const cp                      = require('child_process')
const {URL}                   = require('url')
const _bg                     = false

// Internal Requirements
const Mojang                  = require('./assets/js/mojang')
const ServerStatus            = require('./assets/js/serverstatus')
const child_process           = require('child_process')
// Launch Elements
const launch_content          = document.getElementById('launch_content')
const launch_details          = document.getElementById('launch_details')
const launch_progress         = document.getElementById('launch_progress')
const launch_progress_label   = document.getElementById('launch_progress_label')
const launch_details_text     = document.getElementById('launch_details_text')
const user_text               = document.getElementById('user_text')
const loggerLanding = LoggerUtil('%c[Landing]', 'color: #000668; font-weight: bold')

/* Launch Progress Wrapper Functions */
document.getElementById('launch_button').addEventListener('click', function(e){
    loggerLanding.log('Launching game..')
    const jExe = ConfigManager.getJavaExecutable()
    if(jExe == null){
        asyncSystemScan("1.8.9")
    } else {

        toggleLaunchArea(true)
        setLaunchPercentage(0, 100)

        const jg = new JavaGuard("1.8.9")
        jg._validateJavaBinary(jExe).then((v) => {
            loggerLanding.log('Java version meta', v)
            if(v.valid){
                dlAsync()
            } else {
                asyncSystemScan("1.8.9")
            }
        })
    }
})

/**
 * Show/hide the loading area.
 * 
 * @param {boolean} loading True if the loading area should be shown, otherwise false.
 */
function toggleLaunchArea(loading){
    if(loading){ 
        $("#launch_content").animate({
            width: 0
        },100,"swing",function(){launch_content.style.display = 'none';}) 
        launch_details.style.display = 'inline-flex'
        $("#launch_details").animate({
            width: "240px"
        },120,"linear");
        
        
        
    } else {
        $("#launch_details").animate({
            width: 0
        },100,"swing",function(){launch_details.style.display = 'none';}) 
        launch_content.style.display = 'inline-flex'
        $("#launch_content").animate({
            width: "240px"
        },120,"linear");
    }
}

function updateSelectedAccount(authUser){
    let username = 'No Account Selected'
    if(authUser != null){
        if(authUser.displayName != null){
            username = authUser.displayName
        }
        if(authUser.uuid != null){
            document.getElementById('avatarContainer').style.backgroundImage = `url('https://minotar.net/helm/${authUser.displayName}')`
        }
    }
    user_text.innerHTML = username
}

function setLaunchDetails(details){
    launch_details_text.innerHTML = details
}

function setLaunchPercentage(value, max, percent = ((value/max)*100)){
    launch_progress.setAttribute('max', max)
    launch_progress.setAttribute('value', value)
    launch_progress_label.innerHTML = percent + '%'
}

updateSelectedAccount(ConfigManager.getSelectedAccount())

/**
 * Set the value of the loading progress bar and display that value.
 * 
 * @param {number} value The progress value.
 * @param {number} max The total size.
 * @param {number|string} percent Optional. The percentage to display on the progress label.
 */
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

// Bind settings button
document.getElementById('settingsMediaButton').onclick = (e) => {
    prepareSettings()
    switchView(getCurrentView(), VIEWS.settings)
}

// Bind avatar overlay button.
document.getElementById('avatarOverlay').onclick = (e) => {
    prepareSettings()
    switchView(getCurrentView(), VIEWS.settings, 500, 500, () => {
        settingsNavItemListener(document.getElementById('settingsNavAccount'), false)
    })
}
document.getElementById('signout').onclick = (e) => {
    const SelAcc = ConfigManager.getSelectedAccount().uuid
    AuthManager.removeAccount(SelAcc.uuid)
    
}


// Update Mojang Status Color
const refreshMojangStatuses = async function(){
    loggerLanding.log('Mojang Durumu Yenileniyor..')

    let status = 'grey'
    let tooltipEssentialHTML = ''
    let tooltipNonEssentialHTML = ''

    try {
        const statuses = await Mojang.status()
        greenCount = 0
        greyCount = 0

        for(let i=0; i<statuses.length; i++){
            const service = statuses[i]


            if(service.service === 'sessionserver.mojang.com' || service.service === 'minecraft.net') {
                service.status = 'green'
            }

            if(service.essential){
                tooltipEssentialHTML += `<div class="mojangStatusContainer">
                    <span class="mojangStatusIcon" style="color: ${Mojang.statusToHex(service.status)};">&#8226;</span>
                    <span class="mojangStatusName">${service.name}</span>
                </div>`
            } else {
                tooltipNonEssentialHTML += `<div class="mojangStatusContainer">
                    <span class="mojangStatusIcon" style="color: ${Mojang.statusToHex(service.status)};">&#8226;</span>
                    <span class="mojangStatusName">${service.name}</span>
                </div>`
            }

            if(service.status === 'yellow' && status !== 'red'){
                status = 'yellow'
            } else if(service.status === 'red'){
                status = 'red'
            } else {
                if(service.status === 'grey'){
                    ++greyCount
                }
                ++greenCount
            }

        }

        if(greenCount === statuses.length){
            if(greyCount === statuses.length){
                status = 'grey'
            } else {
                status = 'green'
            }
        }

    } catch (err) {
        loggerLanding.warn('Mojang Servis Durumu Yenilenemiyor.')
        loggerLanding.debug(err)
    }
    
    document.getElementById('mojangStatusEssentialContainer').innerHTML = tooltipEssentialHTML
    document.getElementById('mojangStatusNonEssentialContainer').innerHTML = tooltipNonEssentialHTML
    document.getElementById('mojang_status_icon').style.color = Mojang.statusToHex(status)
}

const refreshServerStatus = async function(fade = false){
    loggerLanding.log('Sunucu Durumu Yenileniyor')
    const serv = DistroManager.getDistribution().getServer(ConfigManager.getSelectedServer())

    let pLabel = 'SUNUCU'
    let pVal = 'OFFLINE'

    try {
        const serverURL = new URL('my://' + serv.getAddress())
        const servStat = await ServerStatus.getStatus(serverURL.hostname, serverURL.port)
        if(servStat.online){
            pLabel = 'SUNUCU'
            pVal = servStat.onlinePlayers + '/' + servStat.maxPlayers
        }

    } catch (err) {
        loggerLanding.warn('Sunucu durumu yenilenemiyor, çevrim dışı varsayıldı.')
        loggerLanding.debug(err)
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
let serverStatusListener = setInterval(() => refreshServerStatus(), 5000)

/**
 * Shows an error overlay, toggles off the launch area.
 * 
 * @param {string} title The overlay title.
 * @param {string} desc The overlay description.
 */
function showLaunchFailure(title, desc){
    setOverlayContent(
        title,
        desc,
        'Tamam'
    )
    setOverlayHandler(null)
    toggleOverlay(true)
    toggleLaunchArea(false)
}

/* System (Java) Scan */

let sysAEx
let scanAt
let executed = false;
let extractListener

/**
 * Asynchronously scan the system for valid Java installations.
 * 
 * @param {string} mcVersion The Minecraft version we are scanning for.
 * @param {boolean} launchAfter Whether we should begin to launch after scanning. 
 */
function asyncSystemScan(mcVersion, launchAfter = true){

    toggleLaunchArea(true)

    const loggerSysAEx = LoggerUtil('%c[SysAEx]', 'color: #353232; font-weight: bold')

    const forkEnv = JSON.parse(JSON.stringify(process.env))
    forkEnv.CONFIG_DIRECT_PATH = ConfigManager.getLauncherDirectory()

    // Fork a process to run validations.
    sysAEx = cp.fork(path.join(__dirname, 'assets', 'js', 'assetexec.js'), [
        'JavaGuard',
        mcVersion
    ], {
        env: forkEnv,
        stdio: 'pipe'
    })
    // Stdout
    sysAEx.stdio[1].setEncoding('utf8')
    sysAEx.stdio[1].on('data', (data) => {
        loggerSysAEx.log(data)
    })
    // Stderr
    sysAEx.stdio[2].setEncoding('utf8')
    sysAEx.stdio[2].on('data', (data) => {
        loggerSysAEx.log(data)
    })
    
    sysAEx.on('message', (m) => {

        if(m.context === 'validateJava'){
            if(m.result == null){
                // If the result is null, no valid Java installation was found.
                // Show this information to the user.
                if (process.arch=="x64"){
                    setOverlayContent(
                        'Uyumlu Değil<br>Java Kurulumu Bulundu',
                        'Bir değişle '+ConfigManager.getLD().Server.Name+'\'a giriş yapmak için, Java 8\'in x64 kurulumunu yüklemelisiniz. Senin için yüklememizi ister miydin? İndirirek, <a href="http://www.oracle.com/technetwork/java/javase/terms/license/index.html">Oracle\'nin lisans anlaşması</a>\'nı kabul etmiş olursun.',
                        'Java\'yı Yükle',
                        'Kendim Yükleyeceğim'
                    )
                    setOverlayHandler(() => {
                        setLaunchDetails('Java indirmeye hazırlanılıyor..')
                        sysAEx.send({task: 'changeContext', class: 'AssetGuard', args: [ConfigManager.getCommonDirectory(),ConfigManager.getJavaExecutable()]})
                        sysAEx.send({task: 'execute', function: '_enqueueOpenJDK', argsArr: [ConfigManager.getDataDirectory()]})
                        toggleOverlay(false)
                    })
                    setDismissHandler(() => {
                        $('#overlayContent').fadeOut(250, () => {
                            //$('#overlayDismiss').toggle(false)
                            setOverlayContent(
                                'Başlatmak için<br>Java Gerekiyor!',
                                'Başlatmak için Java 8\'in geçerli x64 kurulumu gerekiyor.<br><br>Lütfen Java indirmek için <a href="https://www.java.com/tr/download/">Java\'nın resmi site</a>sine gidiniz.',
                                'Anladım',
                                'Geri Dön'
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

                }
                else{
                    something = (function() {
                        console.log(executed,"0")
                        return function() {
                            console.log(executed,"1")
                            if (!executed) {
                                setOverlayContent(
                                    'Java Olmayabilir!<br>Java Kurulumu Bulunamadı',
                                    'Bir değişle '+ConfigManager.getLD().Server.Name+'\'a giriş yapmak için, Java 8\'in x32 kurulmunu yüklemelisiniz. Java\'nın resmi sayfasına gitmek için <a href="https://www.java.com/tr/download/">buraya</a> tıklayınız. Eğer zaten yüklüyse anladım diyerek devam edebilirsiniz. ',
                                    'Tamam',
                                    '.'
                                )
                                    
                                setOverlayHandler(() => {
                                    toggleOverlay(false)
                                    toggleLaunchArea(true)
                                    dlAsync();sysAEx.disconnect()
                                })
                                setDismissHandler(() => {
                                    console.log("a0",executed)
                                    executed = true
                                    console.log("a1",executed)
                                    toggleLaunchArea(true)
                                    console.log("a2",executed)
                                    dlAsync();
                                    console.log("a3",executed)
                                    toggleOverlay(false);sysAEx.disconnect()   
                                    console.log("a4",executed)                         
                                })
                            }
                            console.log(executed,"2")
                        };
                    })();
                    something()
                } 
                
                toggleOverlay(true,true)                

            } else {
                // Java installation found, use this to launch the game.
                ConfigManager.setJavaExecutable(m.result)
                ConfigManager.save()

                // We need to make sure that the updated value is on the settings UI.
                // Just incase the settings UI is already open.
                settingsJavaExecVal.value = m.result
                populateJavaExecDetails(settingsJavaExecVal.value)

                if(launchAfter){
                    dlAsync()
                }
                sysAEx.disconnect()
            }
        } else if(m.context === '_enqueueOpenJDK'){

            if(m.result === true){

                // Oracle JRE enqueued successfully, begin download.
                setLaunchDetails('Downloading Java..')
                sysAEx.send({task: 'execute', function: 'processDlQueues', argsArr: [[{id:'java', limit:1}]]})

            } else {

                // Oracle JRE enqueue failed. Probably due to a change in their website format.
                // User will have to follow the guide to install Java.
                setOverlayContent(
                    'Beklenmeyen Hata:<br>Java İndirilemedi',
                    'Maalesef Java indirirken bir sorunla karşı karşıya geldik. Javayı kendiniz indirmeni gerekiyor. Lütfen daha fazla bilgi ve detay için <a href="https://github.com/dscalzi/PixargonLauncher/wiki">Sorun Giderme</a>\'ye gidiniz.',
                    'Anladım'
                )
                setOverlayHandler(() => {
                    toggleOverlay(false)
                    toggleLaunchArea(false)
                })
                toggleOverlay(true)
                sysAEx.disconnect()

            }

        } else if(m.context === 'progress'){

            switch(m.data){
                case 'download':
                    // Downloading..
                    setDownloadPercentage(m.value, m.total, m.percent)
                    break
            }

        } else if(m.context === 'complete'){

            switch(m.data){
                case 'download': {
                    // Show installing progress bar.
                    remote.getCurrentWindow().setProgressBar(2)

                    // Wait for extration to complete.
                    const eLStr = 'Extracting'
                    let dotStr = ''
                    extractListener = setInterval(() => {
                        if(dotStr.length >= 3){
                            dotStr = ''
                        } else {
                            dotStr += '.'
                        }
                    }, 750)
                    break
                }
                case 'java':
                // Download & extraction complete, remove the loading from the OS progress bar.
                    remote.getCurrentWindow().setProgressBar(-1)

                    // Extraction completed successfully.
                    ConfigManager.setJavaExecutable(m.args[0])
                    ConfigManager.save()

                    if(extractListener != null){
                        clearInterval(extractListener)
                        extractListener = null
                    }

                    if(launchAfter){
                        dlAsync()
                    }

                    sysAEx.disconnect()
                    break
            }

        } else if(m.context === 'error'){
            console.log(m.error)
        }
    })

    // Begin system Java scan.
    sysAEx.send({task: 'execute', function: 'validateJava', argsArr: [ConfigManager.getDataDirectory()]})

}


function dlAsync(login = true){

    // Login parameter is temporary for debug purposes. Allows testing the validation/downloads without
    // launching the game.

    if(login) {     
        if(ConfigManager.getSelectedAccount() == null){
            loggerLanding.error('You must be logged into an account.')
            return
        }
    }

    
    


    const mcbruh = async () => {
        await setTimeout(() => {toggleLaunchArea(true)}, 100)
        setLaunchPercentage(0,100)
        setLaunchDetails("Başlatma bilgileri alınıyor..")
        setLaunchPercentage(2,100)
        const app = await require('electron').remote.app
        const appDir =await require('electron-root-path').rootPath;
        setLaunchPercentage(3,100)
        const gamedir=await appDir+"\\resources\\"+ConfigManager.getLD().Launcher.GameFolder;
        setLaunchPercentage(4,100)
        console.log('gamedir: ',gamedir);
        setLaunchPercentage(5,100)
        const clientname=await ConfigManager.getLD().ClientName;
        setLaunchPercentage(6,100)
        const memory={
            maxram:await ConfigManager.getMaxRAM(),
            minram:await ConfigManager.getMinRAM()
        };
        setLaunchPercentage(7,100)
        const wHeight=await ConfigManager.getGameHeight();
        setLaunchPercentage(8,100)
        const wWidth=await ConfigManager.getGameWidth();
        setLaunchPercentage(9,100)
        const fullscreen=await ConfigManager.getFullscreen();
        setLaunchPercentage(10,100)
        const javapath=await ConfigManager.getJavaExecutable();
        const autoConnect=false
        const Handler = await require(app.getAppPath()+'\\app\\assets\\js\\scripts\\handler');
        this.handler = await new Handler(this)
        setLaunchDetails("Client dosyaları yükleniyor..")
        await this.handler.getClient(gamedir,function (a){
            b=((a[0]/a[1])*30).toString().split(".")[0];
            launch_progress.setAttribute('max', 100);
            launch_progress.setAttribute('value', parseInt(b)+10);
            launch_progress_label.innerHTML = parseInt(b)+10 + '%';
        });

        setLaunchDetails("Asset dosyaları yükleniyor..")
        
        await this.handler.getAssets(gamedir,function (a){
            b=((a[0]/a[1])*50).toString().split(".")[0];
            launch_progress.setAttribute('max', 100);
            launch_progress.setAttribute('value', parseInt(b)+40);
            launch_progress_label.innerHTML = parseInt(b)+40 + '%';
        });
        setLaunchDetails("Oyuncu bilgileri yükleniyor..")
        user=await ConfigManager.getSelectedAccount()
        setLaunchPercentage(91,100)
        setLaunchDetails("Sunucu bilgileri yükleniyor..")
        const serv=await DistroManager.getDistribution().getServer(ConfigManager.getSelectedServer()).address.split(":")
        console.log(serv)
        const server={
            host: serv[0],
            port: serv[1]
        };
        setLaunchPercentage(95,100)
        setLaunchDetails("Client başlatılıyor..")
        console.log("wut: ",DistroManager.getDistribution().getServer(ConfigManager.getSelectedServer()))
        //Authenticator.getAuth(options.username,(options.password==null) ? null : options.password).then(function(result){
        Lname=ConfigManager.getLD().Launcher.Name

        opt={appDir,gamedir,clientname,memory,wHeight,wWidth,fullscreen,javapath,autoConnect,server,user,Lname};
        
        const mc = require('./assets/js/scripts/launch');

        
        await mc.Launch(opt,function(error){throw error});
        setLaunchPercentage(100,100)
        await setTimeout(() => {setLaunchPercentage(100,100);toggleLaunchArea(false);app.quit()}, 500)
        
        
    }
    mcbruh()
}




if(ConfigManager.getLD().WebAddress){


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
        const newsBtnText = document.querySelector('#newsButtonText')
        const newsBtnSvg = document.querySelector('#newsButtonSVG')
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
            newsBtn.style.top = 'calc(150.99vh - 100%)'
            newsBtnSvg.style.filter = 'drop-shadow(0px 0px 5px #000);'
            newsBtnText.style.opacity = 0
            $("#newsContainer").stop();
            $( "#newsContainer" ).animate({
                opacity: 1,
                bottom: "0",
            }, 1900,"swing")
            //date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'})
            landingContainer.style.background = 'rgba(0, 0, 0, 0.5)'
            setTimeout(() => {
                if(newsGlideCount === 1){
                    lCLCenter.style.transition = 'none'
                    newsBtn.style.transition = 'none'
                }
                newsGlideCount--
            }, 2000)
            
            
            
        } else {
            $("#newsContainer").stop();
            $( "#newsContainer" ).animate({
                opacity: 0,
                bottom: "-100%",
            }, 800,"swing")
            
            setTimeout(() => {
                if(newsGlideCount === 1){
                    console.log("I shit myself")
                }
                newsGlideCount--
            }, 2000)

            newsBtnSvg.style.filter = "unset"
            newsBtnText.style.opacity = 1
            newsContainer.style.opacity = 0
            landingContainer.style.background = null
            lCLCenter.style.transition = null
            newsBtn.style.transition = null
            newsContainer.style.bottom = '-100%'
            lCUpper.style.top = '0px'
            lCLLeft.style.top = '0px'
            lCLCenter.style.top = '0px'
            lCLRight.style.top = '0px'
            newsBtn.style.top = '55px'
            
        }
    }

    // Bind news button.
    document.getElementById('newsButton').onclick = () => {
        // Toggle tabbing.
        if(newsActive){
            $('#landingContainer *').removeAttr('tabindex')
            $('#newsContainer *').attr('tabindex', '-1')
        } else {
            $('#landingContainer *').attr('tabindex', '-1')
            $('#newsContainer, #newsContainer *, #lower, #lower #center *').removeAttr('tabindex')
        }
        slide_(!newsActive)
        newsActive = !newsActive
    }



    document.addEventListener('keydown', (e) => {
        if(newsActive){
            // Interferes with scrolling an article using the down arrow.
            // Not sure of a straight forward solution at this point.
            if(e.key === 'ArrowDown'){
                document.getElementById('newsButton').click()
            }
        } else {
            if(getCurrentView() === VIEWS.landing){
                if(e.key === 'ArrowUp'){
                    document.getElementById('newsButton').click()
                }
            }
        }
    })
}