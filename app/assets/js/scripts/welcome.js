/**
 * @author Daniel D. Scalzi
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0/
 */

/**
 * Script for welcome.ejs
 */
document.getElementById('welcomeButton').addEventListener('click', e => {
    loginOptionsCancelEnabled(false) // False by default, be explicit.
    loginOptionsViewOnLoginSuccess = VIEWS.landing
    loginOptionsViewOnLoginCancel = VIEWS.loginOptions
    switchView(VIEWS.welcome, VIEWS.loginOptions)
})