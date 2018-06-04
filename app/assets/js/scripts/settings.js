const settingsNavDone         = document.getElementById('settingsNavDone')

// Account Management Tab
const settingsAddAccount      = document.getElementById('settingsAddAccount')
const settingsCurrentAccounts = document.getElementById('settingsCurrentAccounts')

// Minecraft Tab
const settingsGameWidth       = document.getElementById('settingsGameWidth')
const settingsGameHeight      = document.getElementById('settingsGameHeight')

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
                   v.value = gFn()
                } else if(v.type === 'checkbox'){
                    v.checked = gFn()
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
                   sFn(v.value)
                } else if(v.type === 'checkbox'){
                    sFn(v.checked)
                }
            }
        }
    })
}

let selectedTab = 'settingsTabAccount'

/**
 * Bind functionality for the settings navigation items.
 */
function setupSettingsTabs(){
    Array.from(document.getElementsByClassName('settingsNavItem')).map((val) => {
        val.onclick = (e) => {
            if(val.hasAttribute('selected')){
                return
            }
            const navItems = document.getElementsByClassName('settingsNavItem')
            for(let i=0; i<navItems.length; i++){
                if(navItems[i].hasAttribute('selected')){
                    navItems[i].removeAttribute('selected')
                }
            }
            val.setAttribute('selected', '')
            let prevTab = selectedTab
            selectedTab = val.getAttribute('rSc')
            $(`#${prevTab}`).fadeOut(250, () => {
                $(`#${selectedTab}`).fadeIn(250)
            })
        }
    })
}

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
settingsAddAccount.onclick = (e) => {
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

/**
 * Add auth account elements for each one stored in the authentication database.
 */
function populateAuthAccounts(){
    const authAccounts = ConfigManager.getAuthAccounts()
    const authKeys = Object.keys(authAccounts)
    const selectedUUID = ConfigManager.getSelectedAccount().uuid

    let authAccountStr = ``

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
                        <div class="settingsAuthAccountDetailTitle">${acc.displayName === acc.username ? 'UUID' : 'Email'}</div>
                        <div class="settingsAuthAccountDetailValue">${acc.displayName === acc.username ? acc.uuid : acc.username}</div>
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
settingsGameWidth.addEventListener('keydown', (e) => {
    if(/[-\.eE]/.test(e.key)){
        e.preventDefault()
    }
})
settingsGameHeight.addEventListener('keydown', (e) => {
    if(/[-\.eE]/.test(e.key)){
        e.preventDefault()
    }
})

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
}

// Prepare the settings UI on startup.
prepareSettings(true)