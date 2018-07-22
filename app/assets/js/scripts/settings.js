// Requirements
const os     = require('os')
const semver = require('semver')

const { AssetGuard } = require('./assets/js/assetguard')

const settingsState = {
    invalid: new Set()
}

/**
 * General Settings Functions
 */

/**
  * Bind value validators to the settings UI elements. These will
  * validate against the criteria defined in the ConfigManager (if
  * and). If the value is invalid, the UI will reflect this and saving
  * will be disabled until the value is corrected. This is an automated
  * process. More complex UI may need to be bound separately.
  */
function initSettingsValidators(){
    const sEls = document.getElementById('settingsContainer').querySelectorAll('[cValue]')
    Array.from(sEls).map((v, index, arr) => {
        const vFn = ConfigManager['validate' + v.getAttribute('cValue')]
        if(typeof vFn === 'function'){
            if(v.tagName === 'INPUT'){
                if(v.type === 'number' || v.type === 'text'){
                    v.addEventListener('keyup', (e) => {
                        const v = e.target
                        if(!vFn(v.value)){
                            settingsState.invalid.add(v.id)
                            v.setAttribute('error', '')
                            settingsSaveDisabled(true)
                        } else {
                            if(v.hasAttribute('error')){
                                v.removeAttribute('error')
                                settingsState.invalid.delete(v.id)
                                if(settingsState.invalid.size === 0){
                                    settingsSaveDisabled(false)
                                }
                            }
                        }
                    })
                }
            }
        }

    })
}

/**
 * Load configuration values onto the UI. This is an automated process.
 */
function initSettingsValues(){
    const sEls = document.getElementById('settingsContainer').querySelectorAll('[cValue]')
    Array.from(sEls).map((v, index, arr) => {
        const gFn = ConfigManager['get' + v.getAttribute('cValue')]
        if(typeof gFn === 'function'){
            if(v.tagName === 'INPUT'){
                if(v.type === 'number' || v.type === 'text'){
                    // Special Conditions
                    const cVal = v.getAttribute('cValue')
                    if(cVal === 'JavaExecutable'){
                        populateJavaExecDetails(v.value)
                        v.value = gFn()
                    } else if(cVal === 'JVMOptions'){
                        v.value = gFn().join(' ')
                    } else {
                        v.value = gFn()
                    }
                } else if(v.type === 'checkbox'){
                    v.checked = gFn()
                }
            } else if(v.tagName === 'DIV'){
                if(v.classList.contains('rangeSlider')){
                    // Special Conditions
                    const cVal = v.getAttribute('cValue')
                    if(cVal === 'MinRAM' || cVal === 'MaxRAM'){
                        let val = gFn()
                        if(val.endsWith('M')){
                            val = Number(val.substring(0, val.length-1))/1000
                        } else {
                            val = Number.parseFloat(val)
                        }

                        v.setAttribute('value', val)
                    } else {
                        v.setAttribute('value', Number.parseFloat(gFn()))
                    }
                }
            }
        }

    })
}

/**
 * Save the settings values.
 */
function saveSettingsValues(){
    const sEls = document.getElementById('settingsContainer').querySelectorAll('[cValue]')
    Array.from(sEls).map((v, index, arr) => {
        const sFn = ConfigManager['set' + v.getAttribute('cValue')]
        if(typeof sFn === 'function'){
            if(v.tagName === 'INPUT'){
                if(v.type === 'number' || v.type === 'text'){
                    // Special Conditions
                    const cVal = v.getAttribute('cValue')
                    if(cVal === 'JVMOptions'){
                        sFn(v.value.split(' '))
                    } else {
                        sFn(v.value)
                    }
                } else if(v.type === 'checkbox'){
                    sFn(v.checked)
                    // Special Conditions
                    const cVal = v.getAttribute('cValue')
                    if(cVal === 'AllowPrerelease'){
                        changeAllowPrerelease(v.checked)
                    }
                }
            } else if(v.tagName === 'DIV'){
                if(v.classList.contains('rangeSlider')){
                    // Special Conditions
                    const cVal = v.getAttribute('cValue')
                    if(cVal === 'MinRAM' || cVal === 'MaxRAM'){
                        let val = Number(v.getAttribute('value'))
                        if(val%1 > 0){
                            val = val*1000 + 'M'
                        } else {
                            val = val + 'G'
                        }

                        sFn(val)
                    } else {
                        sFn(v.getAttribute('value'))
                    }
                }
            }
        }
    })
}

