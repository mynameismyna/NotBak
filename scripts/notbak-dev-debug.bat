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
title NotBak - Debug Ortami
echo [NotBak] Debug - HOST=%HOST% PORT=%PORT%
echo.
set "PORT=%PORT%"
node --inspect node_modules/next/dist/bin/next dev --webpack -H %HOST% -p %PORT%
