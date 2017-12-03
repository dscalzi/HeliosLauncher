# Documentation of the Launcher Distribution Index

The distribution index is written in JSON. The general format of the index is as posted below.

```json
{
    "version": "1.0",
    "discord": {
        "clientID": 12334567890,
        "smallImageText": "WesterosCraft",
        "smallImageKey": "seal-circle"
    },
    "servers": [
        {
            "id": "Example_Server",
            "name": "WesterosCraft Example Client",
            "news_feed": "http://westeroscraft.com/forums/example/index.rss",
            "icon_url": "http://mc.westeroscraft.com/WesterosCraftLauncher/files/example_icon.png",
            "revision": "0.0.1",
            "server_ip": "mc.westeroscraft.com:1337",
            "mc_version": "1.11.2",
            "discord": {
                "shortId": "Example",
                "largeImageText": "WesterosCraft Example Server",
                "largeImageKey": "server-example"
            },
            "default_selected": true,
            "autoconnect": true,
            "modules": [
                ...
            ]
        }
    ]
}
```

You can declare an unlimited number of servers, however you must provide valid values for the fields listed above. In addition to that, the server can declare modules.

The discord settings are to enable the use of Rich Presence on the launcher. For more details, see [discord's documentation](https://discordapp.com/developers/docs/rich-presence/how-to#updating-presence-update-presence-payload-fields).

Only one server in the array should have the `default_selected` property enabled. This will tell the launcher that this is the default server to select if either the previously selected server is invalid, or there is no previously selected server. This field is not defined by any server (avoid this), the first server will be selected as the default. If multiple servers have `default_selected` enabled, the first one the launcher finds will be the effective value. Servers which are not the default may omit this property rather than explicitly setting it to false.

## Modules

A module is a generic representation of a file required to run the minecraft client. It takes the general form:

```json
{
    "id": "group.id:artifact:version",
    "name": "Artifact {version}",
    "type": "{a valid type}",
    "artifact": {
        "size": "{file size in bytes}",
        "MD5": "{MD5 hash for the file, string}",
        "extension": ".jar",
        "url": "http://files.site.com/maven/group/id/artifact/version/artifact-version.jar"
    },
    "sub_modules": [
        {
            "id": "examplefile",
            "name": "Example File",
            "type": "file",
            "artifact": {
                "size": "{file size in bytes}",
                "MD5": "{MD5 hash for the file, string}",
                "path": "examplefile.txt",
                "url": "http://files.site.com/examplefile.txt"
            }
        },
        ...
    ]
}
```

As shown above, modules objects are allowed to declare submodules under the option `sub_modules`. This parameter is completely optional and can be omitted for modules which do not require submodules. Typically, files which require other files are declared as submodules. A quick example would be a mod, and the configuration file for that mod. Submodules can also declare submodules of their own. The file is parsed recursively, so there is no limit.

Modules may also declare a `required` object.

```json
"required": {
    "value": false, "(if the module is required)"
    "def": false "(if it's enabled by default, has no effect if value is true)"
}
```

If a module does not declare this object, both `value` and `def` default to true. Similarly, if a parameter is not included in the `required` object it will default to true. This will be used in the mod selection process down the line.


The format of the module's artifact depends on several things. The most important factor is where the file will be stored. If you are providing a simple file to be placed in the root directory of the client files, you may decided to format the module as the `examplefile` module declared above. This module provides a `path` option, allowing you to directly set where the file will be saved to. Only the `path` will affect the final downloaded file.

Other times, you may want to store the files maven-style, such as with libraries and mods. In this case you must declare the module as the example artifact above. The `id` becomes more important as it will be used to resolve the final path. The `id` must be provided in maven format, that is `group.id.maybemore:artifact:version`. From there, you need to declare the `extension` of the file in the artifact object. This effectively replaces the `path` option we used above.

**It is EXTREMELY IMPORTANT that the file size is CORRECT. The launcher's download queue will not function properly otherwise.**

Ex.

```SHELL
type = forgemod
id = com.westeroscraft:westerosblocks:1.0.0
extension = .jar

resolved_path = {base}/modstore/com/westeroscraft/westerosblocks/1.0.0/westerosblocks-1.0.0.jar
```

The resolved path depends on the type. Currently, there are several recognized module types:

- `forge-hosted` ({base}/libraries/{path OR resolved})
- `library` ({base}/libraries/{path OR resolved})
- `forgemod` ({base}/modstore/{path OR resolved})
- `litemod` ({base}/modstore/{path OR resolved})
- `file` ({base}/{path OR resolved})

---


### forge-hosted

The module type `forge-hosted` represents forge itself. Currently, the launcher only supports forge servers, as vanilla servers can be connected to via the mojang launcher. The `hosted` part is key, this means that the forge module must declare its required libraries as submodules.

Ex.

```json
{
    "id": "net.minecraftforge:forge:1.11.2-13.20.1.2429",
    "name": "Minecraft Forge 1.11.2-13.20.1.2429",
    "type": "forge-hosted",
    "artifact": {
        "size": 4450992,
        "MD5": "3fcc9b0104f0261397d3cc897e55a1c5",
        "extension": ".jar",
        "url": "http://files.minecraftforge.net/maven/net/minecraftforge/forge/1.11.2-13.20.1.2429/forge-1.11.2-13.20.1.2429-universal.jar"
    },
    "sub_modules": [
        {
            "id": "net.minecraft:launchwrapper:1.12",
            "name": "Mojang (LaunchWrapper)",
            "type": "library",
            "artifact": {
                "size": 32999,
                "MD5": "934b2d91c7c5be4a49577c9e6b40e8da",
                "extension": ".jar",
                "url": "http://mc.westeroscraft.com/WesterosCraftLauncher/files/1.11.2/launchwrapper-1.12.jar"
            }
        },
        ...
    ]
}
```

All of forge's required libraries are declared in the `version.json` file found in the root of the forge jar file. These libraries MUST be hosted and declared a submodules or forge will not work.

There were plans to add a `forge` type, in which the required libraries would be resolved by the launcher and downloaded from forge's servers. The forge servers are down at times, however, so this plan was stopped half-implemented.

---

### library

The module type `library` represents a library file which will be required to start the minecraft process. Each library module will be dynamically added to the `-cp` (classpath) argument while building the game process.

Ex.

```json
{
    "id": "net.sf.jopt-simple:jopt-simple:4.6",
    "name": "Jopt-simple 4.6",
    "type": "library",
    "artifact": {
        "size": 62477,
        "MD5": "13560a58a79b46b82057686543e8d727",
        "extension": ".jar",
        "url": "http://mc.westeroscraft.com/WesterosCraftLauncher/files/1.11.2/jopt-simple-4.6.jar"
    }
}
```

---

### forgemod

The module type `forgemod` represents a mod loaded by the Forge Mod Loader (FML). These files are stored maven-style and passed to FML using forge's [Modlist format](https://github.com/MinecraftForge/FML/wiki/New-JSON-Modlist-format).

Ex.
```json
{
    "id": "com.westeroscraft:westerosblocks:3.0.0-beta-6-133",
    "name": "WesterosBlocks (3.0.0-beta-6-133)",
    "type": "forgemod",
    "artifact": {
        "size": 16321712,
        "MD5": "5a89e2ab18916c18965fc93a0766cc6e",
        "extension": ".jar",
        "url": "http://mc.westeroscraft.com/WesterosCraftLauncher/prod-1.11.2/mods/WesterosBlocks.jar"
    }
}
```

---

### litemod

This module type is being actively considered and changed, until finalized there will be no documentation.

---

### file

The module type `file` represents a generic file required by the client, another module, etc.

Ex.

```json
{
    "id": "com.westeroscraft:westeroscraftrp:2017-08-16",
    "name": "WesterosCraft Resource Pack (2017-08-16)",
    "type": "file",
     "artifact": {
        "size": 45241339,
        "MD5": "ec2d9fdb14d5c2eafe5975a240202f1a",
        "path": "resourcepacks/WesterosCraft.zip",
        "url": "http://mc.westeroscraft.com/WesterosCraftLauncher/prod-1.11.2/resourcepacks/WesterosCraft.zip"
    }
}
```

---

This format is actively under development and is likely to change. 