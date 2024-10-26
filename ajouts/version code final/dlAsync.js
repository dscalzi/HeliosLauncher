/**
 * @Name dlAsync Function
 * @returns {Promise<void>}
 *
 * @author Sandro642
 * @Cheating Athena's Shield
 *
 * @Added whitelist for mods
 * @Added support for the new HeliosLauncher version
 */

import fs from 'fs'
import crypto from 'crypto'
import {DistributionIndexProcessor, FullRepair, MojangIndexProcessor} from 'helios-core/dl'

/**
 * @Reviewed on XX.XX.2024 expires on 01.01.2025
 * @Bugs discovereds: 0
 * @Athena's Shield
 * @Sandro642
 */


// ▄▄▄     ▄▄▄█████▓ ██░ ██ ▓█████  ███▄    █  ▄▄▄        ██████      ██████  ██░ ██  ██▓▓█████  ██▓    ▓█████▄
// ▒████▄   ▓  ██▒ ▓▒▓██░ ██▒▓█   ▀  ██ ▀█   █ ▒████▄    ▒██    ▒    ▒██    ▒ ▓██░ ██▒▓██▒▓█   ▀ ▓██▒    ▒██▀ ██▌
// ▒██  ▀█▄ ▒ ▓██░ ▒░▒██▀▀██░▒███   ▓██  ▀█ ██▒▒██  ▀█▄  ░ ▓██▄      ░ ▓██▄   ▒██▀▀██░▒██▒▒███   ▒██░    ░██   █▌
// ░██▄▄▄▄██░ ▓██▓ ░ ░▓█ ░██ ▒▓█  ▄ ▓██▒  ▐▌██▒░██▄▄▄▄██   ▒   ██▒     ▒   ██▒░▓█ ░██ ░██░▒▓█  ▄ ▒██░    ░▓█▄   ▌
//  ▓█   ▓██▒ ▒██▒ ░ ░▓█▒░██▓░▒████▒▒██░   ▓██░ ▓█   ▓██▒▒██████▒▒   ▒██████▒▒░▓█▒░██▓░██░░▒████▒░██████▒░▒████▓
//  ▒▒   ▓▒█░ ▒ ░░    ▒ ░░▒░▒░░ ▒░ ░░ ▒░   ▒ ▒  ▒▒   ▓▒█░▒ ▒▓▒ ▒ ░   ▒ ▒▓▒ ▒ ░ ▒ ░░▒░▒░▓  ░░ ▒░ ░░ ▒░▓  ░ ▒▒▓  ▒
//   ▒   ▒▒ ░   ░     ▒ ░▒░ ░ ░ ░  ░░ ░░   ░ ▒░  ▒   ▒▒ ░░ ░▒  ░ ░   ░ ░▒  ░ ░ ▒ ░▒░ ░ ▒ ░ ░ ░  ░░ ░ ▒  ░ ░ ▒  ▒
//   ░   ▒    ░       ░  ░░ ░   ░      ░   ░ ░   ░   ▒   ░  ░  ░     ░  ░  ░   ░  ░░ ░ ▒ ░   ░     ░ ░    ░ ░  ░
//       ░  ░         ░  ░  ░   ░  ░         ░       ░  ░      ░           ░   ░  ░  ░ ░     ░  ░    ░  ░   ░
//                                                                                                        ░

// Keep reference to Minecraft Process
let proc
// Is DiscordRPC enabled
let hasRPC = false
// Joined server regex
const GAME_JOINED_REGEX = /\[.+\]: Sound engine started/
const GAME_LAUNCH_REGEX = /^\[.+\]: (?:MinecraftForge .+ Initialized|ModLauncher .+ starting: .+|Loading Minecraft .+ with Fabric Loader .+)$/
const MIN_LINGER = 5000

// List of mods to exclude from validation
const EXCLUDED_MODS = [
]

