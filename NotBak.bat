@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title NotBak - Ekip Gorev ve Not Yonetim Sistemi

:: Proje kok dizini (bat dosyasinin bulundugu yer)
cd /d "%~dp0"

:: Node.js standart kurulum konumlarini PATH'in EN BASINA ekle (once yeni surum bulunsun)
set "NODE_PREFIX="
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_PREFIX=%NODE_PREFIX%%ProgramFiles%\nodejs;"
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_PREFIX=%NODE_PREFIX%%ProgramFiles(x86)%\nodejs;"
if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_PREFIX=%NODE_PREFIX%%LocalAppData%\Programs\nodejs;"
if defined NODE_PREFIX set "PATH=%NODE_PREFIX%%PATH%"

echo.
echo ============================================
echo   NotBak - Ekip Gorev ve Not Yonetim Sistemi
echo ============================================
echo.

:: ----------------------------------------
:: GEREKSINIM KONTROLLERI
:: ----------------------------------------

set "REQ_OK=1"

:: 1. Node.js 20+ var mi? PowerShell ile guvenilir kontrol (yuklu ise tekrar yukleme yok)
:NODE_CHECK
set "NODE_OK=0"
set "NODE_EXE="
set "NODE_FULL="

:: PowerShell: PATH'teki node'u bul (PATH script basinda guncellendi), surum 20+ ise path ve surum yaz
for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "& { $n = Get-Command node -EA 0; if ($n) { $v = & $n.Source -v 2>$null; if ($v -match 'v(\d+)' -and [int]$matches[1] -ge 20) { Write-Output $n.Source; Write-Output ($v.Trim()) } } }" 2^>nul`) do (
    if not defined NODE_EXE (set "NODE_EXE=%%a") else if not defined NODE_FULL (set "NODE_FULL=%%a")
)
if defined NODE_EXE if defined NODE_FULL set "NODE_OK=1"

if "%NODE_OK%"=="1" (
    echo [OK] Node.js !NODE_FULL!
    for %%D in ("!NODE_EXE!") do set "PATH=%%~dpD;!PATH!"
    goto NODE_DONE
)

:: Batch yedek: standart konumlari tek tek dene
set "NODE_EXE="
for %%P in ("%ProgramFiles%\nodejs\node.exe" "%ProgramFiles(x86)%\nodejs\node.exe" "%LocalAppData%\Programs\nodejs\node.exe") do (
    if not defined NODE_EXE if exist %%~P (
        for /f "tokens=2 delims=v." %%a in ('"%%~P" -v 2^>nul') do set "NODE_VER=%%a"
        if defined NODE_VER if !NODE_VER! GEQ 20 (
            set "NODE_EXE=%%~P"
            for /f "delims=" %%b in ('"%%~P" -v 2^>nul') do set "NODE_FULL=%%b"
        )
    )
)
if defined NODE_EXE (
    set "NODE_OK=1"
    echo [OK] Node.js !NODE_FULL!
    for %%D in ("!NODE_EXE!") do set "PATH=%%~dpD;!PATH!"
    goto NODE_DONE
)

:: Gercekten yok veya 20'den eski - sadece o zaman otomatik yukle
echo [BILGI] Node.js 20+ bulunamadi. Otomatik yukleme yapiliyor...
echo.

:: 1. Yontem: winget ile Node LTS yukle
echo   1. Deneme: winget ile Node.js LTS yukleniyor...
where winget >nul 2>&1
if !errorlevel! equ 0 (
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent 2>nul
    ping 127.0.0.1 -n 16 >nul
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    where node >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=2 delims=v." %%a in ('node -v 2^>nul') do set NODE_VER=%%a
        if defined NODE_VER if !NODE_VER! GEQ 20 (
            echo [OK] Node.js winget ile yuklendi.
            set "NODE_OK=1"
            goto NODE_DONE
        )
    )
)

:: 2. Yontem: Node 20 LTS MSI indir ve sessiz kur
echo   2. Deneme: Node.js 20 LTS indirilip kuruluyor...
set "NODE_MSI=%TEMP%\nodejs-20-lts-x64.msi"
set "NODE_URL=https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_MSI%' -UseBasicParsing } catch { exit 1 }"
if !errorlevel! neq 0 (
    echo [HATA] Node.js indirilemedi. Ag baglantisini kontrol edin.
    set "REQ_OK=0"
    goto REQUIRE_FAIL
)
echo      Kurulum calistiriliyor ^(sessiz, birkaç dakika sürebilir^)...
start /wait msiexec /i "%NODE_MSI%" /quiet /norestart
del "%NODE_MSI%" 2>nul
ping 127.0.0.1 -n 4 >nul
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=2 delims=v." %%a in ('node -v 2^>nul') do set NODE_VER=%%a
    if defined NODE_VER if !NODE_VER! GEQ 20 (
        echo [OK] Node.js kuruldu.
        set "NODE_OK=1"
        goto NODE_DONE
    )
)

echo [HATA] Node.js 20+ otomatik yuklenemedi. Lutfen https://nodejs.org/ adresinden elle yukleyin.
set "REQ_OK=0"
goto REQUIRE_FAIL

:NODE_DONE
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"

:: 2. npm var mi? ^(Node ile birlikte gelir, yine de kontrol^)
if "%REQ_OK%"=="1" (
    where npm >nul 2>&1
    if !errorlevel! neq 0 (
        echo [HATA] npm bulunamadi. Node.js kurulumunu yeniden yapin.
        set "REQ_OK=0"
    ) else (
        echo [OK] npm yuklu
    )
)

:REQUIRE_FAIL
if "%REQ_OK%"=="0" (
    echo.
    pause
    exit /b 1
)

:: 3. node_modules - yoksa npm install
if not exist "node_modules" (
    echo.
    echo [BILGI] node_modules bulunamadi. Bagimliliklari yukleniyor...
    call npm install
    if !errorlevel! neq 0 (
        echo [HATA] npm install basarisiz.
        pause
        exit /b 1
    )
    echo [OK] Bagimliliklar yuklendi.
) else (
    echo [OK] node_modules mevcut
)

:: 4. .env - yoksa .env.example'dan kopyala
if not exist ".env" (
    echo.
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [BILGI] .env dosyasi .env.example'dan olusturuldu.
        echo        Ilk calistirmada kurulum sihirbazini tamamlayin.
    ) else (
        echo [UYARI] .env.example bulunamadi. .env dosyasini elle olusturun.
    )
) else (
    echo [OK] .env mevcut
)

echo.
echo ----------------------------------------
echo   Gereksinimler tamamlandi.
echo ----------------------------------------
echo.

:MENU
echo   1. Canliya Gecis     - Bu kaynak paketinde yoktur; uretim hizmeti baslatilmaz
echo   2. Test Ortami       - Terminaller acik, API/backend takip edilebilir
echo   3. Debug Ortami      - Tek terminalde ayrintili log ve hata aciklamalari
echo   4. Calisan Uygulamalari Kapat
echo   5. Yeniden Kurulum Yap - Sifirlar, kurulum ekranina yonlendirir (3 teyit)
echo   6. Bagimliliklari Yeniden Yukle - node_modules ve .next siler, npm install ^(SWC hatasi icin^)
echo   7. GUI Baslatici       - NotBak-GUI.exe ^(grafik arayuz^)
echo   0. Cikis
echo.
set /p SECIM="Seciminiz (0-7): "

if "%SECIM%"=="1" goto CANLI
if "%SECIM%"=="2" goto TEST
if "%SECIM%"=="3" goto DEBUG
if "%SECIM%"=="4" goto KAPAT
if "%SECIM%"=="5" goto KURULUM
if "%SECIM%"=="6" goto REINSTALL_DEPS
if "%SECIM%"=="7" goto GUI
if "%SECIM%"=="0" goto BITIR
echo Gecersiz secim.
echo.
goto MENU

:: ----------------------------------------
:: PORT OKU - config\port.txt varsa oku, yoksa varsayilan 3001
:: ----------------------------------------
:GET_PORT
set "PORT=3001"
if exist "config\port.txt" (
  for /f "usebackq eol=# delims=" %%a in ("config\port.txt") do (
    set "PORT=%%a"
    goto :GET_PORT_done
  )
)
:GET_PORT_done
if not defined PORT set "PORT=3001"
goto :eof

:: ----------------------------------------
:: BIND OKU - config\bind.txt: local (127.0.0.1) veya network (0.0.0.0)
:: ----------------------------------------
:GET_BIND
set "HOST=127.0.0.1"
if exist "config\bind.txt" (
  for /f "usebackq eol=# delims=" %%a in ("config\bind.txt") do (
    if /i "%%a"=="network" set "HOST=0.0.0.0"
    if /i "%%a"=="ag" set "HOST=0.0.0.0"
    if /i "%%a"=="lan" set "HOST=0.0.0.0"
    goto :GET_BIND_done
  )
)
:GET_BIND_done
goto :eof

:: ----------------------------------------
:: 1. CANLIYA GECIS - Arka planda calistir
:: ----------------------------------------
:CANLI
echo.
echo [NotBak] Bu kaynak paketinde uretim hizmeti baslatma betigi yoktur.
echo          Yerel calistirma icin 2. Test Ortami secin.
echo          Ayrinti: docs\KURULUM.md
echo.
pause
goto MENU

:: ----------------------------------------
:: 2. TEST ORTAMI - Acik terminaller
:: ----------------------------------------
:TEST
call :GET_PORT
call :GET_BIND
node scripts\assert-loopback-db.mjs
if errorlevel 1 (
  echo [NotBak] Baslatma durduruldu.
  pause
  goto MENU
)
echo.
echo [Test Ortami] HOST=%HOST% port %PORT%
start "NotBak - Test Ortami" cmd /k "cd /d ^"%cd%^" & call scripts\notbak-dev.bat"
echo [OK] Test terminali acildi. Yerel: http://localhost:%PORT%
echo.
pause
goto MENU

:: ----------------------------------------
:: 3. DEBUG ORTAMI - Tek terminal, ayrintili
:: ----------------------------------------
:DEBUG
call :GET_PORT
call :GET_BIND
node scripts\assert-loopback-db.mjs
if errorlevel 1 (
  echo [NotBak] Baslatma durduruldu.
  pause
  goto MENU
)
echo.
echo [Debug Ortami] HOST=%HOST% port %PORT%
start "NotBak - Debug Ortami" cmd /k "cd /d ^"%cd%^" & call scripts\notbak-dev-debug.bat"
echo [OK] Debug terminali acildi.
echo.
pause
goto MENU

:: ----------------------------------------
:: 4. CALISAN UYGULAMALARI KAPAT (Kayitli port)
:: ----------------------------------------
:KAPAT
call :GET_PORT
echo.
echo [Kapat] Port %PORT% uzerinde calisan islemler kontrol ediliyor...
set "BULUNDU=0"
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    set "BULUNDU=1"
    taskkill /F /PID %%a >nul 2>&1
    echo      PID %%a sonlandirildi.
)
if "%BULUNDU%"=="0" (
    echo      Port %PORT%'de calisan uygulama bulunamadi.
) else (
    echo [OK] Calisan uygulama kapatildi.
)
echo.
echo [Kapat] NotBak terminal pencereleri kapatiliyor...
set "TERM_KILLED=0"
for /f %%n in ('powershell -NoProfile -Command "& { $menu='NotBak - Ekip Gorev ve Not Yonetim Sistemi'; $n=0; $names=@('cmd','WindowsTerminal','wt'); foreach ($name in $names) { Get-CimInstance Win32_Process -Filter \"Name='$name.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine -match 'title NotBak - ' -and $_.CommandLine -notmatch [regex]::Escape($menu) } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; $n++ } catch {} } }; foreach ($name in $names) { Get-Process $name -ErrorAction SilentlyContinue | ForEach-Object { $t=$_.MainWindowTitle; if ($t -and $t -match 'NotBak' -and $t -ne $menu -and $t -notmatch 'Baslatici|Launcher') { try { Stop-Process -Id $_.Id -Force -ErrorAction Stop; $n++ } catch {} } } }; Write-Output $n }"') do set "TERM_KILLED=%%n"
if !TERM_KILLED! GTR 0 (
    echo      !TERM_KILLED! terminal penceresi kapatildi.
) else (
    echo      Acik NotBak terminali bulunamadi.
)
echo.
pause
goto MENU

:: ----------------------------------------
:: 5. YENIDEN KURULUM - 3 teyit, sifirla
:: ----------------------------------------
:KURULUM
echo.
echo [UYARI] Yeniden kurulum yapilacak. Kurulum verileri silinecek,
echo         uygulama kurulum ekranina donusecek.
echo.

set /p T1="  1. Teyit: Devam etmek icin E yazin: "
if /i not "%T1%"=="E" (
    echo Iptal edildi.
    pause
    goto MENU
)
set /p T2="  2. Teyit: Tekrar E yazin: "
if /i not "%T2%"=="E" (
    echo Iptal edildi.
    pause
    goto MENU
)
set /p T3="  3. Teyit: Son kez E yazin: "
if /i not "%T3%"=="E" (
    echo Iptal edildi.
    pause
    goto MENU
)

echo.
echo Kurulum verileri sifirlaniyor...

:: config\setup.json sil
if exist "config\setup.json" (
    del "config\setup.json"
    echo   - config\setup.json silindi
)

:: .env icinde SETUP_COMPLETE ve DATABASE_URL sifirla
if exist ".env" (
    powershell -NoProfile -Command "(Get-Content '.env') -replace 'SETUP_COMPLETE\s*=\s*\"?true\"?', 'SETUP_COMPLETE=false' | Set-Content '.env'"
    echo   - .env icinde SETUP_COMPLETE=false yapildi
)

:: .next (build cache) sil - opsiyonel, temiz baslangic
if exist ".next" (
    rd /s /q ".next" 2>nul
    if not exist ".next" echo   - .next klasoru silindi
)

echo [OK] Yeniden kurulum icin hazir.
echo.
set /p PORT="   Yayin yapilacak port (varsayilan 3001, Enter=3001): "
if "%PORT%"=="" set "PORT=3001"
set /p BINDMODE="   Yayin: L=Yerel (sadece bu PC), A=Ag/LAN (E/A, varsayilan L): "
if /i "%BINDMODE%"=="A" (set "HOST=0.0.0.0" & set "BINDTXT=network") else (set "HOST=127.0.0.1" & set "BINDTXT=local")
if not exist "config" mkdir config
echo %PORT%> config\port.txt
echo %BINDTXT%> config\bind.txt
echo   Port %PORT% ve bind %BINDTXT% kaydedildi.
echo.
set /p AC="   Kurulum sayfasini acmak icin uygulamayi bu portta baslatalim mi? (E/H): "
if /i "%AC%"=="E" (
    node scripts\assert-loopback-db.mjs
    if errorlevel 1 (
      echo [NotBak] Baslatma durduruldu.
      pause
      goto MENU
    )
    start "NotBak - Kurulum" cmd /k "cd /d ^"%cd%^" & call scripts\notbak-setup-dev.bat"
    echo      Tarayici 5 saniye icinde kurulum sayfasinda acilacak...
    ping 127.0.0.1 -n 6 >nul
    start "" "http://localhost:%PORT%/setup"
) else (
    echo      Uygulamayi baslattiktan sonra tarayicida http://localhost:%PORT%/setup adresine gidin.
)
echo.
pause
goto MENU

:: ----------------------------------------
:: 6. BAGIMLILIKLARI YENIDEN YUKLE (SWC hatasi icin)
:: ----------------------------------------
:: ----------------------------------------
:: 7. GUI BASLATICI
:: ----------------------------------------
:GUI
if exist "NotBak-GUI.exe" (
    start "" "NotBak-GUI.exe"
    echo [OK] NotBak-GUI acildi.
) else (
    echo [UYARI] NotBak-GUI.exe bulunamadi.
    echo        Olusturmak icin: scripts\build-launcher.bat
)
echo.
pause
goto MENU

:: ----------------------------------------
:: 6. BAGIMLILIKLARI YENIDEN YUKLE (SWC hatasi icin)
:: ----------------------------------------
:REINSTALL_DEPS
echo.
echo [Bagimliliklari Yeniden Yukle] NotBak terminali aciliyor...
if exist "node_modules" rd /s /q node_modules
if exist ".next" rd /s /q .next
start "NotBak - Bagimliliklari Yeniden Yukle" cmd /k "title NotBak - Bagimliliklari Yeniden Yukle & cd /d ^"%cd%^" & call npm install & echo. & echo [Bitti] & pause"
echo [OK] npm install terminali acildi.
echo.
pause
goto MENU

:BITIR
echo.
exit /b 0
