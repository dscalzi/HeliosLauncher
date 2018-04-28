# Getting Started #

System Requirements:
* [Node.js](https://nodejs.org/en/) v10.0.0+

This repository is dedicated to the development of the new custom launcher for the [WesterosCraft](http://www.westeroscraft.com/) server. This project is developed primarily with [Node.js](https://nodejs.org/en/) and the [Electron](https://electron.atom.io/) framework. For further reference you may view [the repository of the new launcher written in JavaFX/Java](https://gitlab.com/westeroscraft/WesteroscraftNewLauncher) which was discontinued. You may also view the repository of the [current launcher](https://gitlab.com/westeroscraft/westeroscraftlaunchercore), a modified fork of MCUpdater.

For authentication with Mojang, we are currently planning on using [node-mojang](https://github.com/jamen/node-mojang). This will automatically be downloaded if you follow the simple installation instructions below.

### Recommended IDE ###

The recommended IDE for this project is [VS Code](https://code.visualstudio.com/), an open source code editor by Microsoft. This editor is available on nearly every major platform (Windows, macOS, Linux). If you choose to use another editor, such as [Atom](https://atom.io/), please gitignore the IDE specific settings directory, if it hasn't been already.

### Installation ###

To begin working on this project clone the repository and open run the following command on the command line. This will download all of the required dependencies.

```shell
npm install
```

# Launching #

### Command Line ###

There are several different ways to launch this project. One way is simply to run the following command on the command line.

```shell
npm start
```

### Visual Studio Code ###

If you use VS Code, you can run this directly from the IDE. Copy the following code into your launch.json file. This will require you to also install [Debugger for Chrome](https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome).

```json
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

This will create two launch configurations from which you can debug the launcher. The first configuration, **Debug Main Process**, will allow you to debug the main Electron process. The second configuration, **Debug Renderer Process**, will allow you to debug the rendering of web pages (ie the UI).

You can find more information [here](http://code.matsu.io/1).

### Notes on DevTools Window ###

Once you run the program, you can open the DevTools window by using the following keybind.

```shell
ctrl + shift + i
```

Please note that if you are debugging the application with VS Code and have launched the program using the **Debug Renderer Process** configuration you cannot open the DevTools window. If you attempt to do so, the program will crash. Remote debugging cannot be  done with multiple DevTools clients.

# Building

Run either of the build scrips noted below. Note that each platform can only be build when running on the specific operating system. Currently investigating ways to run multi-platform builds efficiently.

### Build for Current Platform

* `npm run dist`

### Platforms Specifc Builds

* Windows x64 (win32 x64)
  * `npm run dist:win`
* MacOS (darwin x64)
  * `npm run dist:mac`
* Linux (linux x64)
  * `npm run dist:linux`

# Issues / Further Support #

If you run into any issue which cannot be resolved via a quick google search, create an issue using the tab above.

Much of the discussion regarding this launcher is done on #launcherdev in Discord, feel free to join us there.

[![Discord](https://discordapp.com/api/guilds/98469309352775680/embed.png?style=banner2)](https://discord.gg/hqdjs3m)