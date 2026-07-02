/**
 * Script for welcome.ejs — сразу на экран входа ник+код.
 */
document.getElementById('welcomeButton').addEventListener('click', e => {
    loginCancelEnabled(false) // Отменять нечего — другого способа входа нет.
    loginViewOnSuccess = VIEWS.landing
    switchView(VIEWS.welcome, VIEWS.login)
})
