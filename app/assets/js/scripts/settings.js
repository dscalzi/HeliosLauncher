const settingsAddAccount      = document.getElementById('settingsAddAccount')
const settingsCurrentAccounts = document.getElementById('settingsCurrentAccounts')

/**
 * General Settings Functions
 */

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
            ConfigManager.setSelectedAccount(val.closest('.settingsAuthAccount').getAttribute('uuid'))
            ConfigManager.save()
            updateSelectedAccount(ConfigManager.getSelectedAccount())
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
            const parent = val.closest('.settingsAuthAccount')
            const uuid = parent.getAttribute('uuid')
            const prevSelAcc = ConfigManager.getSelectedAccount()
            AuthManager.removeAccount(uuid).then(() => {
                if(uuid === prevSelAcc.uuid){
                    const selAcc = ConfigManager.getSelectedAccount()
                    refreshAuthAccountSelected(selAcc.uuid)
                    updateSelectedAccount(selAcc)
                }
            })
            $(parent).fadeOut(250, () => {
                parent.remove()
            })
        }
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
 * Settings preparation functions.
 */

 /**
  * Prepare the entire settings UI.
  */
function prepareSettings() {
    setupSettingsTabs()
    prepareAccountsTab()
}

// Prepare the settings UI on startup.
prepareSettings()