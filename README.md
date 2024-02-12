<p align="center"><img src="./app/assets/images/Icon.png" width="150px" height="150px" alt="aventium softworks"></p>

<h1 align="center">MRS Launcher</h1>

[<h3 align="center">Forked from Helios Launcher</h3>](https://github.com/dscalzi/HeliosLauncher)

[<p align="center"><img src="https://img.shields.io/github/actions/workflow/status/peunsu/MRSLauncher/build.yml?branch=master&style=for-the-badge" alt="gh actions">](https://github.com/peunsu/MRSLauncher/actions) [<img src="https://img.shields.io/github/downloads/peunsu/MRSLauncher/total.svg?style=for-the-badge" alt="downloads">](https://github.com/peunsu/MRSLauncher/releases)

[<p align="center"><img src="https://img.shields.io/endpoint?url=https://minecraft-server-status-badge.vercel.app/api/server/mysticred.space?port=25565&logo=curseforge&logoColor=ffffff&label=MRS Server&labelColor=F16436&color=28231d&style=for-the-badge">](https://mysticred.space) [<img src="https://img.shields.io/discord/330997213255827457?style=for-the-badge&logo=discord&logoColor=ffffff&label=Discord&labelColor=6173f4&color=28231d" alt="discord">](https://discord.gg/Z8j6ahF4MJ)

<p align="center">Join modded servers without worrying about installing Java, Forge, or other mods. We'll handle that for you.</p>

![Screenshot 1](https://i.imgur.com/hL9gCr3.jpg)
![Screenshot 2](https://i.imgur.com/m1yHiM6.jpg)

## Features

* 🔒 Full account management.
  * Add multiple accounts and easily switch between them.
  * Microsoft (OAuth 2.0) + Mojang (Yggdrasil) authentication fully supported.
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

#### Need Help? [Check the wiki.][wiki]

#### Like the project? Leave a ⭐ star on the repository!

## Downloads

You can download from [GitHub Releases](https://github.com/peunsu/MRSLauncher/releases)

#### Latest Release

[![](https://img.shields.io/github/release/dscalzi/HeliosLauncher.svg?style=flat-square)](https://github.com/peunsu/MRSLauncher/releases/latest)

#### Latest Pre-Release
[![](https://img.shields.io/github/release/dscalzi/HeliosLauncher/all.svg?style=flat-square)](https://github.com/peunsu/MRSLauncher/releases)

**Supported Platforms**

If you download from the [Releases](https://github.com/peunsu/MRSLauncher/releases) tab, select the installer for your system.

| Platform | File |
| -------- | ---- |
| Windows x64 | `MRS-Launcher-setup-VERSION.exe` |
| ~~macOS x64~~ | ~~`MRS-Launcher-setup-VERSION-x64.dmg`~~ |
| ~~macOS arm64~~ | ~~`MRS-Launcher-setup-VERSION-arm64.dmg`~~ |
| Linux x64 | `MRS-Launcher-setup-VERSION.AppImage` |

## Console

To open the console, use the following keybind.

```console
ctrl + shift + i
```

Ensure that you have the console tab selected. Do not paste anything into the console unless you are 100% sure of what it will do. Pasting the wrong thing can expose sensitive information.

#### Export Output to a File

If you want to export the console output, simply right click anywhere on the console and click **Save as..**

![console example](https://i.imgur.com/T5e73jP.png)


## Development

This section details the setup of a basic developmentment environment.

### Getting Started

**System Requirements**

* [Node.js][nodejs] v18

---

**Clone and Install Dependencies**

```console
> git clone https://github.com/peunsu/MRSLauncher.git
> cd MRSLauncher
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
      "cwd": "${workspaceFolder}",
      "program": "${workspaceFolder}/node_modules/electron/cli.js",
      "args" : ["."],
      "outputCapture": "std"
    },
    {
      "name": "Debug Renderer Process",
      "type": "chrome",
      "request": "launch",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "runtimeArgs": [
        "${workspaceFolder}/.",
        "--remote-debugging-port=9222"
      ],
      "webRoot": "${workspaceFolder}"
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

### Note on Third-Party Usage

Please give credit to the original author and provide a link to the original source. This is free software, please do at least this much.

For instructions on setting up Microsoft Authentication, see https://github.com/dscalzi/HeliosLauncher/blob/master/docs/MicrosoftAuth.md.

---

## Resources

* [Wiki][wiki]
* [Nebula (Create Distribution.json)][nebula]

The best way to contact the developers is on Discord.

[![discord](https://discordapp.com/api/guilds/211524927831015424/embed.png?style=banner3)][discord]

---

### See you ingame.


[nodejs]: https://nodejs.org/en/ 'Node.js'
[vscode]: https://code.visualstudio.com/ 'Visual Studio Code'
[mainprocess]: https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes 'Main Process'
[rendererprocess]: https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes 'Renderer Process'
[chromedebugger]: https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome 'Debugger for Chrome'
[discord]: https://discord.gg/zNWUXdt 'Discord'
[wiki]: https://github.com/dscalzi/HeliosLauncher/wiki 'wiki'
[nebula]: https://github.com/dscalzi/Nebula 'dscalzi/Nebula'
[v2branch]: https://github.com/dscalzi/HeliosLauncher/tree/ts-refactor 'v2 branch'
