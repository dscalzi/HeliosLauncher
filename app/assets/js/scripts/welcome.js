/**
 * Script for welcome.ejs
 */
document.getElementById('welcomeButton').addEventListener('click', e => {
    $('#welcomeContainer').fadeOut(500, () => {
        $('#loginContainer').fadeIn(500)
    })
})