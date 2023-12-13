# Distribution Index

You can use [Nebula](https://github.com/dscalzi/Nebula) to automate the generation of a distribution index.

The most up to date and accurate descriptions of the distribution spec can be viewed in [helios-distribution-types](https://github.com/dscalzi/helios-distribution-types).

The distribution index is written in JSON. The general format of the index is as posted below.

```json
{
    "version": "1.0.0",
    "discord": {
        "clientId": "12334567890123456789",
        "smallImageText": "WesterosCraft",
        "smallImageKey": "seal-circle"
    },
    "rss": "https://westeroscraft.com/articles/index.rss",
    "servers": [
        {
            "id": "Example_Server",
            "name": "WesterosCraft Example Client",
            "description": "Example WesterosCraft server. Connect for fun!",
            "icon": "http://mc.westeroscraft.com/WesterosCraftLauncher/files/example_icon.png",
            "version": "0.0.1",
            "address": "mc.westeroscraft.com:1337",
            "minecraftVersion": "1.11.2",
            "discord": {
                "shortId": "Example",
                "largeImageText": "WesterosCraft Example Server",
                "largeImageKey": "server-example"
            },
            "mainServer": true,
            "autoconnect": true,
            "modules": [
                "Module Objects Here"
            ]
        }
    ]
}
```

## Distro Index Object

#### Example
```JSON
{
    "version": "1.0.0",
    "discord": {
        "clientId": "12334567890123456789",
        "smallImageText": "WesterosCraft",
        "smallImageKey": "seal-circle"
    },
    "rss": "https://westeroscraft.com/articles/index.rss",
    "servers": []
}
```

### `DistroIndex.version: string/semver`

The version of the index format. Will be used in the future to gracefully push updates.

### `DistroIndex.discord: object`

Global settings for [Discord Rich Presence](https://discordapp.com/developers/docs/rich-presence/how-to).

**Properties**

* `discord.clientId: string` - Client ID for th Application registered with Discord.
* `discord.smallImageText: string` - Tootltip for the `smallImageKey`.
* `discord.smallImageKey: string` - Name of the uploaded image for the small profile artwork.


### `DistroIndex.rss: string/url`

A URL to a RSS feed. Used for loading news.

---

## Server Object

#### Example
```JSON
{
    "id": "Example_Server",
    "name": "WesterosCraft Example Client",
    "description": "Example WesterosCraft server. Connect for fun!",
    "icon": "http://mc.westeroscraft.com/WesterosCraftLauncher/files/example_icon.png",
    "version": "0.0.1",
    "address": "mc.westeroscraft.com:1337",
    "minecraftVersion": "1.11.2",
    "discord": {
        "shortId": "Example",
        "largeImageText": "WesterosCraft Example Server",
        "largeImageKey": "server-example"
    },
    "mainServer": true,
    "autoconnect": true,
    "modules": []
}
```

### `Server.id: string`

The ID of the server. The launcher saves mod configurations and selected servers by ID. If the ID changes, all data related to the old ID **will be wiped**.

### `Server.name: string`

The name of the server. This is what users see on the UI.

### `Server.description: string`

A brief description of the server. Displayed on the UI to provide users more information.

### `Server.icon: string/url`

A URL to the server's icon. Will be displayed on the UI.

### `Server.version: string/semver`

The version of the server configuration.

### `Server.address: string/url`

The server's IP address.

### `Server.minecraftVersion: string`

The version of minecraft that the server is running.

### `Server.discord: object`

Server specific settings used for [Discord Rich Presence](https://discordapp.com/developers/docs/rich-presence/how-to).

**Properties**

* `discord.shortId: string` - Short ID for the server. Displayed on the second status line as `Server: shortId`
* `discord.largeImageText: string` - Ttooltip for the `largeImageKey`.
* `discord.largeImageKey: string` - Name of the uploaded image for the large profile artwork.

### `Server.mainServer: boolean`

Only one server in the array should have the `mainServer` property enabled. This will tell the launcher that this is the default server to select if either the previously selected server is invalid, or there is no previously selected server. If this field is not defined by any server (avoid this), the first server will be selected as the default. If multiple servers have `mainServer` enabled, the first one the launcher finds will be the effective value. Servers which are not the default may omit this property rather than explicitly setting it to false.

### `Server.autoconnect: boolean`

Whether or not the server can be autoconnected to. If false, the server will not be autoconnected to even when the user has the autoconnect setting enabled.

### `Server.javaOptions: JavaOptions`

**OPTIONAL**

Sever-specific Java options. If not provided, defaults are used by the client.

### `Server.modules: Module[]`

An array of module objects.

---

## JavaOptions Object

Server-specific Java options.

#### Example
```JSON
{
    "supported": ">=17",
    "suggestedMajor": 17,
    "platformOptions": [
      {
        "platform": "darwin",
        "architecture": "arm64",
        "distribution": "CORRETTO"
      }
    ],
    "ram": {
      "recommended": 3072,
      "minimum": 2048
    }
}
```

### `JavaOptions.platformOptions: JavaPlatformOptions[]`

**OPTIONAL**

Platform-specific java rules for this server configuration. Validation rules will be delegated to the client for any undefined properties. Java validation can be configured for specific platforms and architectures. The most specific ruleset will be applied.

Maxtrix Precedence (Highest - Lowest)
  - Current platform, current architecture (ex. win32 x64).
  - Current platform, any architecture (ex. win32).
  - Java Options base properties.
  - Client logic (default logic in the client).

Properties:

  - `platformOptions.platform: string` - The platform that this validation matrix applies to.
  - `platformOptions.architecture: string` - Optional. The architecture that this validation matrix applies to. If omitted, applies to all architectures.
  - `platformOptions.distribution: string` - Optional. See `JavaOptions.distribution`.
  - `platformOptions.supported: string` - Optional. See `JavaOptions.supported`.
  - `platformOptions.suggestedMajor: number` - Optional. See `JavaOptions.suggestedMajor`.

### `JavaOptions.ram: object`

**OPTIONAL**

This allows you to require a minimum and recommended amount of RAM per server instance. The minimum is the smallest value the user can select in the settings slider. The recommended value will be the default value selected for that server. These values are specified in megabytes and must be an interval of 512. This allows configuration in intervals of half gigabytes. In the above example, the recommended ram value is 3 GB (3072 MB) and the minimum is 2 GB (2048 MB).

  - `ram.recommended: number` - The recommended amount of RAM in megabytes. Must be an interval of 512.
  - `ram.minimum: number` - The absolute minimum amount of RAM in megabytes. Must be an interval of 512.

### `JavaOptions.distribution: string`

**OPTIONAL**

Preferred JDK distribution to download if no applicable installation could be found. If omitted, the client will decide (decision may be platform-specific).

### `JavaOptions.supported: string`

**OPTIONAL**

A semver range of supported JDK versions.

Java version syntax is platform dependent.

JDK 8 and prior
```
1.{major}.{minor}_{patch}-b{build}
Ex. 1.8.0_152-b16
```

JDK 9+
```
{major}.{minor}.{patch}+{build}
Ex. 11.0.12+7
```

For processing, all versions will be translated into a semver compliant string. JDK 9+ is already semver. For versions 8 and below, `1.{major}.{minor}_{patch}-b{build}` will be translated to `{major}.{minor}.{patch}+{build}`.

If specified, you must also specify suggestedMajor.

If omitted, the client will decide based on the game version.

### `JavaOptions.suggestedMajor: number`

**OPTIONAL**

The suggested major Java version. The suggested major should comply with the version range specified by supported, if defined. This will be used in messages displayed to the end user, and to automatically fetch a Java version.

NOTE If supported is specified, suggestedMajor must be set. The launcher's default value may not comply with your custom major supported range.

Common use case:
  - supported: '>=17.x'
  - suggestedMajor: 17

More involved:
  - supported: '>=16 <20'
  - suggestedMajor: 17

Given a wider support range, it becomes necessary to specify which major version in the range is the suggested.

---

## Module Object

A module is a generic representation of a file required to run the minecraft client.

#### Example
```JSON
{
    "id": "com.example:artifact:1.0.0@jar.pack.xz",
    "name": "Artifact 1.0.0",
    "type": "Library",
    "artifact": {
        "size": 4231234,
        "MD5": "7f30eefe5c51e1ae0939dab2051db75f",
        "url": "http://files.site.com/maven/com/example/artifact/1.0.0/artifact-1.0.0.jar.pack.xz"
    },
    "subModules": [
        {
            "id": "examplefile",
            "name": "Example File",
            "type": "File",
            "artifact": {
                "size": 23423,
                "MD5": "169a5e6cf30c2cc8649755cdc5d7bad7",
                "path": "examplefile.txt",
                "url": "http://files.site.com/examplefile.txt"
            }
        }
    ]
}
```

The parent module will be stored maven style, it's destination path will be resolved by its id. The sub module has a declared `path`, so that value will be used.

### `Module.id: string`

The ID of the module. All modules that are not of type `File` **MUST** use a maven identifier. Version information and other metadata is pulled from the identifier. Modules which are stored maven style use the identifier to resolve the destination path. If the `extension` is not provided, it defaults to `jar`.

**Template**

`my.group:arifact:version@extension`

`my/group/artifact/version/artifact-version.extension`

**Example**

`net.minecraft:launchwrapper:1.12` OR `net.minecraft:launchwrapper:1.12@jar`

`net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar`

If the module's artifact does not declare the `path` property, its path will be resolved from the ID.

### `Module.name: string`

The name of the module. Used on the UI.

### `Module.type: string`

The type of the module.

### `Module.classpath: boolean`

**OPTIONAL**

If the module is of type `Library`, whether the library should be added to the classpath. Defaults to true.

### `Module.required: Required`

**OPTIONAL**

Defines whether or not the module is required. If omitted, then the module will be required. 

Only applicable for modules of type:
* `ForgeMod`
* `LiteMod`
* `LiteLoader`


### `Module.artifact: Artifact`

The download artifact for the module.

### `Module.subModules: Module[]`

**OPTIONAL**

An array of sub modules declared by this module. Typically, files which require other files are declared as submodules. A quick example would be a mod, and the configuration file for that mod. Submodules can also declare submodules of their own. The file is parsed recursively, so there is no limit.


## Artifact Object

The format of the module's artifact depends on several things. The most important factor is where the file will be stored. If you are providing a simple file to be placed in the root directory of the client files, you may decided to format the module as the `examplefile` module declared above. This module provides a `path` option, allowing you to directly set where the file will be saved to. Only the `path` will affect the final downloaded file.

Other times, you may want to store the files maven-style, such as with libraries and mods. In this case you must declare the module as the example artifact above. The module `id` will be used to resolve the final path, effectively replacing the `path` property. It must be provided in maven format. More information on this is provided in the documentation for the `id` property.

The resolved/provided paths are appended to a base path depending on the module's declared type.

| Type | Path |
| ---- | ---- |
| `ForgeHosted` | ({`commonDirectory`}/libraries/{`path` OR resolved}) |
| `Fabric` | ({`commonDirectory`}/libraries/{`path` OR resolved}) |
| `LiteLoader` | ({`commonDirectory`}/libraries/{`path` OR resolved}) |
| `Library` | ({`commonDirectory`}/libraries/{`path` OR resolved}) |
| `ForgeMod` | ({`commonDirectory`}/modstore/{`path` OR resolved}) |
| `LiteMod` | ({`commonDirectory`}/modstore/{`path` OR resolved}) |
| `FabricMod` | ({`commonDirectory`}/mods/fabric/{`path` OR resolved}) |
| `File` | ({`instanceDirectory`}/{`Server.id`}/{`path` OR resolved}) |

The `commonDirectory` and `instanceDirectory` values are stored in the launcher's config.json.

### `Artifact.size: number`

The size of the artifact.

### `Artifact.MD5: string`

The MD5 hash of the artifact. This will be used to validate local artifacts.

### `Artifact.path: string`

**OPTIONAL**

A relative path to where the file will be saved. This is appended to the base path for the module's declared type.

If this is not specified, the path will be resolved based on the module's ID.

### `Artifact.url: string/url`

The artifact's download url.

## Required Object

### `Required.value: boolean`

**OPTIONAL**

If the module is required. Defaults to true if this property is omited. 

### `Required.def: boolean`

**OPTIONAL**

If the module is enabled by default. Has no effect unless `Required.value` is false. Defaults to true if this property is omited. 

---

## Module Types

### ForgeHosted

The module type `ForgeHosted` represents forge itself. Currently, the launcher only supports modded servers, as vanilla servers can be connected to via the mojang launcher. The `Hosted` part is key, this means that the forge module must declare its required libraries as submodules.

Ex.

```json
{
    "id": "net.minecraftforge:forge:1.11.2-13.20.1.2429",
    "name": "Minecraft Forge 1.11.2-13.20.1.2429",
    "type": "ForgeHosted",
    "artifact": {
        "size": 4450992,
        "MD5": "3fcc9b0104f0261397d3cc897e55a1c5",
        "url": "http://files.minecraftforge.net/maven/net/minecraftforge/forge/1.11.2-13.20.1.2429/forge-1.11.2-13.20.1.2429-universal.jar"
    },
    "subModules": [
        {
            "id": "net.minecraft:launchwrapper:1.12",
            "name": "Mojang (LaunchWrapper)",
            "type": "Library",
            "artifact": {
                "size": 32999,
                "MD5": "934b2d91c7c5be4a49577c9e6b40e8da",
                "url": "http://mc.westeroscraft.com/WesterosCraftLauncher/files/1.11.2/launchwrapper-1.12.jar"
            }
        }
    ]
}
```

All of forge's required libraries are declared in the `version.json` file found in the root of the forge jar file. These libraries MUST be hosted and declared a submodules or forge will not work.

There were plans to add a `Forge` type, in which the required libraries would be resolved by the launcher and downloaded from forge's servers. The forge servers are down at times, however, so this plan was stopped half-implemented.

---

### Fabric

The module type `Fabric` represents the fabric mod loader. Currently, the launcher only supports modded servers, as vanilla servers can be connected to via the mojang launcher.

Ex.

```json
{
    "id": "net.fabricmc:fabric-loader:0.15.0",
    "name": "Fabric (fabric-loader)",
    "type": "Fabric",
    "artifact": {
    "size": 1196222,
    "MD5": "a43d5a142246801343b6cedef1c102c4",
    "url": "http://localhost:8080/repo/lib/net/fabricmc/fabric-loader/0.15.0/fabric-loader-0.15.0.jar"
    },
    "subModules": [
    {
        "id": "1.20.1-fabric-0.15.0",
        "name": "Fabric (version.json)",
        "type": "VersionManifest",
        "artifact": {
        "size": 2847,
        "MD5": "69a2bd43452325ba1bc882fa0904e054",
        "url": "http://localhost:8080/repo/versions/1.20.1-fabric-0.15.0/1.20.1-fabric-0.15.0.json"
        }
    }
}
```

Fabric works similarly to Forge 1.13+.

---

### LiteLoader

The module type `LiteLoader` represents liteloader. It is handled as a library and added to the classpath at runtime. Special launch conditions are executed when liteloader is present and enabled. This module can be optional and toggled similarly to `ForgeMod` and `Litemod` modules.

Ex.
```json
{
    "id": "com.mumfrey:liteloader:1.11.2",
    "name": "Liteloader (1.11.2)",
    "type": "LiteLoader",
    "required": {
        "value": false,
        "def": false
    },
    "artifact": {
        "size": 1685422,
        "MD5": "3a98b5ed95810bf164e71c1a53be568d",
        "url": "http://mc.westeroscraft.com/WesterosCraftLauncher/files/1.11.2/liteloader-1.11.2.jar"
    },
    "subModules": [
        "All LiteMods go here"
    ]
}
```

---

### Library

The module type `Library` represents a library file which will be required to start the minecraft process. Each library module will be dynamically added to the `-cp` (classpath) argument while building the game process.

Ex.

```json
{
    "id": "net.sf.jopt-simple:jopt-simple:4.6",
    "name": "Jopt-simple 4.6",
    "type": "Library",
    "artifact": {
        "size": 62477,
        "MD5": "13560a58a79b46b82057686543e8d727",
        "url": "http://mc.westeroscraft.com/WesterosCraftLauncher/files/1.11.2/jopt-simple-4.6.jar"
    }
}
```

---

### ForgeMod

The module type `ForgeMod` represents a mod loaded by the Forge Mod Loader (FML). These files are stored maven-style and passed to FML using forge's [Modlist format](https://github.com/MinecraftForge/FML/wiki/New-JSON-Modlist-format).

Ex.
```json
{
    "id": "com.westeroscraft:westerosblocks:3.0.0-beta-6-133",
    "name": "WesterosBlocks (3.0.0-beta-6-133)",
    "type": "ForgeMod",
    "artifact": {
        "size": 16321712,
        "MD5": "5a89e2ab18916c18965fc93a0766cc6e",
        "url": "http://mc.westeroscraft.com/WesterosCraftLauncher/prod-1.11.2/mods/WesterosBlocks.jar"
    }
}
```

---

### LiteMod

The module type `LiteMod` represents a mod loaded by liteloader. These files are stored maven-style and passed to liteloader using forge's [Modlist format](https://github.com/MinecraftForge/FML/wiki/New-JSON-Modlist-format). Documentation for liteloader's implementation of this can be found on [this issue](http://develop.liteloader.com/liteloader/LiteLoader/issues/34).

Ex.
```json
{
    "id": "com.mumfrey:macrokeybindmod:0.14.4-1.11.2@litemod",
    "name": "Macro/Keybind Mod (0.14.4-1.11.2)",
    "type": "LiteMod",
    "required": {
        "value": false,
        "def": false
    },
    "artifact": {
        "size": 1670811,
        "MD5": "16080785577b391d426c62c8d3138558",
        "url": "http://mc.westeroscraft.com/WesterosCraftLauncher/prod-1.11.2/mods/macrokeybindmod.litemod"
    }
}
```

---

### File

The module type `file` represents a generic file required by the client, another module, etc. These files are stored in the server's instance directory.

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