let selectedSettingsTab = 'settingsTabAccount'

/**
 * Modify the settings container UI when the scroll threshold reaches
 * a certain poin.
 * 
 * @param {UIEvent} e The scroll event.
 */
function settingsTabScrollListener(e){
    if(e.target.scrollTop > Number.parseFloat(getComputedStyle(e.target.firstElementChild).marginTop)){
        document.getElementById('settingsContainer').setAttribute('scrolled', '')
    } else {
        document.getElementById('settingsContainer').removeAttribute('scrolled')
    }
}

/**
 * Bind functionality for the settings navigation items.
 */
function setupSettingsTabs(){
    Array.from(document.getElementsByClassName('settingsNavItem')).map((val) => {
        if(val.hasAttribute('rSc')){
            val.onclick = () => {
                settingsNavItemListener(val)
            }
        }
    })
}

/**
 * Settings nav item onclick lisener. Function is exposed so that
 * other UI elements can quickly toggle to a certain tab from other views.
 * 
 * @param {Element} ele The nav item which has been clicked.
 * @param {boolean} fade Optional. True to fade transition.
 */
function settingsNavItemListener(ele, fade = true){
    if(ele.hasAttribute('selected')){
        return
    }
    const navItems = document.getElementsByClassName('settingsNavItem')
    for(let i=0; i<navItems.length; i++){
        if(navItems[i].hasAttribute('selected')){
            navItems[i].removeAttribute('selected')
        }
    }
    ele.setAttribute('selected', '')
    let prevTab = selectedSettingsTab
    selectedSettingsTab = ele.getAttribute('rSc')

    document.getElementById(prevTab).onscroll = null
    document.getElementById(selectedSettingsTab).onscroll = settingsTabScrollListener

    if(fade){
        $(`#${prevTab}`).fadeOut(250, () => {
            $(`#${selectedSettingsTab}`).fadeIn({
                duration: 250,
                start: () => {
                    settingsTabScrollListener({
                        target: document.getElementById(selectedSettingsTab)
                    })
                }
            })
        })
    } else {
        $(`#${prevTab}`).hide(0, () => {
            $(`#${selectedSettingsTab}`).show({
                duration: 0,
                start: () => {
                    settingsTabScrollListener({
                        target: document.getElementById(selectedSettingsTab)
                    })
                }
            })
        })
    }
}

const settingsNavDone = document.getElementById('settingsNavDone')

/**
 * Set if the settings save (done) button is disabled.
 * 
 * @param {boolean} v True to disable, false to enable.
 */
function settingsSaveDisabled(v){
    settingsNavDone.disabled = v
}

/* Closes the settings view and saves all data. */
settingsNavDone.onclick = () => {
    saveSettingsValues()
    ConfigManager.save()
    switchView(getCurrentView(), VIEWS.landing)
}

/**
 * Account Management Tab
 */

// Bind the add account button.
document.getElementById('settingsAddAccount').onclick = (e) => {
    switchView(getCurrentView(), VIEWS.login, 500, 500, () => {
        loginViewOnCancel = VIEWS.settings
        loginViewOnSuccess = VIEWS.settings
        loginCancelEnabled(true)
    })
}

/**
 * Bind functionality for the account selection buttons. If another account
 * is selected, the UI of the previously selected account will be updated.
 */
function bindAuthAccountSelect(){
    Array.from(document.getElementsByClassName('settingsAuthAccountSelect')).map((val) => {
        val.onclick = (e) => {
            if(val.hasAttribute('selected')){
                return
            }
            const selectBtns = document.getElementsByClassName('settingsAuthAccountSelect')
            for(let i=0; i<selectBtns.length; i++){
                if(selectBtns[i].hasAttribute('selected')){
                    selectBtns[i].removeAttribute('selected')
                    selectBtns[i].innerHTML = 'Select Account'
                }
            }
            val.setAttribute('selected', '')
            val.innerHTML = 'Selected Account &#10004;'
            setSelectedAccount(val.closest('.settingsAuthAccount').getAttribute('uuid'))
        }
    })
}

