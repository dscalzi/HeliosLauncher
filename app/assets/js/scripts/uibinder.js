/**
 * Initialize UI functions which depend on internal modules.
 * Loaded after core UI functions are initialized in uicore.js.
 */
// Requirements
const path = require('path')

const AuthManager = require('./assets/js/authmanager')
const ConfigManager = require('./assets/js/configmanager')
const DistroManager = require('./assets/js/distromanager')
const Lang = require('./assets/js/langloader')

let rscShouldLoad = false
let fatalStartupError = false

// Mapping of each view to their container IDs.
const VIEWS = {
    landing: '#landingContainer',
    login: '#loginContainer',
    settings: '#settingsContainer',
    welcome: '#welcomeContainer'
}

// The currently shown view container.
let currentView

/**
 * Switch launcher views.
 * 
 * @param {string} current The ID of the current view container. 
 * @param {*} next The ID of the next view container.
 * @param {*} currentFadeTime Optional. The fade out time for the current view.
 * @param {*} nextFadeTime Optional. The fade in time for the next view.
 * @param {*} onCurrentFade Optional. Callback function to execute when the current
 * view fades out.
 * @param {*} onNextFade Optional. Callback function to execute when the next view
 * fades in.
 */
function switchView(current, next, currentFadeTime = 500, nextFadeTime = 500, onCurrentFade = () => {}, onNextFade = () => {}) {
    currentView = next
    $(`${current}`).fadeOut(currentFadeTime, () => {
        onCurrentFade()
        $(`${next}`).fadeIn(nextFadeTime, () => {
            onNextFade()
        })
    })
}

/**
 * Get the currently shown view container.
 * 
 * @returns {string} The currently shown view container.
 */
function getCurrentView() {
    return currentView
}

function showMainUI(data) {

    if (!isDev) {
        loggerAutoUpdater.log('Initialisation..')
        ipcRenderer.send('autoUpdateAction', 'initAutoUpdater', ConfigManager.getAllowPrerelease())
    }

    prepareSettings(true)
    updateSelectedServer(data.getServer(ConfigManager.getSelectedServer()))
    refreshServerStatus()
    setTimeout(() => {
            document.getElementById('frameBar').style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
            document.body.style.backgroundImage = `url('assets/images/backgrounds/${document.body.getAttribute('bkid')}.jpg')`
            $('#main').show()

            const isLoggedIn = Object.keys(ConfigManager.getAuthAccounts()).length > 0

            // If this is enabled in a development environment we'll get ratelimited.
            // The relaunch frequency is usually far too high.
            if (!isDev && isLoggedIn) {
                validateSelectedAccount()
            }

            if (ConfigManager.isFirstLaunch()) {
                currentView = VIEWS.welcome
                $(VIEWS.welcome).fadeIn(1000)
            } else {
                if (isLoggedIn) {
                    currentView = VIEWS.landing
                    $(VIEWS.landing).fadeIn(1000)
                } else {
                    currentView = VIEWS.login
                    $(VIEWS.login).fadeIn(1000)
                }
            }

            setTimeout(() => {
                $('#loadingContainer').fadeOut(500, () => {
                    $('#loadSpinnerImage').removeClass('rotating')
                })
            }, 250)

        }, 750)
        // Disable tabbing to the news container.
    initNews().then(() => {
        $('#newsContainer *').attr('tabindex', '-1')
    })
}

function showFatalStartupError() {
    setTimeout(() => {
        $('#loadingContainer').fadeOut(250, () => {
            document.getElementById('overlayContainer').style.background = 'none'
            setOverlayContent(
                'Erreur fatale: impossible de charger l\'index de distribution',
                'Une connexion n\'a pas pu être établie avec nos serveurs pour télécharger l\'index de distribution. Aucune copie locale n\'était disponible pour le chargement. <br> <br> L\'index de distribution est un fichier essentiel qui fournit les dernières informations sur le serveur. Le lanceur ne peut pas démarrer sans lui. Assurez-vous que vous êtes connecté à Internet et relancez l\'application.',
                'Fermer'
            )
            setOverlayHandler(() => {
                const window = remote.getCurrentWindow()
                window.close()
            })
            toggleOverlay(true)
        })
    }, 750)
}

/**
 * Common functions to perform after refreshing the distro index.
 * 
 * @param {Object} data The distro index object.
 */
