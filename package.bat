@echo off
cmd /k electron-packager . WesterosCraftLauncher --overwrite --asar --platform=win32 --arch=x64 --ignore="\.git(ignore|modules)|package\.bat|node_modules|target" --out="./target" --icon="app/assets/images/WesterosSealSquare.ico"
echo Startup canceled.
pause