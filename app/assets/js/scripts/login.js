//const validEmail = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i

// Validation Regexes.
const validUsername = /^[a-zA-Z0-9_]{1,16}$/
const basicEmail = /^\S+@\S+\.\S+$/

// DOM cache.
const loginContainer = document.getElementById('loginContainer')
const loginErrorTitle = document.getElementById('loginErrorTitle')
const loginErrorDesc = document.getElementById('loginErrorDesc')
const loginErrorAcknowledge = document.getElementById('loginErrorAcknowledge')

const loginEmailError = document.getElementById('loginEmailError')
const loginUsername = document.getElementById('loginUsername')
const loginPasswordError = document.getElementById('loginPasswordError')
const loginPassword = document.getElementById('loginPassword')
const checkmarkContainer = document.getElementById('checkmarkContainer')
const loginRememberOption = document.getElementById('loginRememberOption')
const loginButton = document.getElementById('loginButton')

// Control variables.
let lu = false, lp = false

// Show error element.
function showError(element, value){
    element.innerHTML = value
    element.style.opacity = 1
}

// Shake error element.
function shakeError(element){
    if(element.style.opacity == 1){
        element.classList.remove('shake')
        void element.offsetWidth
        element.classList.add('shake')
    }
}

// Validate email field is neither empty nor invalid.
function validateEmail(value){
    if(value){
        if(!basicEmail.test(value) && !validUsername.test(value)){
            showError(loginEmailError, '* Invalid Value')
            loginDisabled(true)
            lu = false
        } else {
            loginEmailError.style.opacity = 0
            lu = true
            if(lp){
                loginDisabled(false)
            }
        }
    } else {
        lu = false
        showError(loginEmailError, '* Required')
        loginDisabled(true)
    }
}

// Validate password field is not empty.
function validatePassword(value){
    if(value){
        loginPasswordError.style.opacity = 0
        lp = true
        if(lu){
            loginDisabled(false)
        }
    } else {
        lp = false
        showError(loginPasswordError, '* Required')
        loginDisabled(true)
    }
}

// Emphasize errors with shake when focus is lost.
loginUsername.addEventListener('focusout', (e) => {
    validateEmail(e.target.value)
    shakeError(loginEmailError)
})
loginPassword.addEventListener('focusout', (e) => {
    validatePassword(e.target.value)
    shakeError(loginPasswordError)
})

// Validate input for each field.
loginUsername.addEventListener('input', (e) => {
    validateEmail(e.target.value)
})
loginPassword.addEventListener('input', (e) => {
    validatePassword(e.target.value)
})

// Enable or disable login button.
function loginDisabled(v){
    if(loginButton.disabled !== v){
        loginButton.disabled = v
    }
}

// Enable or disable loading elements.
function loginLoading(v){
    if(v){
        loginButton.setAttribute('loading', v)
        loginButton.innerHTML = loginButton.innerHTML.replace('LOGIN', 'LOGGING IN')
    } else {
        loginButton.removeAttribute('loading')
        loginButton.innerHTML = loginButton.innerHTML.replace('LOGGING IN', 'LOGIN')
    }
}

// Disable or enable login form.
function formDisabled(v){
    loginDisabled(v)
    loginUsername.disabled = v
    loginPassword.disabled = v
    if(v){
        checkmarkContainer.setAttribute('disabled', v)
    } else {
        checkmarkContainer.removeAttribute('disabled')
    }
    loginRememberOption.disabled = v
}

function resolveError(err){
    // Mojang Response => err.cause | err.error | err.errorMessage
    // Node error => err.code | err.message
    if(err.cause != null && err.cause === 'UserMigratedException') {
        return {
            title: 'Error During Login:<br>Invalid Credentials',
            desc: 'You\'ve attempted to login with a migrated account. Try again using the account email as the username.'
        }
    } else {
        if(err.error != null){
            if(err.error === 'ForbiddenOperationException'){
                if(err.errorMessage != null){
                    if(err.errorMessage === 'Invalid credentials. Invalid username or password.'){
                        return {
                            title: 'Error During Login:<br>Invalid Credentials',
                            desc: 'The email or password you\'ve entered is incorrect. Please try again.'
                        }
                    } else if(err.errorMessage === 'Invalid credentials.'){
                        return {
                            title: 'Error During Login:<br>Too Many Attempts',
                            desc: 'There have been too many login attempts with this account recently. Please try again later.'
                        }
                    }
                }
            }
        } else {
            // Request errors (from Node).
            if(err.code != null){
                if(err.code === 'ENOENT'){
                    // No Internet.
                    return {
                        title: 'Error During Login:<br>No Internet Connection',
                        desc: 'You must be connected to the internet in order to login. Please connect and try again.'
                    }
                } else if(err.code === 'ENOTFOUND'){
                    // Could not reach server.
                    return {
                        title: 'Error During Login:<br>Authentication Server Offline',
                        desc: 'Mojang\'s authentication server is currently offline or unreachable. Please wait a bit and try again. You can check the status of the server on <a href="https://help.mojang.com/">Mojang\'s help portal</a>.'
                    }
                }
            }
        }
    }
    if(err.message != null){
        // Unknown error with request.
        return {
            title: 'Error During Login:<br>Unknown Error',
            desc: err.message
        }
    } else {
        // Unknown Mojang error.
        return {
            title: err.error,
            desc: err.errorMessage
        }
    }
}

loginButton.addEventListener('click', () => {
    // Disable form.
    formDisabled(true)

    // Show loading stuff.
    loginLoading(true)

    AuthManager.addAccount(loginUsername.value, loginPassword.value).then((value) => {
        loginButton.innerHTML = loginButton.innerHTML.replace('LOGGING IN', 'SUCCESS')
        $('.circle-loader').toggleClass('load-complete')
        $('.checkmark').toggle()
        //console.log(value)
        setTimeout(() => {
            $('#loginContainer').fadeOut(500, () => {
                $('#landingContainer').fadeIn(500)
            })
        }, 1000)
    }).catch((err) => {
        loginLoading(false)
        const errF = resolveError(err)
        setOverlayContent(errF.title, errF.desc, 'Try Again')
        setOverlayHandler(() => {
            formDisabled(false)
            toggleOverlay(false)
        })
        toggleOverlay(true)
        console.log(err)
    })

})