function onDistroRefresh(data) {
    updateSelectedServer(data.getServer(ConfigManager.getSelectedServer()))
    refreshServerStatus()
    initNews()
    syncModConfigurations(data)
}

/**
 * Sync the mod configurations with the distro index.
 * 
 * @param {Object} data The distro index object.
 */
function syncModConfigurations(data) {

    const syncedCfgs = []

    for (let serv of data.getServers()) {

        const id = serv.getID()
        const mdls = serv.getModules()
        const cfg = ConfigManager.getModConfiguration(id)

        if (cfg != null) {

            const modsOld = cfg.mods
            const mods = {}

            for (let mdl of mdls) {
                const type = mdl.getType()

                if (type === DistroManager.Types.ForgeMod || type === DistroManager.Types.LiteMod || type === DistroManager.Types.LiteLoader) {
                    if (!mdl.getRequired().isRequired()) {
                        const mdlID = mdl.getVersionlessID()
                        if (modsOld[mdlID] == null) {
                            mods[mdlID] = scanOptionalSubModules(mdl.getSubModules(), mdl)
                        } else {
                            mods[mdlID] = mergeModConfiguration(modsOld[mdlID], scanOptionalSubModules(mdl.getSubModules(), mdl), false)
                        }
                    } else {
                        if (mdl.hasSubModules()) {
                            const mdlID = mdl.getVersionlessID()
                            const v = scanOptionalSubModules(mdl.getSubModules(), mdl)
                            if (typeof v === 'object') {
                                if (modsOld[mdlID] == null) {
                                    mods[mdlID] = v
                                } else {
                                    mods[mdlID] = mergeModConfiguration(modsOld[mdlID], v, true)
                                }
                            }
                        }
                    }
                }
            }

            syncedCfgs.push({
                id,
                mods
            })

        } else {

            const mods = {}

            for (let mdl of mdls) {
                const type = mdl.getType()
                if (type === DistroManager.Types.ForgeMod || type === DistroManager.Types.LiteMod || type === DistroManager.Types.LiteLoader) {
                    if (!mdl.getRequired().isRequired()) {
                        mods[mdl.getVersionlessID()] = scanOptionalSubModules(mdl.getSubModules(), mdl)
                    } else {
                        if (mdl.hasSubModules()) {
                            const v = scanOptionalSubModules(mdl.getSubModules(), mdl)
                            if (typeof v === 'object') {
                                mods[mdl.getVersionlessID()] = v
                            }
                        }
                    }
                }
            }

            syncedCfgs.push({
                id,
                mods
            })

        }
    }

    ConfigManager.setModConfigurations(syncedCfgs)
    ConfigManager.save()
}

/**
 * Recursively scan for optional sub modules. If none are found,
 * this function returns a boolean. If optional sub modules do exist,
 * a recursive configuration object is returned.
 * 
 * @returns {boolean | Object} The resolved mod configuration.
 */
function scanOptionalSubModules(mdls, origin) {
    if (mdls != null) {
        const mods = {}

        for (let mdl of mdls) {
            const type = mdl.getType()
                // Optional types.
            if (type === DistroManager.Types.ForgeMod || type === DistroManager.Types.LiteMod || type === DistroManager.Types.LiteLoader) {
                // It is optional.
                if (!mdl.getRequired().isRequired()) {
                    mods[mdl.getVersionlessID()] = scanOptionalSubModules(mdl.getSubModules(), mdl)
                } else {
                    if (mdl.hasSubModules()) {
                        const v = scanOptionalSubModules(mdl.getSubModules(), mdl)
                        if (typeof v === 'object') {
                            mods[mdl.getVersionlessID()] = v
                        }
                    }
                }
            }
        }

        if (Object.keys(mods).length > 0) {
            const ret = {
                mods
            }
            if (!origin.getRequired().isRequired()) {
                ret.value = origin.getRequired().isDefault()
            }
            return ret
        }
    }
    return origin.getRequired().isDefault()
}

/**
 * Recursively merge an old configuration into a new configuration.
 * 
 * @param {boolean | Object} o The old configuration value.
 * @param {boolean | Object} n The new configuration value.
 * @param {boolean} nReq If the new value is a required mod.
 * 
 * @returns {boolean | Object} The merged configuration.
 */
