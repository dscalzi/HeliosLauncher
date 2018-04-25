// DOM cache.
const welcomeButton = document.getElementById('welcomeButton')

welcomeButton.addEventListener('click', e => {
    $('#welcomeContainer').fadeOut(500, () => {
        $('#loginContainer').fadeIn(500)
    })
})