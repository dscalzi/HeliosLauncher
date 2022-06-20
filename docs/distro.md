# Distribution Index

You can use [Nebula](https://github.com/dscalzi/Nebula) to automate the generation of a distribution index.

The distribution index is written in JSON. The general format of the index is as posted below.

```json
{
    "version": "1.0.0",
    "rss": "<LINK TO RSS FEED>",
    "discord": {
      "clientId": "<FILL IN OR REMOVE DISCORD OBJECT>",
      "smallImageText": "<FILL IN OR REMOVE DISCORD OBJECT>",
      "smallImageKey": "<FILL IN OR REMOVE DISCORD OBJECT>"
    },
    "servers": [
      {
        "id": "Ouinaria-1.12.2",
        "name": "Ouinaria (Minecraft 1.12.2)",
        "description": "Ouinaria Running Minecraft 1.12.2 (Forge v14.23.5.2859)",
        "icon": null,
        "version": "1.0.0",
        "address": "localhost:25565",
        "minecraftVersion": "1.12.2",
        "discord": {
          "shortId": "<FILL IN OR REMOVE DISCORD OBJECT>",
          "largeImageText": "<FILL IN OR REMOVE DISCORD OBJECT>",
          "largeImageKey": "<FILL IN OR REMOVE DISCORD OBJECT>"
        },
        "mainServer": false,
        "autoconnect": false,
        "modules": [
          {
            "id": "net.minecraftforge:forge:1.12.2-14.23.5.2859:universal",
            "name": "Minecraft Forge",
            "type": "ForgeHosted",
            "artifact": {
              "size": 4466108,
              "MD5": "fda01cd3cae80c2c6348ac3fc26e0af8",
              "url": "http://localhost:8080/repo/lib/net/minecraftforge/forge/1.12.2-14.23.5.2859/forge-1.12.2-14.23.5.2859-universal.jar"
            },
            "subModules": [
              {
                "id": "1.12.2-14.23.5.2859",
                "name": "Minecraft Forge (version.json)",
                "type": "VersionManifest",
                "artifact": {
                  "size": 12345,
                  "MD5": "1959bb357e54a9666dd80d744b524639",
                  "url": "http://localhost:8080/repo/versions/1.12.2-forge-14.23.5.2859/1.12.2-forge-14.23.5.2859.json"
                }
              },
              {
                "id": "org.ow2.asm:asm-debug-all:5.2@jar",
                "name": "Minecraft Forge (asm-debug-all)",
                "type": "Library",
                "artifact": {
                  "size": 387903,
                  "MD5": "fe5f20404ccdee9769ef05dc4b47ba98",
                  "url": "http://localhost:8080/repo/lib/org/ow2/asm/asm-debug-all/5.2/asm-debug-all-5.2.jar"
                }
              },
              {
                "id": "net.minecraft:launchwrapper:1.12@jar",
                "name": "Minecraft Forge (launchwrapper)",
                "type": "Library",
                "artifact": {
                  "size": 32999,
                  "MD5": "934b2d91c7c5be4a49577c9e6b40e8da",
                  "url": "http://localhost:8080/repo/lib/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar"
                }
              },
              {
                "id": "org.jline:jline:3.5.1@jar",
                "name": "Minecraft Forge (jline)",
                "type": "Library",
                "artifact": {
                  "size": 614590,
                  "MD5": "4c20d2879ed2bd75a0771ce29e89f6b0",
                  "url": "http://localhost:8080/repo/lib/org/jline/jline/3.5.1/jline-3.5.1.jar"
                }
              },
              {
                "id": "com.typesafe.akka:akka-actor_2.11:2.3.3@jar",
                "name": "Minecraft Forge (akka-actor_2.11)",
                "type": "Library",
                "artifact": {
                  "size": 2514991,
                  "MD5": "541440ca0819ebada47d6d1a8b3ee9e1",
                  "url": "http://localhost:8080/repo/lib/com/typesafe/akka/akka-actor_2.11/2.3.3/akka-actor_2.11-2.3.3.jar"
                }
              },
              {
                "id": "com.typesafe:config:1.2.1@jar",
                "name": "Minecraft Forge (config)",
                "type": "Library",
                "artifact": {
                  "size": 219554,
                  "MD5": "3aaf3c6e76a68e732c17d4a7e9877d81",
                  "url": "http://localhost:8080/repo/lib/com/typesafe/config/1.2.1/config-1.2.1.jar"
                }
              },
              {
                "id": "org.scala-lang:scala-actors-migration_2.11:1.1.0@jar",
                "name": "Minecraft Forge (scala-actors-migration_2.11)",
                "type": "Library",
                "artifact": {
                  "size": 58018,
                  "MD5": "f5e79398daa1806f8b17311a3c782723",
                  "url": "http://localhost:8080/repo/lib/org/scala-lang/scala-actors-migration_2.11/1.1.0/scala-actors-migration_2.11-1.1.0.jar"
                }
              },
              {
                "id": "org.scala-lang:scala-compiler:2.11.1@jar",
                "name": "Minecraft Forge (scala-compiler)",
                "type": "Library",
                "artifact": {
                  "size": 13449765,
                  "MD5": "06030143bf86ca896fb6ccfd679b5760",
                  "url": "http://localhost:8080/repo/lib/org/scala-lang/scala-compiler/2.11.1/scala-compiler-2.11.1.jar"
                }
              },
              {
                "id": "org.scala-lang.plugins:scala-continuations-library_2.11:1.0.2_mc@jar",
                "name": "Minecraft Forge (scala-continuations-library_2.11)",
                "type": "Library",
                "artifact": {
                  "size": 25365,
                  "MD5": "004d7007abbcee858d3ca2c3ccbcbaab",
                  "url": "http://localhost:8080/repo/lib/org/scala-lang/plugins/scala-continuations-library_2.11/1.0.2_mc/scala-continuations-library_2.11-1.0.2_mc.jar"
                }
              },
              {
                "id": "org.scala-lang.plugins:scala-continuations-plugin_2.11.1:1.0.2_mc@jar",
                "name": "Minecraft Forge (scala-continuations-plugin_2.11.1)",
                "type": "Library",
                "artifact": {
                  "size": 206575,
                  "MD5": "359c4a6743a082c689039482eed78670",
                  "url": "http://localhost:8080/repo/lib/org/scala-lang/plugins/scala-continuations-plugin_2.11.1/1.0.2_mc/scala-continuations-plugin_2.11.1-1.0.2_mc.jar"
                }
              },
              {
                "id": "org.scala-lang:scala-library:2.11.1@jar",
                "name": "Minecraft Forge (scala-library)",
                "type": "Library",
                "artifact": {
                  "size": 5538130,
                  "MD5": "1d88f665219e6006c5dd82d71c525c0f",
                  "url": "http://localhost:8080/repo/lib/org/scala-lang/scala-library/2.11.1/scala-library-2.11.1.jar"
                }
              },
              {
                "id": "org.scala-lang:scala-parser-combinators_2.11:1.0.1@jar",
                "name": "Minecraft Forge (scala-parser-combinators_2.11)",
                "type": "Library",
                "artifact": {
                  "size": 419701,
                  "MD5": "4e694499c965af4a02599c99d4f0b196",
                  "url": "http://localhost:8080/repo/lib/org/scala-lang/scala-parser-combinators_2.11/1.0.1/scala-parser-combinators_2.11-1.0.1.jar"
                }
              },
              {
                "id": "org.scala-lang:scala-reflect:2.11.1@jar",
                "name": "Minecraft Forge (scala-reflect)",
                "type": "Library",
                "artifact": {
                  "size": 4372892,
                  "MD5": "7878fac044e4e4b576bb35a77ccc34fc",
                  "url": "http://localhost:8080/repo/lib/org/scala-lang/scala-reflect/2.11.1/scala-reflect-2.11.1.jar"
                }
              },
              {
                "id": "org.scala-lang:scala-swing_2.11:1.0.1@jar",
                "name": "Minecraft Forge (scala-swing_2.11)",
                "type": "Library",
                "artifact": {
                  "size": 726500,
                  "MD5": "1009d69e4948045383f2a7a334348af5",
                  "url": "http://localhost:8080/repo/lib/org/scala-lang/scala-swing_2.11/1.0.1/scala-swing_2.11-1.0.1.jar"
                }
              },
              {
                "id": "org.scala-lang:scala-xml_2.11:1.0.2@jar",
                "name": "Minecraft Forge (scala-xml_2.11)",
                "type": "Library",
                "artifact": {
                  "size": 648679,
                  "MD5": "c2d7e66495afe14545c31b21e99879ef",
                  "url": "http://localhost:8080/repo/lib/org/scala-lang/scala-xml_2.11/1.0.2/scala-xml_2.11-1.0.2.jar"
                }
              },
              {
                "id": "lzma:lzma:0.0.1@jar",
                "name": "Minecraft Forge (lzma)",
                "type": "Library",
                "artifact": {
                  "size": 5762,
                  "MD5": "a3e3c3186e41c4a1a3027ba2bb23cdc6",
                  "url": "http://localhost:8080/repo/lib/lzma/lzma/0.0.1/lzma-0.0.1.jar"
                }
              },
              {
                "id": "java3d:vecmath:1.5.2@jar",
                "name": "Minecraft Forge (vecmath)",
                "type": "Library",
                "artifact": {
                  "size": 318956,
                  "MD5": "e5d2b7f46c4800a32f62ce75676a5710",
                  "url": "http://localhost:8080/repo/lib/java3d/vecmath/1.5.2/vecmath-1.5.2.jar"
                }
              },
              {
                "id": "net.sf.trove4j:trove4j:3.0.3@jar",
                "name": "Minecraft Forge (trove4j)",
                "type": "Library",
                "artifact": {
                  "size": 2523218,
                  "MD5": "8fc4d4e0129244f9fd39650c5f30feb2",
                  "url": "http://localhost:8080/repo/lib/net/sf/trove4j/trove4j/3.0.3/trove4j-3.0.3.jar"
                }
              },
              {
                "id": "org.apache.maven:maven-artifact:3.5.3@jar",
                "name": "Minecraft Forge (maven-artifact)",
                "type": "Library",
                "artifact": {
                  "size": 54961,
                  "MD5": "7741ebf29690ee7d9dde9cf4376347fc",
                  "url": "http://localhost:8080/repo/lib/org/apache/maven/maven-artifact/3.5.3/maven-artifact-3.5.3.jar"
                }
              },
              {
                "id": "net.sf.jopt-simple:jopt-simple:5.0.3@jar",
                "name": "Minecraft Forge (jopt-simple)",
                "type": "Library",
                "artifact": {
                  "size": 78175,
                  "MD5": "0a5ec84e23df9d7cfb4063bc55f2744c",
                  "url": "http://localhost:8080/repo/lib/net/sf/jopt-simple/jopt-simple/5.0.3/jopt-simple-5.0.3.jar"
                }
              },
              {
                "id": "org.apache.logging.log4j:log4j-api:2.15.0@jar",
                "name": "Minecraft Forge (log4j-api)",
                "type": "Library",
                "artifact": {
                  "size": 301804,
                  "MD5": "a9ccfa7e3382dd2b9e0647a43d8286d7",
                  "url": "http://localhost:8080/repo/lib/org/apache/logging/log4j/log4j-api/2.15.0/log4j-api-2.15.0.jar"
                }
              },
              {
                "id": "org.apache.logging.log4j:log4j-core:2.15.0@jar",
                "name": "Minecraft Forge (log4j-core)",
                "type": "Library",
                "artifact": {
                  "size": 1789769,
                  "MD5": "81e0433ae00602c0e4d00424d213b0ab",
                  "url": "http://localhost:8080/repo/lib/org/apache/logging/log4j/log4j-core/2.15.0/log4j-core-2.15.0.jar"
                }
              },
              {
                "id": "org.apache.logging.log4j:log4j-slf4j18-impl:2.15.0@jar",
                "name": "Minecraft Forge (log4j-slf4j18-impl)",
                "type": "Library",
                "artifact": {
                  "size": 21223,
                  "MD5": "196442f1bdde4dbb0f576eed616e21b0",
                  "url": "http://localhost:8080/repo/lib/org/apache/logging/log4j/log4j-slf4j18-impl/2.15.0/log4j-slf4j18-impl-2.15.0.jar"
                }
              }
            ]
          },
          {
            "id": "com.github.hexomod:worldeditcuife2:2.2.0-mf-1.12.2-14.23.5.2768@jar",
            "name": "WorldEdit CUI Forge Edition 2",
            "type": "ForgeMod",
            "artifact": {
              "size": 459294,
              "url": "http://localhost:8080/servers/Ouinaria-1.12.2/forgemods/optionaloff/WorldEdit+CUI+Forge+Edition+2-2.2.0-mf-1.12.2-14.23.5.2768.jar",
              "MD5": "2b8c1c3bc48c2d80b71daa658f656edb"
            },
            "required": {
              "value": false,
              "def": false
            }
          }
        ]
      }
    ]
  }
```
