@echo off
chcp 65001 >nul
setlocal
title NotBak - Launcher Derleme
cd /d "%~dp0\.."

echo.
echo ============================================
echo   NotBak-GUI.exe derleniyor...
echo ============================================
echo.

where dotnet >nul 2>&1
if errorlevel 1 (
    echo [HATA] .NET SDK bulunamadi.
    echo        https://dotnet.microsoft.com/download adresinden .NET 8 SDK kurun.
    pause
    exit /b 1
)

dotnet publish "tools\NotBakLauncher\NotBakLauncher.csproj" ^
  -c Release ^
  -r win-x64 ^
  --self-contained true ^
  -p:PublishSingleFile=true ^
  -p:IncludeNativeLibrariesForSelfExtract=true ^
  -o "%cd%\launcher-build"

if errorlevel 1 (
    echo [HATA] Derleme basarisiz.
    pause
    exit /b 1
)

copy /Y "launcher-build\NotBak-GUI.exe" "NotBak-GUI.exe" >nul
if errorlevel 1 (
    echo [HATA] NotBak-GUI.exe kopyalanamadi.
    pause
    exit /b 1
)

echo.
echo [OK] NotBak-GUI.exe proje kokune kopyalandi:
echo      %cd%\NotBak-GUI.exe
echo.
echo Bu dosyaya cift tiklayarak baslaticiyi acabilirsiniz.
echo.
pause
