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
title NotBak - Kurulum
echo [NotBak] Kurulum - http://localhost:%PORT%/setup
set "PORT=%PORT%"
npx next dev --webpack -H %HOST% -p %PORT%