/**
 * Bind functionality for the log out button. If the logged out account was
 * the selected account, another account will be selected and the UI will
 * be updated accordingly.
 */
function bindAuthAccountLogOut(){
    Array.from(document.getElementsByClassName('settingsAuthAccountLogOut')).map((val) => {
        val.onclick = (e) => {
            let isLastAccount = false
            if(Object.keys(ConfigManager.getAuthAccounts()).length === 1){
                isLastAccount = true
                setOverlayContent(
                    'Warning<br>This is Your Last Account',
                    'In order to use the launcher you must be logged into at least one account. You will need to login again after.<br><br>Are you sure you want to log out?',
                    'I\'m Sure',
                    'Cancel'
                )
                setOverlayHandler(() => {
                    processLogOut(val, isLastAccount)
                    switchView(getCurrentView(), VIEWS.login)
                    toggleOverlay(false)
                })
                setDismissHandler(() => {
                    toggleOverlay(false)
                })
                toggleOverlay(true, true)
            } else {
                processLogOut(val, isLastAccount)
            }
            
        }
    })
}

/**
 * Process a log out.
 * 
 * @param {Element} val The log out button element.
 * @param {boolean} isLastAccount If this logout is on the last added account.
 */
function processLogOut(val, isLastAccount){
    const parent = val.closest('.settingsAuthAccount')
    const uuid = parent.getAttribute('uuid')
    const prevSelAcc = ConfigManager.getSelectedAccount()
    AuthManager.removeAccount(uuid).then(() => {
        if(!isLastAccount && uuid === prevSelAcc.uuid){
            const selAcc = ConfigManager.getSelectedAccount()
            refreshAuthAccountSelected(selAcc.uuid)
            updateSelectedAccount(selAcc)
            validateSelectedAccount()
        }
    })
    $(parent).fadeOut(250, () => {
        parent.remove()
    })
}

/**
 * Refreshes the status of the selected account on the auth account
 * elements.
 * 
 * @param {string} uuid The UUID of the new selected account.
 */
function refreshAuthAccountSelected(uuid){
    Array.from(document.getElementsByClassName('settingsAuthAccount')).map((val) => {
        const selBtn = val.getElementsByClassName('settingsAuthAccountSelect')[0]
        if(uuid === val.getAttribute('uuid')){
            selBtn.setAttribute('selected', '')
            selBtn.innerHTML = 'Selected Account &#10004;'
        } else {
            if(selBtn.hasAttribute('selected')){
                selBtn.removeAttribute('selected')
            }
            selBtn.innerHTML = 'Select Account'
        }
    })
}

const settingsCurrentAccounts = document.getElementById('settingsCurrentAccounts')

/**
 * Add auth account elements for each one stored in the authentication database.
 */
function populateAuthAccounts(){
    const authAccounts = ConfigManager.getAuthAccounts()
    const authKeys = Object.keys(authAccounts)
    const selectedUUID = ConfigManager.getSelectedAccount().uuid

    let authAccountStr = ''

    authKeys.map((val) => {
        const acc = authAccounts[val]
        authAccountStr += `<div class="settingsAuthAccount" uuid="${acc.uuid}">
            <div class="settingsAuthAccountLeft">
                <img class="settingsAuthAccountImage" alt="${acc.displayName}" src="https://crafatar.com/renders/body/${acc.uuid}?scale=3&default=MHF_Steve&overlay">
            </div>
            <div class="settingsAuthAccountRight">
                <div class="settingsAuthAccountDetails">
                    <div class="settingsAuthAccountDetailPane">
                        <div class="settingsAuthAccountDetailTitle">Username</div>
                        <div class="settingsAuthAccountDetailValue">${acc.displayName}</div>
                    </div>
                    <div class="settingsAuthAccountDetailPane">
                        <div class="settingsAuthAccountDetailTitle">UUID</div>
                        <div class="settingsAuthAccountDetailValue">${acc.uuid}</div>
                    </div>
                </div>
                <div class="settingsAuthAccountActions">
                    <button class="settingsAuthAccountSelect" ${selectedUUID === acc.uuid ? 'selected>Selected Account &#10004;' : '>Select Account'}</button>
                    <div class="settingsAuthAccountWrapper">
                        <button class="settingsAuthAccountLogOut">Log Out</button>
                    </div>
                </div>
            </div>
        </div>`
    })

    settingsCurrentAccounts.innerHTML = authAccountStr
}

