/**
 * Script for loginOffline.ejs
 */
// Validation Regexes.
const validOfflineUsername         = /^[a-zA-Z0-9_]{3,16}$/
// Login Elements
const loginOfflineCancelButton     = document.getElementById('loginOfflineCancelButton')
const loginOfflineUsername         = document.getElementById('loginOfflineUsername')
const loginOfflineButton           = document.getElementById('loginOfflineButton')
const loginOfflineForm             = document.getElementById('loginOfflineForm')


// Control variables.
let lu2 = false, lp2  = false

const loggerOfflineLogin = LoggerUtil.getLogger('loginOffline')

/**
 * Validate the offline username.
 *
 * @param {string} value The username value.
 */
function validateUsername(value){
    if(value){
        if(!validOfflineUsername.test(value)){
            loginOfflineDisabled(true)
            lu2 = false
        } else {
            lu2 = true
            loginOfflineDisabled(false)
        }
    } else {
        lu2 = false
        loginOfflineDisabled(true)
    }
}


// Emphasize errors with shake when focus is lost.
loginOfflineUsername.addEventListener('focusout', (e) => {
    validateUsername(e.target.value)
})

// Validate input for each field.
loginOfflineUsername.addEventListener('input', (e) => {
    validateUsername(e.target.value)
})

/**
 * Enable or disable the login button.
 *
 * @param {boolean} v True to enable, false to disable.
 */
function loginOfflineDisabled(v){
    if(loginOfflineButton.disabled !== v){
        loginOfflineButton.disabled = v
    }
}

/**
 * Enable or disable loading elements.
 *
 * @param {boolean} v True to enable, false to disable.
 */
function offlineLoginLoading(v){
    if(v){
        loginOfflineButton.setAttribute('loading', v)
        loginOfflineButton.innerHTML = loginOfflineButton.innerHTML.replace(Lang.queryJS('login.login'), Lang.queryJS('login.loggingIn'))
    } else {
        loginOfflineButton.removeAttribute('loading')
        loginOfflineButton.innerHTML = loginOfflineButton.innerHTML.replace(Lang.queryJS('login.loggingIn'), Lang.queryJS('login.login'))
    }
}

let loginOfflineViewOnSuccess = VIEWS.landing

loginOfflineCancelButton.onclick = (e) => {
    console.log("Clicou")
    switchView(getCurrentView(), VIEWS.loginOptions, 500, 500, () => {
        loginOfflineUsername.value = ''
        loginPassword.value = ''
    })
}

// Disable default form behavior.
loginOfflineForm.onsubmit = () => { return false }

// Bind login button behavior.
loginOfflineButton.addEventListener('click', () => {

    // Disable form.
    formDisabled(true)

    AuthManagerOffline.addOfflineAccount(loginOfflineUsername.value).then((value) => {
        updateSelectedAccount(value)
        loginOfflineButton.innerHTML = loginOfflineButton.innerHTML.replace(Lang.queryJS('login.loggingIn'), Lang.queryJS('login.success'))
        $('.circle-loader').toggleClass('load-complete')
        $('.checkmark').toggle()
        setTimeout(() => {
            switchView(VIEWS.loginOffline, loginOfflineViewOnSuccess, 500, 500, () => {
                // Temporary workaround
                if(loginOfflineViewOnSuccess === VIEWS.settings){
                    prepareSettings()
                }
                loginOfflineViewOnSuccess = VIEWS.landing // Reset this for good measure.
                loginOfflineUsername.value = ''
                loginPassword.value = ''
                $('.circle-loader').toggleClass('load-complete')
                $('.checkmark').toggle()
                offlineLoginLoading(false)
                loginOfflineButton.innerHTML = loginOfflineButton.innerHTML.replace(Lang.queryJS('login.success'), Lang.queryJS('login.login'))
            })
        }, 1000)
    })

})