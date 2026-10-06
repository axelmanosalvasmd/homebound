@echo off
rem Starts the HOMEBOUND server. Uses this PC's Tailscale address when Tailscale is running,
rem so friends on your tailnet can join; otherwise it stays local to this PC.
cd /d "%~dp0"
if not exist node_modules call npm ci
set HOST=
for /f %%i in ('tailscale ip -4 2^>nul') do if not defined HOST set HOST=%%i
if not defined HOST set HOST=127.0.0.1
set PORT=8790
echo.
echo   HOMEBOUND: http://%HOST%:%PORT%
echo   Share the Invite link from the game header with your crew. Close this window to stop the server.
echo.
start "" cmd /c "timeout /t 2 >nul & start http://%HOST%:%PORT%"
node server.js