/**
 * Prepare the accounts tab for display.
 */
function prepareAccountsTab() {
    populateAuthAccounts()
    bindAuthAccountSelect()
    bindAuthAccountLogOut()
}

/**
 * Minecraft Tab
 */

/**
  * Disable decimals, negative signs, and scientific notation.
  */
document.getElementById('settingsGameWidth').addEventListener('keydown', (e) => {
    if(/^[-.eE]$/.test(e.key)){
        e.preventDefault()
    }
})
document.getElementById('settingsGameHeight').addEventListener('keydown', (e) => {
    if(/^[-.eE]$/.test(e.key)){
        e.preventDefault()
    }
})

/**
 * Java Tab
 */

// DOM Cache
const settingsMaxRAMRange     = document.getElementById('settingsMaxRAMRange')
const settingsMinRAMRange     = document.getElementById('settingsMinRAMRange')
const settingsMaxRAMLabel     = document.getElementById('settingsMaxRAMLabel')
const settingsMinRAMLabel     = document.getElementById('settingsMinRAMLabel')
const settingsMemoryTotal     = document.getElementById('settingsMemoryTotal')
const settingsMemoryAvail     = document.getElementById('settingsMemoryAvail')
const settingsJavaExecDetails = document.getElementById('settingsJavaExecDetails')
const settingsJavaExecVal     = document.getElementById('settingsJavaExecVal')
const settingsJavaExecSel     = document.getElementById('settingsJavaExecSel')

// Store maximum memory values.
const SETTINGS_MAX_MEMORY = ConfigManager.getAbsoluteMaxRAM()
const SETTINGS_MIN_MEMORY = ConfigManager.getAbsoluteMinRAM()

// Set the max and min values for the ranged sliders.
settingsMaxRAMRange.setAttribute('max', SETTINGS_MAX_MEMORY)
settingsMaxRAMRange.setAttribute('min', SETTINGS_MIN_MEMORY)
settingsMinRAMRange.setAttribute('max', SETTINGS_MAX_MEMORY)
settingsMinRAMRange.setAttribute('min', SETTINGS_MIN_MEMORY )

// Bind on change event for min memory container.
settingsMinRAMRange.onchange = (e) => {

    // Current range values
    const sMaxV = Number(settingsMaxRAMRange.getAttribute('value'))
    const sMinV = Number(settingsMinRAMRange.getAttribute('value'))

    // Get reference to range bar.
    const bar = e.target.getElementsByClassName('rangeSliderBar')[0]
    // Calculate effective total memory.
    const max = (os.totalmem()-1000000000)/1000000000

    // Change range bar color based on the selected value.
    if(sMinV >= max/2){
        bar.style.background = '#e86060'
    } else if(sMinV >= max/4) {
        bar.style.background = '#e8e18b'
    } else {
        bar.style.background = null
    }

    // Increase maximum memory if the minimum exceeds its value.
    if(sMaxV < sMinV){
        const sliderMeta = calculateRangeSliderMeta(settingsMaxRAMRange)
        updateRangedSlider(settingsMaxRAMRange, sMinV,
            ((sMinV-sliderMeta.min)/sliderMeta.step)*sliderMeta.inc)
        settingsMaxRAMLabel.innerHTML = sMinV.toFixed(1) + 'G'
    }

    // Update label
    settingsMinRAMLabel.innerHTML = sMinV.toFixed(1) + 'G'
}

