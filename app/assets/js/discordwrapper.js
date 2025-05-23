// Work in progress
const { LoggerUtil } = require("helios-core");

const logger = LoggerUtil.getLogger("DiscordWrapper");

const { Client } = require("discord-rpc-patch");

const Lang = require("./langloader");

let client;
let activity;

exports.initRPC = function (
  genSettings,
  servSettings,
  initialDetails = Lang.queryJS("discord.launcherDetails")
) {
  client = new Client({ transport: "ipc" });

  activity = {
    details: initialDetails,
    state: Lang.queryJS("discord.launcherState", {
      server: servSettings.shortId,
    }),
    largeImageKey: servSettings.largeImageKey,
    largeImageText: servSettings.largeImageText,
    smallImageKey: genSettings.smallImageKey,
    smallImageText: genSettings.smallImageText,
    startTimestamp: new Date().getTime(),
    instance: false,
    buttons: [
      {
        label: "Mon Site Web",
        url: "https://example.com",
      },
      {
        label: "Rejoins mon serveur",
        url: "https://discord.gg/tonserveur",
      },
    ],
  };

  client.on("ready", () => {
    logger.info("Discord RPC Connected");
    client.setActivity(activity);
    hasRPC = true;
  });

  client.login({ clientId: genSettings.clientId }).catch((error) => {
    if (error.message.includes("ENOENT")) {
      logger.info(
        "Unable to initialize Discord Rich Presence, no client detected."
      );
    } else {
      logger.info(
        "Unable to initialize Discord Rich Presence: " + error.message,
        error
      );
    }
  });
};

exports.updateDetails = function (details) {
  activity.details = details;
  client.setActivity(activity);
};

exports.updateState = function (state) {
  activity.state = state;
  client.setActivity(activity);
};

exports.shutdownRPC = function () {
  if (!client) return;
  client.clearActivity();
  client.destroy();
  client = null;
  activity = null;
};
