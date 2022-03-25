# How to create an own fork of Helios Launcher
## Table of Contents
1. Introduction
2. Creating an distribution.json
3. Distribute your distribution.json
4. Set your own distro in launcher
5. Some tips to costumize your fork
    1. Translation checklist
    2. Costumize images
    3. Setting up Discord RichPresense
    4. Setting up the news feed
6. Setting up autoupdater

**5. & 6. Are currently WIP**

---

## 1. Introduction
Here I'll describe some concepts of the launcher so that you have some basic knowledge about the process of creating your own fork, and the basic steps of creating your fork.

At first, if you want to create a personal launcher for you or a server, you have to fork this project. It's required (by the license of this project) that your modified code stays public and is shown as a fork of `dscalzi/HeliosLauncher`.

As the next step you will have to create an `distribution file` (I'll call it `distro`). This file is the :hearth: of the launcher and contains

1. your servers (with their names, their icons, their addresses, ...)
2. the required mods or files for each server
   Here the launcher differentiate between four file types:

Type | Usage
---- | -----
Forge Mods | 
Liteloader Mods |
Libraries | Libraries are files that can be used between servers so that they were not downloaded for each server again.
Files | A file which isn'ta mod or a library. This can be any, as example a ressource pack or a config

3. the url to your rss feed for the news
4. what should be shown in discord
5. ...

The distro is also the file which you have to update if you wants to add a mod or updating a server to a newer version.

## 2. Create your distribution.json
There are two ways to create your distribution:
- you can use [Nebula](https://github.com/dscalzi/Nebula), a tool also written by dscalzi, that helps you to generate a distro.
- you can write the distro self, so you have more options (since Nebula isnt complete) but it is more complex and needs more time.

Here I'll only discribe creating using Nebula:
1. Check that you have the requirements of Nebula installed:
- Java 8+
- Node 14
2. Setup Nebula by following [this](https://github.com/dscalzi/Nebula#setup)
3. Run `npm run start -- init root` in the directory with Nebula. This will setup the directory structure in your root folder declared in `.env`
4. For each server that you need in the launcher you have to run:

`npm run start -- g server <ID> <MCVERSION> --forge <FORGEVERSION> --liteloader <LITELOADERVERSION>`

Argument | Required Content | Example
-------- | ---------------- | ----------
ID | An identifier for the server | `main`, `build`, `dev`, ...
MCVERSION | The minecraft version the server is running | `1.12.2`
FORGEVERSION | The forge version WITHOUT the minecraft version. You can also use `latest` or `recommended`  to use the latest/recommended forge version for the given minecraft version. Omit this if the server don't need forge. | `14.23.5.2847`
LITELOADERVERSION | The liteloader version, omit if liteloader is not required

5. While adding servers Nebula will creates some directories in your root folder. There will be a folder named `servers` with subfolders named `<ID>-<MCVERSION>`, for each server one.
In each server folder are the following directories:
- `files`
- `libraries`
- `litemods`
- `forgemods`

    and the following files:
- `servermeta.json` - contains additional data about the server

    You can simply drop your files in the specific folder.
    Note: the directories `litemods` and `forgemods` have three subfolders: `required`, `optionalon` and `optionaloff`. If you want that a mod is optional then drop in in the specific directory
6. So, you have all mods and files added, now you have to edit `servermeta.json`:
```json
{
  "$schema": "file:///${ROOT}/schemas/ServerMetaSchema.schema.json",
  "meta": {
    "version": "1.0.0",
    "name": "Test (Minecraft 1.12.2)",
    "description": "Test Running Minecraft 1.12.2 (Forge v14.23.5.2854)",
    "address": "<YOUR SERVER ADRESS HERE>",
    "discord": {
      "shortId": "1.12.2 Test Server",
      "largeImageText": "1.12.2 Test Server",
      "largeImageKey": "seal-circle"
    },
    "mainServer": false,
    "autoconnect": true
  },
  "forge": {
    "version": "14.23.5.2854"
  },
  "untrackedFiles": []
}
```
    There are a lot of options but for now you don't need all.
7. If you have edited all `servermeta.json` files you're ready to generate your final distribution! Simply type `npm run start -- g distro`
    Now it should create the distribution in your root directory.
## 3. Distribut your distribution.json
So you have a distribution. But how can the launcher get this and all the required files?

First, you need a place where you can host this files. If you have a webserver you can use this. As alternative you can use github pages.

1. Edit your `.env` from Nebula and set BASE_URL to the path where you can upload your files. As example, if you're using gh pages your bas url would be `https://<yourusername>.github.io/<yourrepo>`
2. Run again `npm run start -- g distro`
3. Now you can upload your root directory to your server.

Now you can check if the distro is available: open `<yourbaseurl>/distribution.json` in a browser, if you see your file all is okay.

## 4. Set your own distro in launcher
You have now a published distro, so you only have to tell the launcher to use this. Its realy simple, you only have to replace one line:

*app/assets/js/distromanager.js line 540*
```diff
exports.pullRemote = function(){
    if(DEV_MODE){
        return exports.pullLocal()
    }
    return new Promise((resolve, reject) => {
++      const distroURL = '<yourbaseurl>/distribution.json'
--      const distroURL = 'http://mc.westeroscraft.com/WesterosCraftLauncher/distribution.json'
        //const distroURL = 'https://gist.githubusercontent.com/dscalzi/53b1ba7a11d26a5c353f9d5ae484b71b/raw/'
        const opts = {
            url: distroURL,
            timeout: 2500
        }
```