// Bind on change event for max memory container.
settingsMaxRAMRange.onchange = (e) => {
    // Current range values
    const sMaxV = Number(settingsMaxRAMRange.getAttribute('value'))
    const sMinV = Number(settingsMinRAMRange.getAttribute('value'))

    // Get reference to range bar.
    const bar = e.target.getElementsByClassName('rangeSliderBar')[0]
    // Calculate effective total memory.
    const max = (os.totalmem()-1000000000)/1000000000

    // Change range bar color based on the selected value.
    if(sMaxV >= max/2){
        bar.style.background = '#e86060'
    } else if(sMaxV >= max/4) {
        bar.style.background = '#e8e18b'
    } else {
        bar.style.background = null
    }

    // Decrease the minimum memory if the maximum value is less.
    if(sMaxV < sMinV){
        const sliderMeta = calculateRangeSliderMeta(settingsMaxRAMRange)
        updateRangedSlider(settingsMinRAMRange, sMaxV,
            ((sMaxV-sliderMeta.min)/sliderMeta.step)*sliderMeta.inc)
        settingsMinRAMLabel.innerHTML = sMaxV.toFixed(1) + 'G'
    }
    settingsMaxRAMLabel.innerHTML = sMaxV.toFixed(1) + 'G'
}

/**
 * Calculate common values for a ranged slider.
 * 
 * @param {Element} v The range slider to calculate against. 
 * @returns {Object} An object with meta values for the provided ranged slider.
 */
function calculateRangeSliderMeta(v){
    const val = {
        max: Number(v.getAttribute('max')),
        min: Number(v.getAttribute('min')),
        step: Number(v.getAttribute('step')),
    }
    val.ticks = (val.max-val.min)/val.step
    val.inc = 100/val.ticks
    return val
}

/**
 * Binds functionality to the ranged sliders. They're more than
 * just divs now :').
 */
function bindRangeSlider(){
    Array.from(document.getElementsByClassName('rangeSlider')).map((v) => {

        // Reference the track (thumb).
        const track = v.getElementsByClassName('rangeSliderTrack')[0]

        // Set the initial slider value.
        const value = v.getAttribute('value')
        const sliderMeta = calculateRangeSliderMeta(v)

        updateRangedSlider(v, value, ((value-sliderMeta.min)/sliderMeta.step)*sliderMeta.inc)

        // The magic happens when we click on the track.
        track.onmousedown = (e) => {

            // Stop moving the track on mouse up.
            document.onmouseup = (e) => {
                document.onmousemove = null
                document.onmouseup = null
            }

            // Move slider according to the mouse position.
            document.onmousemove = (e) => {

                // Distance from the beginning of the bar in pixels.
                const diff = e.pageX - v.offsetLeft - track.offsetWidth/2
                
                // Don't move the track off the bar.
                if(diff >= 0 && diff <= v.offsetWidth-track.offsetWidth/2){

                    // Convert the difference to a percentage.
                    const perc = (diff/v.offsetWidth)*100
                    // Calculate the percentage of the closest notch.
                    const notch = Number(perc/sliderMeta.inc).toFixed(0)*sliderMeta.inc

                    // If we're close to that notch, stick to it.
                    if(Math.abs(perc-notch) < sliderMeta.inc/2){
                        updateRangedSlider(v, sliderMeta.min+(sliderMeta.step*(notch/sliderMeta.inc)), notch)
                    }
                }
            }
        }
    }) 
}

/**
 * Update a ranged slider's value and position.
 * 
 * @param {Element} element The ranged slider to update.
 * @param {string | number} value The new value for the ranged slider.
 * @param {number} notch The notch that the slider should now be at.
 */
function updateRangedSlider(element, value, notch){
    const oldVal = element.getAttribute('value')
    const bar = element.getElementsByClassName('rangeSliderBar')[0]
    const track = element.getElementsByClassName('rangeSliderTrack')[0]
    
    element.setAttribute('value', value)

    if(notch < 0){
        notch = 0
    } else if(notch > 100) {
        notch = 100
    }

    const event = new MouseEvent('change', {
        target: element,
        type: 'change',
        bubbles: false,
        cancelable: true
    })

    let cancelled = !element.dispatchEvent(event)

    if(!cancelled){
        track.style.left = notch + '%'
        bar.style.width = notch + '%'
    } else {
        element.setAttribute('value', oldVal)
    }
}

/**
 * Display the total and available RAM.
 */
