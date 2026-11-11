# Mods inclus dans le launcher

Chaque dossier correspond a la valeur `id` d'une entree de `distribution.json`. Place les fichiers `.jar` dans le dossier `mods` de l'instance voulue :

- `BuildLauncher-1.21.11/mods/` : mods de Build
- `BuildLauncher-1.21.11-Modde/mods/` : mods de Build Moddée
- `Handaria-1.21.11/mods/` : mods de Handaria

Au lancement du jeu, le launcher copie ces mods dans le dossier `mods` de l'instance Minecraft correspondante. Les mods de `BuildLauncher-1.21.11-Modde` ciblent Minecraft 1.21.1 avec NeoForge; les mods des autres dossiers doivent correspondre a la version indiquee par leur instance. Pour les inclure dans l'installeur, reconstruis-le avec `npm run dist:win` après avoir ajouté les fichiers.
