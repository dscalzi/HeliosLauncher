/**
 * Script for login.ejs — вход по нику и коду доступа «Пепел Эдема».
 */
// Validation Regexes.
const validUsername         = /^[a-zA-Z0-9_]{3,16}$/
const validAccessCode       = /^PEPEL-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/

const pepelLoginLogger      = LoggerUtil.getLogger('Вход Пепел')

// Login Elements
const loginCancelContainer  = document.getElementById('loginCancelContainer')
const loginCancelButton     = document.getElementById('loginCancelButton')
const loginNickError        = document.getElementById('loginNickError')
const loginNick             = document.getElementById('loginNick')
const loginCodeError        = document.getElementById('loginCodeError')
const loginCode             = document.getElementById('loginCode')
const checkmarkContainer    = document.getElementById('checkmarkContainer')
const loginConsentOption    = document.getElementById('loginConsentOption')
const loginButton           = document.getElementById('loginButton')
const loginForm             = document.getElementById('loginForm')

// Control variables.
let lu = false, lp = false

/**
 * Show a login error.
 *
 * @param {HTMLElement} element The element on which to display the error.
 * @param {string} value The error text.
 */
function showError(element, value){
    element.innerHTML = value
    element.style.opacity = 1
}

/**
 * Shake a login error to add emphasis.
 *
 * @param {HTMLElement} element The element to shake.
 */
function shakeError(element){
    if(element.style.opacity == 1){
        element.classList.remove('shake')
        void element.offsetWidth
        element.classList.add('shake')
    }
}

/**
 * Проверить поле ника: 3–16 символов, латиница/цифры/подчёркивание.
 *
 * @param {string} value The nick value.
 */
function validateNick(value){
    if(value){
        if(!validUsername.test(value)){
            showError(loginNickError, Lang.queryJS('login.error.invalidNick'))
            loginDisabled(true)
            lu = false
        } else {
            loginNickError.style.opacity = 0
            lu = true
            updateLoginButton()
        }
    } else {
        lu = false
        showError(loginNickError, Lang.queryJS('login.error.requiredValue'))
        loginDisabled(true)
    }
}

/**
 * Проверить поле кода доступа: формат PEPEL-XXXX-XXXX.
 *
 * @param {string} value The access code value.
 */
function validateCode(value){
    if(value){
        if(!validAccessCode.test(value.trim().toUpperCase())){
            showError(loginCodeError, Lang.queryJS('login.error.invalidCode'))
            loginDisabled(true)
            lp = false
        } else {
            loginCodeError.style.opacity = 0
            lp = true
            updateLoginButton()
        }
    } else {
        lp = false
        showError(loginCodeError, Lang.queryJS('login.error.invalidValue'))
        loginDisabled(true)
    }
}

/**
 * Кнопка входа активна, когда валидны оба поля и принято согласие.
 */
function updateLoginButton(){
    loginDisabled(!(lu && lp && loginConsentOption.checked))
}

// Emphasize errors with shake when focus is lost.
loginNick.addEventListener('focusout', (e) => {
    validateNick(e.target.value)
    shakeError(loginNickError)
})
loginCode.addEventListener('focusout', (e) => {
    validateCode(e.target.value)
    shakeError(loginCodeError)
})

// Validate input for each field.
loginNick.addEventListener('input', (e) => {
    validateNick(e.target.value)
})
loginCode.addEventListener('input', (e) => {
    validateCode(e.target.value)
})
loginConsentOption.addEventListener('change', () => {
    updateLoginButton()
})

/**
 * Enable or disable the login button.
 *
 * @param {boolean} v True to enable, false to disable.
 */
function loginDisabled(v){
    if(loginButton.disabled !== v){
        loginButton.disabled = v
    }
}

/**
 * Enable or disable loading elements.
 *
 * @param {boolean} v True to enable, false to disable.
 */
function loginLoading(v){
    if(v){
        loginButton.setAttribute('loading', v)
        loginButton.innerHTML = loginButton.innerHTML.replace(Lang.queryJS('login.login'), Lang.queryJS('login.loggingIn'))
    } else {
        loginButton.removeAttribute('loading')
        loginButton.innerHTML = loginButton.innerHTML.replace(Lang.queryJS('login.loggingIn'), Lang.queryJS('login.login'))
    }
}

/**
 * Enable or disable login form.
 *
 * @param {boolean} v True to enable, false to disable.
 */
function formDisabled(v){
    loginDisabled(v)
    loginCancelButton.disabled = v
    loginNick.disabled = v
    loginCode.disabled = v
    if(v){
        checkmarkContainer.setAttribute('disabled', v)
    } else {
        checkmarkContainer.removeAttribute('disabled')
    }
    loginConsentOption.disabled = v
}

let loginViewOnSuccess = VIEWS.landing
let loginViewOnCancel = VIEWS.settings
let loginViewCancelHandler

function loginCancelEnabled(val){
    if(val){
        $(loginCancelContainer).show()
    } else {
        $(loginCancelContainer).hide()
    }
}

loginCancelButton.onclick = (e) => {
    switchView(getCurrentView(), loginViewOnCancel, 500, 500, () => {
        loginNick.value = ''
        loginCode.value = ''
        loginCancelEnabled(false)
        if(loginViewCancelHandler != null){
            loginViewCancelHandler()
            loginViewCancelHandler = null
        }
    })
}

// Disable default form behavior.
loginForm.onsubmit = () => { return false }

// Bind login button behavior.
loginButton.addEventListener('click', () => {
    // Disable form.
    formDisabled(true)

    // Show loading stuff.
    loginLoading(true)

    AuthManager.addPepelAccount(loginNick.value, loginCode.value).then((value) => {
        updateSelectedAccount(value)
        loginButton.innerHTML = loginButton.innerHTML.replace(Lang.queryJS('login.loggingIn'), Lang.queryJS('login.success'))
        $('.circle-loader').toggleClass('load-complete')
        $('.checkmark').toggle()
        setTimeout(() => {
            switchView(VIEWS.login, loginViewOnSuccess, 500, 500, async () => {
                // Temporary workaround
                if(loginViewOnSuccess === VIEWS.settings){
                    await prepareSettings()
                }
                loginViewOnSuccess = VIEWS.landing // Reset this for good measure.
                loginCancelEnabled(false) // Reset this for good measure.
                loginViewCancelHandler = null // Reset this for good measure.
                loginNick.value = ''
                loginCode.value = ''
                $('.circle-loader').toggleClass('load-complete')
                $('.checkmark').toggle()
                loginLoading(false)
                loginButton.innerHTML = loginButton.innerHTML.replace(Lang.queryJS('login.success'), Lang.queryJS('login.login'))
                formDisabled(false)
            })
        }, 1000)
    }).catch((displayableError) => {
        loginLoading(false)

        let actualDisplayableError
        if(isDisplayableError(displayableError)) {
            pepelLoginLogger.error('Ошибка входа.', displayableError)
            actualDisplayableError = displayableError
        } else {
            // Uh oh.
            pepelLoginLogger.error('Необработанная ошибка входа.', displayableError)
            actualDisplayableError = Lang.queryJS('login.error.unknown')
        }

        setOverlayContent(actualDisplayableError.title, actualDisplayableError.desc, Lang.queryJS('login.tryAgain'))
        setOverlayHandler(() => {
            formDisabled(false)
            toggleOverlay(false)
        })
        toggleOverlay(true)
    })

})
