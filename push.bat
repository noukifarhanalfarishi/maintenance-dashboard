@echo off
REM ============================================================
REM  Push ke GitHub - Maintenance Dashboard
REM  Klik dua kali untuk commit + push perubahan
REM ============================================================

cd /d "%~dp0"

echo ============================================================
echo   PUSH KE GITHUB
echo ============================================================
echo.

REM --- Tampilkan perubahan yang akan di-push ---
echo Perubahan yang terdeteksi:
git status --short
echo.

REM --- Minta pesan commit ---
set /p pesan="Ketik pesan commit (contoh: tambah fitur export): "

if "%pesan%"=="" (
    echo.
    echo [BATAL] Pesan commit kosong. Push dibatalkan.
    pause
    exit /b
)

echo.
echo [1/3] git add...
git add .

echo [2/3] git commit...
git commit -m "%pesan%"

echo [3/3] git push...
git push

echo.
echo ============================================================
echo   Selesai! Perubahan sudah di GitHub.
echo.
echo   Langkah terakhir - update di Proxmox:
echo   1. pct enter 100
echo   2. update-dashboard.sh
echo ============================================================
echo.
pause
