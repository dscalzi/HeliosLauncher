import * as log from "electron-log";

// const isDevMode = process.execPath.match(/[\\/]electron/);
const isProd = process.env.NODE_ENV === "production" || !/[\\/]electron/.exec(process.execPath); // !process.execPath.match(/[\\/]electron/);

const logger = log;
logger.transports.file.level = isProd ? "info" : "silly";
logger.transports.console.level = isProd ? false : "silly";

export default logger;