async function dlAsync(login = true) {
    const loggerLaunchSuite = LoggerUtil.getLogger('LaunchSuite')
    const loggerLanding = LoggerUtil.getLogger('Landing')
    setLaunchDetails(Lang.queryJS('landing.dlAsync.loadingServerInfo'))

    let distro

    try {
        distro = await DistroAPI.refreshDistributionOrFallback()
        onDistroRefresh(distro)
    } catch (err) {
        loggerLanding.error(Lang.queryJS('landing.dlAsync.unableToLoadDistributionIndex'))
        showLaunchFailure(Lang.queryJS('landing.dlAsync.fatalError'), Lang.queryJS('landing.dlAsync.unableToLoadDistributionIndex'))
        return
    }

    const serv = distro.getServerById(ConfigManager.getSelectedServer())

    if (login) {
        if (ConfigManager.getSelectedAccount() == null) {
            loggerLanding.error(Lang.queryJS('landing.dlAsync.accountLoginNeeded'))
            return
        }
    }

    // --------- Mod Verification Logic ---------

    if (athShield.status) {
        loggerLanding.info(Lang.queryJS('landing.dlAsync.AthShield.usingAthShield'))

        const modsDir = path.join(ConfigManager.getDataDirectory(), 'instances', serv.rawServer.id, 'mods')

        // Check if mods directory exists, if not, create it
        if (!fs.existsSync(modsDir)) {
            fs.mkdirSync(modsDir, {recursive: true})
        }

        const distroMods = {}
        const mdls = serv.modules

        // Populate expected mod identities and log them
        mdls.forEach(mdl => {
            if (mdl.rawModule.name.endsWith('.jar')) {
                const modPath = path.join(modsDir, mdl.rawModule.name)
                const modIdentity = mdl.rawModule.identity || mdl.rawModule.artifact.MD5
                if (athShield.debug) {
                    loggerLanding.info(Lang.queryJS('landing.dlAsync.AthShield.distributionIdentityError', {
                        'moduleName': mdl.rawModule.name,
                        'moduleIdentity': modIdentity
                    }))
                }

                distroMods[modPath] = modIdentity
            }
        })

        // Function to extract mod identity from the jar file
        const extractModIdentity = (filePath) => {
            if (athShield.debug) {
                loggerLanding.info(Lang.queryJS('landing.dlAsync.AthShield.modIdentityExtraction', {'filePath': filePath}))
            }

            // Fall back to a hash if no identity is found
            const fileBuffer = fs.readFileSync(filePath)
            const hashSum = crypto.createHash('md5')  // Use MD5 to match the distribution configuration
            hashSum.update(fileBuffer)
            const hash = hashSum.digest('hex')
            if (athShield.debug) {
                loggerLanding.info(Lang.queryJS('landing.dlAsync.AthShield.identityNotFoundUsingHash', {
                    'filePath': filePath,
                    'hash': hash
                }))
            }

            return hash
        }

        // Validate mods function
        const validateMods = () => {
            loggerLanding.info(Lang.queryJS('landing.dlAsync.AthShield.startingModValidation'))
            const installedMods = fs.readdirSync(modsDir)
            let valid = true

            for (let mod of installedMods) {
                const modPath = path.join(modsDir, mod)

                // Skip validation for mods in the excluded list
                if (EXCLUDED_MODS.includes(mod)) {
                    loggerLanding.info(Lang.queryJS('landing.dlAsync.AthShield.modValidationBypassed', {'mod': mod}))
                    continue
                }

                const expectedIdentity = distroMods[modPath]
                loggerLanding.info(Lang.queryJS('landing.dlAsync.AthShield.validatingMod', {'mod': mod}))

                if (expectedIdentity) {
                    const modIdentity = extractModIdentity(modPath)
                    if (athShield.debug) {
                        loggerLanding.info(Lang.queryJS('landing.dlAsync.AthShield.expectedAndCalculatedIdentity', {
                            'expectedIdentity': expectedIdentity,
                            'mod': mod,
                            'modIdentity': modIdentity
                        }))
                    }

                    if (modIdentity !== expectedIdentity) {
                        if (athShield.debug) {
                            loggerLanding.error(Lang.queryJS('landing.dlAsync.AthShield.modIdentityMismatchError', {
                                'mod': mod,
                                'expectedIdentity': expectedIdentity,
                                'modIdentity': modIdentity
                            }))
                        }

                        valid = false
                        break
                    }
                } else {
                    loggerLanding.warn(Lang.queryJS('landing.dlAsync.AthShield.expectedIdentityNotFound', {'mod': mod}))
                    valid = false
                    break
                }
            }

            loggerLanding.info(Lang.queryJS('landing.dlAsync.AthShield.modValidationCompleted'))
            return valid
        }

        // Perform mod validation before proceeding
        if (!validateMods()) {
            const errorMessage = Lang.queryJS('landing.dlAsync.AthShield.invalidModsDetectedMessage', {'folder': ConfigManager.getNameDataPath()})
            loggerLanding.error(errorMessage)
            showLaunchFailure(errorMessage, null)
            return
        }

    } else {
        loggerLanding.info(Lang.queryJS('landing.dlAsync.AthShield.notUsingAthShield'))
    }

    // --------- End of Mod Verification Logic ---------

    setLaunchDetails(Lang.queryJS('landing.dlAsync.pleaseWait'))
    toggleLaunchArea(true)
    setLaunchPercentage(0, 100)

    const fullRepairModule = new FullRepair(
        ConfigManager.getCommonDirectory(),
        ConfigManager.getInstanceDirectory(),
        ConfigManager.getLauncherDirectory(),
        ConfigManager.getSelectedServer(),
        DistroAPI.isDevMode()
    )

    fullRepairModule.spawnReceiver()

    fullRepairModule.childProcess.on('error', (err) => {
        loggerLaunchSuite.error(Lang.queryJS('landing.dlAsync.errorDuringLaunchText') + err)
        showLaunchFailure(Lang.queryJS('landing.dlAsync.errorDuringLaunchTitle'), err.message || Lang.queryJS('landing.dlAsync.errorDuringLaunchText'))
    })
    fullRepairModule.childProcess.on('close', (code, _signal) => {
        if(code !== 0){
            loggerLaunchSuite.error(Lang.queryJS('landing.dlAsync.fullRepairMode', {'code': code}))
            showLaunchFailure(Lang.queryJS('landing.dlAsync.errorDuringLaunchTitle'), Lang.queryJS('landing.dlAsync.seeConsoleForDetails'))
        }
    })

    loggerLaunchSuite.info(Lang.queryJS('landing.dlAsync.validatingFileIntegrity'))
    setLaunchDetails(Lang.queryJS('landing.dlAsync.validatingFileIntegrity'))
    let invalidFileCount = 0
    try {
        invalidFileCount = await fullRepairModule.verifyFiles(percent => {
            setLaunchPercentage(percent)
        })
        setLaunchPercentage(100)
    } catch (err) {
        loggerLaunchSuite.error(Lang.queryJS('landing.dlAsync.errFileVerification'))
        showLaunchFailure(Lang.queryJS('landing.dlAsync.errorDuringFileVerificationTitle'), err.displayable || Lang.queryJS('landing.dlAsync.seeConsoleForDetails'))
        return
    }

    if(invalidFileCount > 0) {
        loggerLaunchSuite.info('Downloading files.')
        setLaunchDetails(Lang.queryJS('landing.dlAsync.downloadingFiles'))
        setLaunchPercentage(0)
        try {
            await fullRepairModule.download(percent => {
                setDownloadPercentage(percent)
            })
            setDownloadPercentage(100)
        } catch(err) {
            loggerLaunchSuite.error(Lang.queryJS('landing.dlAsync.errorDuringFileDownloadTitle'))
            showLaunchFailure(Lang.queryJS('landing.dlAsync.errorDuringFileDownloadTitle'), err.displayable || Lang.queryJS('landing.dlAsync.seeConsoleForDetails'))
            return
        }
    } else {
        loggerLaunchSuite.info(Lang.queryJS('landing.dlAsync.AthShield.downloadingFiles'))
    }

    // Remove download bar.
    remote.getCurrentWindow().setProgressBar(-1)

    fullRepairModule.destroyReceiver()

    setLaunchDetails(Lang.queryJS('landing.dlAsync.preparingToLaunch'))

    const mojangIndexProcessor = new MojangIndexProcessor(
        ConfigManager.getCommonDirectory(),
        serv.rawServer.minecraftVersion)
    const distributionIndexProcessor = new DistributionIndexProcessor(
        ConfigManager.getCommonDirectory(),
        distro,
        serv.rawServer.id
    )

    const modLoaderData = await distributionIndexProcessor.loadModLoaderVersionJson(serv)
    const versionData = await mojangIndexProcessor.getVersionJson()

    if(login) {
        const authUser = ConfigManager.getSelectedAccount()
        loggerLaunchSuite.info(Lang.queryJS('landing.dlAsync.accountToProcessBuilder', {'userDisplayName': authUser.displayName}))
        let pb = new ProcessBuilder(serv, versionData, modLoaderData, authUser, remote.app.getVersion())
        setLaunchDetails(Lang.queryJS('landing.dlAsync.launchingGame'))

        const SERVER_JOINED_REGEX = new RegExp(`\\[.+\\]: \\[CHAT\\] ${authUser.displayName} joined the game`)

        const onLoadComplete = () => {
            toggleLaunchArea(false)

            proc.stdout.removeListener('data', tempListener)
            proc.stderr.removeListener('data', gameErrorListener)
        }
        const start = Date.now()

        // Attach a temporary listener to the client output.
        const tempListener = function(data){
            if(GAME_LAUNCH_REGEX.test(data.trim())){
                const diff = Date.now()-start
                if(diff < MIN_LINGER) {
                    setTimeout(onLoadComplete, MIN_LINGER-diff)
                } else {
                    onLoadComplete()
                }
            }
        }

        const gameErrorListener = function(data){
            if(data.trim().toLowerCase().includes('error')){
                loggerLaunchSuite.error(Lang.queryJS('landing.dlAsync.gameError', {'data': data}))
            }
        }

        proc = pb.build()

        proc.stdout.on('data', tempListener)
        proc.stderr.on('data', gameErrorListener)

        proc.stdout.on('data', function(data){
            if(SERVER_JOINED_REGEX.test(data.trim())){
                DiscordWrapper.updateDetails('Exploring the World')
            } else if(GAME_JOINED_REGEX.test(data.trim())) {
                DiscordWrapper.updateDetails('Main Menu')
            }
        })

        proc.on('close', (code, _signal) => {
            if (hasRPC) {
                DiscordWrapper.shutdownRPC()
                hasRPC = false
            }
            loggerLaunchSuite.info(Lang.queryJS('landing.dlAsync.gameExited', {'code': code}))
            if(code !== 0){
                showLaunchFailure(Lang.queryJS('landing.dlAsync.gameExitedAbnormal'), Lang.queryJS('landing.dlAsync.seeConsoleForDetails'))
            }
            proc = null
        })

        proc.on('error', (err) => {
            loggerLaunchSuite.error(Lang.queryJS('landing.dlAsync.gameErrorDuringLaunch', {'error': err}))
            showLaunchFailure(Lang.queryJS('landing.dlAsync.errorDuringLaunchTitle'), err.message || Lang.queryJS('landing.dlAsync.errorDuringLaunchText'))
            proc = null
        })

        setTimeout(() => {
            loggerLaunchSuite.info(Lang.queryJS('landing.dlAsync.waintingLaunchingGame'))
        }, MIN_LINGER)
    }
}