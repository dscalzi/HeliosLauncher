/**
 * Script for welcome.ejs
 */
document.getElementById('welcomeButton').addEventListener('click', e => {
    switchView(VIEWS.welcome, VIEWS.login)
})