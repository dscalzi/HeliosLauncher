const { contextBridge, ipcRenderer } = require('electron')

module.exports.api = {
    os: {
        totalmem: () => ipcRenderer.invoke('os.totalmem'),
        freemem: () => ipcRenderer.invoke('os.freemem')
    },
    semver: {
        prerelease: (version) => ipcRenderer.invoke('semver.prerelease', version)
    },
    path: {
        join: (...args) => ipcRenderer.invoke('path.join', args)
    },
    app: {
        isDev: () => ipcRenderer.invoke('app.isDev'),
        getVersion: () => ipcRenderer.invoke('app.getVersion')
    },
    shell: {
        openExternal: (url) => ipcRenderer.invoke('shell.openExternal', url),
        openPath: (path) => ipcRenderer.invoke('shell.openPath', path),
    },
    xwindow: {
        close: () => ipcRenderer.invoke('xwindow.close'),
        setProgressBar: (progress) => ipcRenderer.invoke('xwindow.setProgressBar', progress),
        toggleDevTools: () => {
            console.log('%cThe console is dark and full of terrors.', 'color: white; -webkit-text-stroke: 4px #a02d2a; font-size: 60px; font-weight: bold')
            console.log('%cIf you\'ve been told to paste something here, you\'re being scammed.', 'font-size: 16px')
            console.log('%cUnless you know exactly what you\'re doing, close this window.', 'font-size: 16px')
            return ipcRenderer.invoke('xwindow.toggleDevTools')
        },
        minimize: () => ipcRenderer.invoke('xwindow.minimize'),
        maximize: () => ipcRenderer.invoke('xwindow.maximize'),
        unmaximize: () => ipcRenderer.invoke('xwindow.unmaximize'),
        isMaximized: () => ipcRenderer.invoke('xwindow.isMaximized')
    },
    process: {
        platform: () => ipcRenderer.invoke('process.platform'),
        arch: () => ipcRenderer.invoke('process.arch')
    },
    hc: {
        type: () => ipcRenderer.invoke('hc.type')
    },
    AuthManager: {
        addMojangAccount: (username, password) => ipcRenderer.invoke('AuthManager.addMojangAccount', username, password),
        addMicrosoftAccount: (authCode) => ipcRenderer.invoke('AuthManager.addMicrosoftAccount', authCode),
        removeMojangAccount: (uuid) => ipcRenderer.invoke('AuthManager.removeMojangAccount', uuid),
        removeMicrosoftAccount: (uuid) => ipcRenderer.invoke('AuthManager.removeMicrosoftAccount', uuid),
        validateSelected: () => ipcRenderer.invoke('AuthManager.validateSelected')
    },
    Lang: {
        getLang: () => ipcRenderer.invoke('Lang.getLang')
    },
    AutoUpdater: {
        port2: () => ipcRenderer.invoke('AutoUpdater.port2')
    }
}

contextBridge.exposeInMainWorld('api', module.exports.api)