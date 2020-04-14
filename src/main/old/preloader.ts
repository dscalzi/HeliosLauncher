import { ConfigManager } from '../config/configmanager'
import { DistroManager, DistributionWrapper } from './distromanager'
import { join } from 'path'
import { remove } from 'fs-extra'
import { loadLanguage } from './langloader'
import { LoggerUtil } from './loggerutil'
import { tmpdir } from 'os'
import { ipcRenderer } from 'electron'

const logger        = new LoggerUtil('%c[Preloader]', 'color: #a02d2a; font-weight: bold')

logger.log('Loading..')

// Load ConfigManager
ConfigManager.load()

// Load Strings
loadLanguage('en_US')

function onDistroLoad(data: DistributionWrapper | null){
    if(data != null){
        
        // Resolve the selected server if its value has yet to be set.
        if(ConfigManager.getSelectedServer() == null || data.getServer(ConfigManager.getSelectedServer()!) == null){
            logger.log('Determining default selected server..')
            // TODO what if undefined
            ConfigManager.setSelectedServer(data.getMainServer()!.server.id as string)
            ConfigManager.save()
        }
    }
    ipcRenderer.send('distributionIndexDone', data != null)
}

// Ensure Distribution is downloaded and cached.
DistroManager.pullRemote().then((data) => {
    logger.log('Loaded distribution index.')

    onDistroLoad(data)

}).catch((err) => {
    logger.log('Failed to load distribution index.')
    logger.error(err)

    logger.log('Attempting to load an older version of the distribution index.')
    // Try getting a local copy, better than nothing.
    DistroManager.pullLocal().then((data) => {
        logger.log('Successfully loaded an older version of the distribution index.')

        onDistroLoad(data)


    }).catch((err) => {

        logger.log('Failed to load an older version of the distribution index.')
        logger.log('Application cannot run.')
        logger.error(err)

        onDistroLoad(null)

    })

})

// Clean up temp dir incase previous launches ended unexpectedly. 
remove(join(tmpdir(), ConfigManager.getTempNativeFolder()), (err) => {
    if(err){
        logger.warn('Error while cleaning natives directory', err)
    } else {
        logger.log('Cleaned natives directory.')
    }
})
