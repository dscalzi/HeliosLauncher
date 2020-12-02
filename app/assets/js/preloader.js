const { ipcRenderer } = require('electron')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')

const ConfigManager = require('./configmanager')
const DistroManager = require('./distromanager')
const LangLoader = require('./langloader')
const logger = require('./loggerutil')('%c[Preloader]', 'color: #a02d2a; font-weight: bold')

logger.log('Loading..')

// Load ConfigManager
ConfigManager.load()

// Load Strings
LangLoader.loadLanguage('en_US')

function onDistroLoad(data) {
    if (data != null) {

        // Resolve the selected server if its value has yet to be set.
        if (ConfigManager.getSelectedServer() == null || data.getServer(ConfigManager.getSelectedServer()) == null) {
            logger.log('Determination du serveur par default..')
            ConfigManager.setSelectedServer(data.getMainServer().getID())
            ConfigManager.save()
        }
    }
    ipcRenderer.send('distributionIndexDone', data != null)
}

// Ensure Distribution is downloaded and cached.
DistroManager.pullRemote().then((data) => {
    logger.log('Index de distribution chargé.')

    onDistroLoad(data)

}).catch((err) => {
    logger.log('Impossible de charger une ancienne version de distribution.')
    logger.error(err)

    logger.log('Attempting to load an older version of the distribution index.')
        // Try getting a local copy, better than nothing.
    DistroManager.pullLocal().then((data) => {
        logger.log('Une ancienne version du fichier de distribution a été chargé avec succes')

        onDistroLoad(data)


    }).catch((err) => {

        logger.log('Impossible de charger une ancienne version de distribution.')
        logger.log('L\'application de peux pas demaré.')
        logger.error(err)

        onDistroLoad(null)

    })

})

// Clean up temp dir incase previous launches ended unexpectedly. 
fs.remove(path.join(os.tmpdir(), ConfigManager.getTempNativeFolder()), (err) => {
    if (err) {
        logger.warn('Erreur durant le nettoyage du dossier des natives', err)
    } else {
        logger.log('Dossier des natives nettoyé.')
    }
})