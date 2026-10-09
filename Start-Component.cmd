@echo off
cd /d "%~dp0"
title Component.kz - Local Server
echo Component.kz
echo Open http://127.0.0.1:3000 in your browser.
echo Press Ctrl+C to stop the server.
node --env-file-if-exists=.env server.mjs
pause
