import {
    app,
    BrowserWindow,
    ipcMain,
    Notification,
    // nativeImage
} from "electron";
import { join } from "path";
import { parse } from "url";
import { autoUpdater } from "electron-updater";

import logger from "./utils/logger.cjs";
import settings from "./utils/settings.cjs";

const isProd = process.env.NODE_ENV === "production" || app.isPackaged;
console.log("isprod: ", isProd)
logger.info("App starting...");
settings.set("check", true);
logger.info("Checking if settings store works correctly.");
logger.info(settings.get("check") ? "Settings store works correctly." : "Settings store has a problem.");

let mainWindow: BrowserWindow | null;
let notification: Notification | null;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 980,
        height: 552,
        frame: false,
        webPreferences: {
            // preload: join(__dirname, 'app', 'assets', 'js', 'preloader.js'),
            // devTools: isProd ? false : true,
            devTools: true,

            // Make that false some day.
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#171614'
    });

    if (!isProd) {
        mainWindow.loadURL("http://localhost:5173/src/frontend/").catch((err) => {
            logger.error(JSON.stringify(err));
            app.quit();
        });
    } else {
        mainWindow.loadFile(join(__dirname, "..", "frontend", "index.html")).catch((err) => {
            logger.error(JSON.stringify(err));
            app.quit();
        });
    }
    // mainWindow.removeMenu();

    mainWindow.resizable = true;
    mainWindow.webContents.openDevTools();

    if (!isProd) mainWindow.webContents.openDevTools();

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
};

app.on("ready", createWindow);

// those two events are completely optional to subscrbe to, but that's a common way to get the
// user experience people expect to have on macOS: do not quit the application directly
// after the user close the last window, instead wait for Command + Q (or equivalent).
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (mainWindow === null) createWindow();
});

app.on("web-contents-created", (e, contents) => {
    logger.info(e);
    // Security of webviews
    contents.on("will-attach-webview", (event, webPreferences, params) => {
        logger.info(event, params);
        // Strip away preload scripts if unused or verify their location is legitimate
        delete webPreferences.preload;

        // Disable Node.js integration
        webPreferences.nodeIntegration = false;

        // Verify URL being loaded
        // if (!params.src.startsWith(`file://${join(__dirname)}`)) {
        //   event.preventDefault(); // We do not open anything now
        // }
    });

    contents.on("will-navigate", (event, navigationUrl) => {
        const parsedURL = parse(navigationUrl);
        // In dev mode allow Hot Module Replacement
        if (parsedURL.host !== "localhost:5173" && !isProd) {
            logger.warn("Stopped attempt to open: " + navigationUrl);
            event.preventDefault();
        } else if (isProd) {
            // logger.warn("Stopped attempt to open: " + navigationUrl);
            // event.preventDefault();
        }
    });
});

if (isProd)
    autoUpdater.checkForUpdates().catch((err) => {
        logger.error(JSON.stringify(err));
    });

autoUpdater.logger = logger;

autoUpdater.on("update-available", () => {
    notification = new Notification({
        title: "Jean-eude",
        body: "Updates are available. Click to download.",
        silent: true,
        // icon: nativeImage.createFromPath(join(__dirname, "..", "assets", "icon.png"),
    });
    notification.show();
    notification.on("click", () => {
        autoUpdater.downloadUpdate().catch((err) => {
            logger.error(JSON.stringify(err));
        });
    });
});

autoUpdater.on("update-not-available", () => {
    notification = new Notification({
        title: "Electron-Svelte-Typescript",
        body: "Your software is up to date.",
        silent: true,
        // icon: nativeImage.createFromPath(join(__dirname, "..", "assets", "icon.png"),
    });
    notification.show();
});

autoUpdater.on("update-downloaded", () => {
    notification = new Notification({
        title: "Electron-Svelte-Typescript",
        body: "The updates are ready. Click to quit and install.",
        silent: true,
        // icon: nativeImage.createFromPath(join(__dirname, "..", "assets", "icon.png"),
    });
    notification.show();
    notification.on("click", () => {
        autoUpdater.quitAndInstall();
    });
});

autoUpdater.on("error", (err) => {
    notification = new Notification({
        title: "Electron-Svelte-Typescript",
        body: JSON.stringify(err),
        // icon: nativeImage.createFromPath(join(__dirname, "..", "assets", "icon.png"),
    });
    notification.show();
});

ipcMain.on("quit", () => {
    mainWindow?.close();
    app.quit();
})


ipcMain.on("focus:main", () => {
    if (!mainWindow?.isMaximized()) {
        mainWindow?.maximize();
        return;
    }
    mainWindow?.unmaximize();
})

ipcMain.on("reduce:main", () => {
    mainWindow?.minimize();
})