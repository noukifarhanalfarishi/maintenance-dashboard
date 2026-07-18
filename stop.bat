@echo off
REM ============================================================
REM  Stop Server - Maintenance Dashboard
REM  Matikan semua proses backend + frontend
REM ============================================================

echo ============================================================
echo   STOP SERVER
echo ============================================================
echo.

echo Mematikan semua proses node...
taskkill /F /IM node.exe >nul 2>&1

if %errorlevel%==0 (
    echo [OK] Semua server sudah dimatikan. Port 5000 dan 3000 bebas.
) else (
    echo [INFO] Tidak ada server yang jalan.
)

echo.
timeout /t 2 /nobreak >nul