function mergeModConfiguration(o, n, nReq = false) {
    if (typeof o === 'boolean') {
        if (typeof n === 'boolean') return o
        else if (typeof n === 'object') {
            if (!nReq) {
                n.value = o
            }
            return n
        }
    } else if (typeof o === 'object') {
        if (typeof n === 'boolean') return typeof o.value !== 'undefined' ? o.value : true
        else if (typeof n === 'object') {
            if (!nReq) {
                n.value = typeof o.value !== 'undefined' ? o.value : true
            }

            const newMods = Object.keys(n.mods)
            for (let i = 0; i < newMods.length; i++) {

                const mod = newMods[i]
                if (o.mods[mod] != null) {
                    n.mods[mod] = mergeModConfiguration(o.mods[mod], n.mods[mod])
                }
            }

            return n
        }
    }
    // If for some reason we haven't been able to merge,
    // wipe the old value and use the new one. Just to be safe
    return n
}

function refreshDistributionIndex(remote, onSuccess, onError) {
    if (remote) {
        DistroManager.pullRemote()
            .then(onSuccess)
            .catch(onError)
    } else {
        DistroManager.pullLocal()
            .then(onSuccess)
            .catch(onError)
    }
}

async function validateSelectedAccount() {
    const selectedAcc = ConfigManager.getSelectedAccount()
    if (selectedAcc != null) {
        const val = await AuthManager.validateSelected()
        if (!val) {
            ConfigManager.removeAuthAccount(selectedAcc.uuid)
            ConfigManager.save()
            const accLen = Object.keys(ConfigManager.getAuthAccounts()).length
            setOverlayContent(
                'Échec de l\'actualisation de la connexion',
                `Nous n'avons pas pu actualiser la connexion pour <strong>${selectedAcc.displayName}</strong>. Merci ${accLen > 0 ? 'sélectionnez un autre compte ou ' : ''} reconnectez-vous.`,
                'Connection',
                'Sélectionnez un autre compte'
            )
            setOverlayHandler(() => {
                document.getElementById('loginUsername').value = selectedAcc.username
                validateEmail(selectedAcc.username)
                loginViewOnSuccess = getCurrentView()
                loginViewOnCancel = getCurrentView()
                if (accLen > 0) {
                    loginViewCancelHandler = () => {
                        ConfigManager.addAuthAccount(selectedAcc.uuid, selectedAcc.accessToken, selectedAcc.username, selectedAcc.displayName)
                        ConfigManager.save()
                        validateSelectedAccount()
                    }
                    loginCancelEnabled(true)
                }
                toggleOverlay(false)
                switchView(getCurrentView(), VIEWS.login)
            })
            setDismissHandler(() => {
                if (accLen > 1) {
                    prepareAccountSelectionList()
                    $('#overlayContent').fadeOut(250, () => {
                        bindOverlayKeys(true, 'accountSelectContent', true)
                        $('#accountSelectContent').fadeIn(250)
                    })
                } else {
                    const accountsObj = ConfigManager.getAuthAccounts()
                    const accounts = Array.from(Object.keys(accountsObj), v => accountsObj[v])
                        // This function validates the account switch.
                    setSelectedAccount(accounts[0].uuid)
                    toggleOverlay(false)
                }
            })
            toggleOverlay(true, accLen > 0)
        } else {
            return true
        }
    } else {
        return true
    }
}

/**
 * Temporary function to update the selected account along
 * with the relevent UI elements.
 * 
 * @param {string} uuid The UUID of the account.
 */
function setSelectedAccount(uuid) {
    const authAcc = ConfigManager.setSelectedAccount(uuid)
    ConfigManager.save()
    updateSelectedAccount(authAcc)
    validateSelectedAccount()
}

// Synchronous Listener
document.addEventListener('readystatechange', function() {

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        if (rscShouldLoad) {
            rscShouldLoad = false
            if (!fatalStartupError) {
                const data = DistroManager.getDistribution()
                showMainUI(data)
            } else {
                showFatalStartupError()
            }
        }
    }

}, false)

// Actions that must be performed after the distribution index is downloaded.
ipcRenderer.on('distributionIndexDone', (event, res) => {
    if (res) {
        const data = DistroManager.getDistribution()
        syncModConfigurations(data)
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            showMainUI(data)
        } else {
            rscShouldLoad = true
        }
    } else {
        fatalStartupError = true
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            showFatalStartupError()
        } else {
            rscShouldLoad = true
        }
    }
})