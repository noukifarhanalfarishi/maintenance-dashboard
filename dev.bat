@echo off
REM ============================================================
REM  Dev Launcher - Maintenance Dashboard (versi ringkas)
REM  - Matikan proses lama dulu (bersihkan port)
REM  - Jalankan backend + frontend di background
REM  - Buka browser + Claude Code di window ini
REM ============================================================

cd /d "%~dp0"

echo ============================================================
echo   MAINTENANCE DASHBOARD - DEV LAUNCHER
echo ============================================================
echo.

REM --- Matikan semua proses node lama (bersihkan port 5000 dan 3000) ---
echo [CLEANUP] Mematikan proses node yang masih jalan...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel%==0 (
    echo [CLEANUP] Proses lama dimatikan.
) else (
    echo [CLEANUP] Tidak ada proses lama - port sudah bersih.
)
echo.

REM --- Cek dependencies ---
if not exist "server\node_modules" (
    echo [SETUP] Install dependencies server...
    cd server
    call npm install
    cd ..
)

if not exist "client\node_modules" (
    echo [SETUP] Install dependencies client...
    cd client
    call npm install
    cd ..
)

REM --- Jalankan backend di background (minimized) ---
echo [1/3] Menjalankan backend (port 5000) di background...
start "MaintDash-Backend" /min cmd /c "cd /d "%~dp0server" && npm run dev"

REM --- Jalankan frontend di background (minimized) ---
echo [2/3] Menjalankan frontend (port 3000) di background...
start "MaintDash-Frontend" /min cmd /c "cd /d "%~dp0client" && npm run dev"

REM --- Tunggu server siap ---
echo [3/3] Menunggu server siap...
timeout /t 6 /nobreak >nul

REM --- Buka browser ---
start http://localhost:3000

echo.
echo ============================================================
echo   Semua sudah jalan di background!
echo   - Frontend : http://localhost:3000
echo   - Backend  : http://localhost:5000
echo.
echo   Backend dan frontend jalan di window minimized
echo   (cek taskbar kalau mau lihat log-nya).
echo.
echo   Untuk STOP semua server: jalankan stop.bat
echo   atau tutup window minimized di taskbar.
echo ============================================================
echo.
echo   Menjalankan Claude Code...
echo.

REM --- Jalankan Claude Code di window ini ---
claude
