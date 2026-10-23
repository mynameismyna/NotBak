@echo off
setlocal EnableDelayedExpansion
set "PORT=3001"
set "HOST=127.0.0.1"
cd /d "%~dp0\.."
if exist "config\port.txt" (
  for /f "usebackq eol=# delims=" %%a in ("config\port.txt") do set "PORT=%%a"
)
if exist "config\bind.txt" (
  for /f "usebackq eol=# delims=" %%a in ("config\bind.txt") do (
    if /i "%%a"=="network" set "HOST=0.0.0.0"
    if /i "%%a"=="ag" set "HOST=0.0.0.0"
    if /i "%%a"=="lan" set "HOST=0.0.0.0"
  )
)
endlocal & set "PORT=%PORT%" & set "HOST=%HOST%"
