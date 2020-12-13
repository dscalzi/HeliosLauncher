const {ipcRenderer} = require('electron')
const fs            = require('fs-extra')
const os            = require('os')
const path          = require('path')

const ConfigManager = require('./configmanager')
const DistroManager = require('./distromanager')
const LangLoader    = require('./langloader')
const logger        = require('./loggerutil')('%c[Preloader]', 'color: #a02d2a; font-weight: bold')

logger.log('Yükleniyor..')

// Load ConfigManager
ConfigManager.load()

// Load Strings
LangLoader.loadLanguage('en_US')

function onDistroLoad(data){
    if(data != null){
        
        // Resolve the selected server if its value has yet to be set.
        if(ConfigManager.getSelectedServer() == null || data.getServer(ConfigManager.getSelectedServer()) == null){
            logger.log('Varsayılan sunucuyu belirle..')
            ConfigManager.setSelectedServer(data.getMainServer().getID())
            ConfigManager.save()
        }
    }
    ipcRenderer.send('distributionIndexDone', data != null)
}

// Ensure Distribution is downloaded and cached.
DistroManager.pullRemote().then((data) => {
    logger.log('Dağıtım verisi yüklendi.')

    onDistroLoad(data)

}).catch((err) => {
    logger.log('Dağıtım verisi yüklenemedi.')
    logger.error(err)

    logger.log('Dağtım verisinin daha eski versiyonu indirilmeye çalışılıyor.')
    // Try getting a local copy, better than nothing.
    DistroManager.pullLocal().then((data) => {
        logger.log('Dağıtım verisinin eski versiyonu başarıyla indirildi')

        onDistroLoad(data)


    }).catch((err) => {

        logger.log('Dağıtım verisinin eski versiyonu indirlemedi.')
        logger.log('Uygulama çalışamaz durumda.')
        logger.error(err)

        onDistroLoad(null)

    })

})

// Clean up temp dir incase previous launches ended unexpectedly. 
fs.remove(path.join(os.tmpdir(), ConfigManager.getTempNativeFolder()), (err) => {
    if(err){
        logger.warn('Ana klasör temizlerken bir hata oldu', err)
    } else {
        logger.log('Ana klasör temizlendi.')
    }
})