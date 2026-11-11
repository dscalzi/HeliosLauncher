const loginOptionsCancelContainer = document.getElementById('loginOptionCancelContainer')
const loginOptionMicrosoft = document.getElementById('loginOptionMicrosoft')
const loginOptionMojang = document.getElementById('loginOptionMojang')
const loginOptionsCancelButton = document.getElementById('loginOptionCancelButton')
const waitingCancelButton = document.getElementById('waitingCancelButton')

let loginOptionsCancellable = false

let loginOptionsViewOnLoginSuccess
let loginOptionsViewOnLoginCancel
let loginOptionsViewOnCancel
let loginOptionsViewCancelHandler

function loginOptionsCancelEnabled(val){
    if (!loginOptionsCancelContainer) {
        return
    }

    if(val){
        $(loginOptionsCancelContainer).show()
    } else {
        $(loginOptionsCancelContainer).hide()
    }
}

if (loginOptionMicrosoft) {
    loginOptionMicrosoft.onclick = (e) => {
        switchView(getCurrentView(), VIEWS.waiting, 500, 500, () => {
            ipcRenderer.send(
                MSFT_OPCODE.OPEN_LOGIN,
                loginOptionsViewOnLoginSuccess,
                loginOptionsViewOnLoginCancel
            )
        })
    }
}

if (loginOptionMojang) {
    loginOptionMojang.onclick = (e) => {
        switchView(getCurrentView(), VIEWS.login, 500, 500, () => {
            loginViewOnSuccess = loginOptionsViewOnLoginSuccess
            loginViewOnCancel = loginOptionsViewOnLoginCancel
            loginCancelEnabled(true)
        })
    }
}

if (waitingCancelButton) {
    waitingCancelButton.onclick = () => {
        ipcRenderer.send(MSFT_OPCODE.CANCEL_LOGIN)
    }
}

if (loginOptionsCancelButton) {
    loginOptionsCancelButton.onclick = (e) => {
        switchView(getCurrentView(), loginOptionsViewOnCancel, 500, 500, () => {
            // Clear login values (Mojang login)
            // No cleanup needed for Microsoft.
            loginUsername.value = ''
            loginPassword.value = ''
            if(loginOptionsViewCancelHandler != null){
                loginOptionsViewCancelHandler()
                loginOptionsViewCancelHandler = null
            }
        })
    }
}