function populateMemoryStatus(){
    settingsMemoryTotal.innerHTML = Number((os.totalmem()-1000000000)/1000000000).toFixed(1) + 'G'
    settingsMemoryAvail.innerHTML = Number(os.freemem()/1000000000).toFixed(1) + 'G'
}

// Bind the executable file input to the display text input.
settingsJavaExecSel.onchange = (e) => {
    settingsJavaExecVal.value = settingsJavaExecSel.files[0].path
    populateJavaExecDetails(settingsJavaExecVal.value)
}

/**
 * Validate the provided executable path and display the data on
 * the UI.
 * 
 * @param {string} execPath The executable path to populate against.
 */
function populateJavaExecDetails(execPath){
    AssetGuard._validateJavaBinary(execPath).then(v => {
        if(v.valid){
            settingsJavaExecDetails.innerHTML = `Selected: Java ${v.version.major} Update ${v.version.update} (x${v.arch})`
        } else {
            settingsJavaExecDetails.innerHTML = 'Invalid Selection'
        }
    })
}

/**
 * Prepare the Java tab for display.
 */
function prepareJavaTab(){
    bindRangeSlider()
    populateMemoryStatus()
}

/**
 * About Tab
 */

const settingsAboutCurrentVersionCheck = document.getElementById('settingsAboutCurrentVersionCheck')
const settingsAboutCurrentVersionTitle = document.getElementById('settingsAboutCurrentVersionTitle')
const settingsAboutCurrentVersionValue = document.getElementById('settingsAboutCurrentVersionValue')
const settingsChangelogTitle           = document.getElementById('settingsChangelogTitle')
const settingsChangelogText            = document.getElementById('settingsChangelogText')
const settingsChangelogButton          = document.getElementById('settingsChangelogButton')

// Bind the devtools toggle button.
document.getElementById('settingsAboutDevToolsButton').onclick = (e) => {
    let window = remote.getCurrentWindow()
    window.toggleDevTools()
}

/**
 * Retrieve the version information and display it on the UI.
 */
function populateVersionInformation(){
    const version = remote.app.getVersion()

    settingsAboutCurrentVersionValue.innerHTML = version
    const preRelComp = semver.prerelease(version)
    if(preRelComp != null && preRelComp.length > 0){
        settingsAboutCurrentVersionTitle.innerHTML = 'Pre-release'
        settingsAboutCurrentVersionTitle.style.color = '#ff886d'
        settingsAboutCurrentVersionCheck.style.background = '#ff886d'
    } else {
        settingsAboutCurrentVersionTitle.innerHTML = 'Stable Release'
        settingsAboutCurrentVersionTitle.style.color = null
        settingsAboutCurrentVersionCheck.style.background = null
    }
}

/**
 * Fetches the GitHub atom release feed and parses it for the release notes
 * of the current version. This value is displayed on the UI.
 */
function populateReleaseNotes(){
    $.ajax({
        url: 'https://github.com/WesterosCraftCode/ElectronLauncher/releases.atom',
        success: (data) => {
            const version = 'v' + remote.app.getVersion()
            const entries = $(data).find('entry')
            
            for(let i=0; i<entries.length; i++){
                const entry = $(entries[i])
                let id = entry.find('id').text()
                id = id.substring(id.lastIndexOf('/')+1)

                if(id === version){
                    settingsChangelogTitle.innerHTML = entry.find('title').text()
                    settingsChangelogText.innerHTML = entry.find('content').text()
                    settingsChangelogButton.href = entry.find('link').attr('href')
                }
            }

        },
        timeout: 2500
    }).catch(err => {
        settingsChangelogText.innerHTML = 'Failed to load release notes.'
    })
}

/**
 * Prepare account tab for display.
 */
function prepareAboutTab(){
    populateVersionInformation()
    populateReleaseNotes()
}


/**
 * Settings preparation functions.
 */

/**
  * Prepare the entire settings UI.
  * 
  * @param {boolean} first Whether or not it is the first load.
  */
function prepareSettings(first = false) {
    if(first){
        setupSettingsTabs()
        initSettingsValidators()
    }
    initSettingsValues()
    prepareAccountsTab()
    prepareJavaTab()
    prepareAboutTab()
}

// Prepare the settings UI on startup.
prepareSettings(true)