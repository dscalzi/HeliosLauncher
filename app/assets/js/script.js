const remote = require('electron').remote;

document.addEventListener("keydown", function (e) {
    if (e.keyCode === 123) { // F12
        var window = remote.getCurrentWindow();
        window.toggleDevTools();
    }
});