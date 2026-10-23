@echo off
chcp 65001 >nul
call "%~dp0notbak-read-publish.bat"
cd /d "%~dp0\.."
node scripts\assert-loopback-db.mjs
if errorlevel 1 (
  echo [NotBak] Baslatma durduruldu.
  pause
  exit /b 1
)
title NotBak - Test Ortami
echo [NotBak] Test - HOST=%HOST% PORT=%PORT%
echo        Yerel: http://localhost:%PORT%
if "%HOST%"=="0.0.0.0" echo        Ag: diger cihazlar LAN IP ile bu porta baglanabilir
echo        (Webpack modu - OneDrive/Windows uyumlulugu icin Turbopack kapali)
echo.
set "PORT=%PORT%"
npx next dev --webpack -H %HOST% -p %PORT%
