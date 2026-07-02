const { DistributionAPI } = require('helios-core/common')

const ConfigManager = require('./configmanager')

// Манифест дистрибутива «Пепел Эдема».
// Дев-режим: локальный сервер (python -m http.server 8080 --directory C:\Users\user\pepel-distro).
// TODO: заменить на боевой URL, когда появится хостинг.
exports.REMOTE_DISTRO_URL = 'http://localhost:8080/distribution.json'

const api = new DistributionAPI(
    ConfigManager.getLauncherDirectory(),
    null, // Injected forcefully by the preloader.
    null, // Injected forcefully by the preloader.
    exports.REMOTE_DISTRO_URL,
    false
)

exports.DistroAPI = api