<p align="center"><img src="./app/assets/images/WesterosSealCircle.png" width="150px" height="150px" alt="westeroscraft"></p>

<h1 align="center"> WesterosCraft Launcher</h1>

[<p align="center"><img src="https://img.shields.io/travis/WesterosCraftCode/ElectronLauncher.svg?style=for-the-badge" alt="travis">](https://travis-ci.org/WesterosCraftCode/ElectronLauncher) [<img src="https://img.shields.io/github/downloads/WesterosCraftCode/ElectronLauncher/total.svg?style=for-the-badge" alt="downloads">](https://github.com/WesterosCraftCode/ElectronLauncher/releases) <img src="https://forthebadge.com/images/badges/winter-is-coming.svg"  height="28px" alt="stark"></p>

<p align="center">Join WesterosCraft without worrying about installing Java, Forge, or other mods. We'll handle that for you.</p>

![Screenshot 1](https://i.imgur.com/M8HVW9H.jpg)
![Screenshot 2](https://i.imgur.com/zDiSoq4.jpg)

## Features

* 🔒 Full account management.
  * Add multiple accounts and easily switch between them.
  * Credentials are never stored and transmitted directly to Mojang.
* 📂 Efficient asset management.
  * Receive client updates as soon as we release them.
  * Files are validated before launch. Corrupt or incorrect files will be redownloaded.
* ☕ **Automatic Java validation.**
  * If you have an incompatible version of Java installed, we'll install the right one *for you*.
  * You do not need to have Java installed to run the launcher.
* 📰 News feed natively built into the launcher.
* ⚙️ Intuitive settings management, including a Java control panel.
* Supports all of our servers.
  * Switch between server configurations with ease.
  * View the player count of the selected server.
* Automatic updates. That's right, the launcher updates itself.
*  View the status of Mojang's services.

This is not an exhaustive list. Download and install the launcher to gauge all it can do!

## Alpha Tests

The launcher is currently in alpha. It's very usable, however we are still putting in a lot of work. A lot can change, at this point. For more information and instructions on how to **officially** sign up, check out the [Alpha Thread](https://westeroscraft.com/threads/new-launcher-alpha-tests.1113/).

## Downloads

Latest Release

[![](https://img.shields.io/github/release/WesterosCraftCode/ElectronLauncher.svg?style=flat-square)](https://github.com/WesterosCraftCode/ElectronLauncher/releases/latest)

Latest Prerelease

[![](https://img.shields.io/github/release/WesterosCraftCode/ElectronLauncher/all.svg?style=flat-square)](https://github.com/WesterosCraftCode/ElectronLauncher/releases)

**Supported Platforms**

Go to the [Releases](https://github.com/WesterosCraftCode/ElectronLauncher/releases) tab and download the installer for the latest release.

| Platform | File |
| -------- | ---- |
| Windows x64 | `westeroscraftlauncher-setup-VERSION.exe` |
| macOS | `westeroscraftlauncher-VERSION.dmg` |
| Linux x64 | `westeroscraftlauncher-VERSION-x86_64.AppImage` |

## Console

To open the console, use the following keybind.

```console
ctrl + shift + i
```

Ensure that you have the console tab selected. Do not paste anything into the console unless you are 100% sure of what it will do. Pasting the wrong thing can expose sensitive information.

#### Export Output to a File

If you want to export the console output, simply right click anywhere on the console and click **Save as..**

![console example](https://i.imgur.com/HazXrgT.png)


## Development

### Getting Started

**System Requirements**

* [Node.js][nodejs] v10.8.0+

---

**Clone and Install Dependencies**

```console
> git clone https://github.com/WesterosCraftCode/ElectronLauncher.git
> cd ElectronLauncher
> npm install
```

---

**Launch Application**

```console
> npm start
```

---

**Build Installers**

To build for your current platform.

```console
> npm run dist
```

Build for a specific platform.

| Platform    | Command              |
| ----------- | -------------------- |
| Windows x64 | `npm run dist:win`   |
| macOS       | `npm run dist:mac`   |
| Linux x64   | `npm run dist:linux` |

Builds for macOS may not work on Windows/Linux and vice-versa.

---

### Visual Studio Code

All development of the launcher should be done using [Visual Studio Code][vscode].

Paste the following into `.vscode/launch.json`

```JSON
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceRoot}",
      "runtimeExecutable": "${workspaceRoot}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceRoot}/node_modules/.bin/electron.cmd"
      },
      "args": ["."],
      "console": "integratedTerminal",
      "protocol": "inspector"
    },
    {
      "name": "Debug Renderer Process",
      "type": "chrome",
      "request": "launch",
      "runtimeExecutable": "${workspaceRoot}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceRoot}/node_modules/.bin/electron.cmd"
      },
      "runtimeArgs": [
        "${workspaceRoot}/.",
        "--remote-debugging-port=9222"
      ],
      "webRoot": "${workspaceRoot}"
    }
  ]
}
```

This adds two debug configurations.

#### Debug Main Process

This allows you to debug Electron's [main process][mainprocess]. You can debug scripts in the [renderer process][rendererprocess] by opening the DevTools Window.

#### Debug Renderer Process

This allows you to debug Electron's [renderer process][rendererprocess]. This requires you to install the [Debugger for Chrome][chromedebugger] extension.

Note that you **cannot** open the DevTools window while using this debug configuration. Chromium only allows one debugger, opening another will crash the program.

---

## Resources

* [WesterosCraft][westeroscraft]
* [Support Forum][supportforum]

The best way to contact the developers is on Discord.

[![discord](https://discordapp.com/api/guilds/98469309352775680/embed.png?style=banner2)][discord]

---

### See you in Westeros.


[nodejs]: https://nodejs.org/en/ 'Node.js'
[vscode]: https://code.visualstudio.com/ 'Visual Studio Code'
[mainprocess]: https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes 'Main Process'
[rendererprocess]: https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes 'Renderer Process'
[chromedebugger]: https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome 'Debugger for Chrome'
[westeroscraft]: https://westeroscraft.com/ 'WesterosCraft.com'
[supportforum]: https://westeroscraft.com/forum/support.40/ 'Support Forum'
[discord]: https://discord.gg/hqdjs3m 'Discord'
