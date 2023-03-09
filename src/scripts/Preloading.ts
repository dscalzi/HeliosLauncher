import { ipcRenderer } from "electron";
import { remove } from "fs-extra";
import { LoggerUtil } from "helios-core/.";
import { ConfigManager } from "../manager/ConfigManager";
import { DistroManager } from "../manager/DistroManager";
import { join } from 'path';
import os from 'os';
import { LangLoader } from "./LangLoader";

const logger = LoggerUtil.getLogger('Preloader')
logger.info('Loading..')


// Load ConfigManager
ConfigManager.load()

// Load Strings
LangLoader.loadLanguage('en_US')

function onDistroLoad(data) {
    if (data != null) {

        // Resolve the selected server if its value has yet to be set.
        if (ConfigManager.getSelectedServer() == null || data.getServer(ConfigManager.getSelectedServer()) == null) {
            logger.info('Determining default selected server..')
            ConfigManager.selectedServer = data.getMainServer().getID();
            ConfigManager.save()
        }
    }
    ipcRenderer.send('distributionIndexDone', data != null)
}

// Ensure Distribution is downloaded and cached.
DistroManager.pullRemote().then((data) => {
    logger.info('Loaded distribution index.')

    onDistroLoad(data)

}).catch((err) => {
    logger.info('Failed to load distribution index.')
    logger.error(err)

    logger.info('Attempting to load an older version of the distribution index.')
    // Try getting a local copy, better than nothing.
    DistroManager.pullLocal().then((data) => {
        logger.info('Successfully loaded an older version of the distribution index.')

        onDistroLoad(data)


    }).catch((err) => {

        logger.info('Failed to load an older version of the distribution index.')
        logger.info('Application cannot run.')
        logger.error(err)

        onDistroLoad(null)

    })

})

// Clean up temp dir incase previous launches ended unexpectedly. 
remove(join(os.tmpdir(), ConfigManager.tempNativeFolder), (err) => {
    if (err) {
        logger.warn('Error while cleaning natives directory', err)
    } else {
        logger.info('Cleaned natives directory.')
    }
})