@echo off
setlocal

cd /d "%~dp0"

echo Demarrage du site anniversaire...
start "Site anniversaire - serveur local" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-server.ps1" -Port 30000 -DefaultDocument index.html

timeout /t 2 /nobreak >nul
start "" "http://localhost:30000/"

echo.
echo Site lance sur http://localhost:30000/
echo Ferme la fenetre "Site anniversaire - serveur local" pour arreter le serveur.
echo.
pause
