/**
 * Script for welcome.ejs
 */
document.getElementById('welcomeButton').addEventListener('click', e => {
    switchView(VIEWS.welcome, VIEWS.login)
    if(hasRPC){
        DiscordWrapper.updateDetails('Adding an Account...')
        DiscordWrapper.updateState('Launcher Setup')
    }
})