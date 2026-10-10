@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   Edu Platform - Database transfer
echo ============================================
echo Copies all data (users, curricula, grades, records...) from the OLD
echo database to the NEW one. Files (Supabase) and search (Qdrant) are not
echo copied - keep the same SUPABASE_* and QDRANT_* settings on the new server.
echo.

if not exist "backend\venv" (
    echo Run start.bat once first to set up the backend.
    pause
    exit /b 1
)

set /p SRC="OLD database URL (DATABASE_URL of the old server): "
set /p DST="NEW database URL (leave empty = DATABASE_URL in backend\.env): "

cd backend
set DSTARG=
if not "%DST%"=="" set DSTARG=--to "%DST%"

echo.
echo --- What will be copied ---
venv\Scripts\python.exe migrate_data.py --from "%SRC%" %DSTARG% --dry-run
if errorlevel 1 goto end

echo.
set /p OK="Copy now? (y/n): "
if /i not "%OK%"=="y" goto end

venv\Scripts\python.exe migrate_data.py --from "%SRC%" %DSTARG%
if not errorlevel 1 goto end

echo.
set /p REP="If the NEW database already has data: wipe it and copy over it? (y/n): "
if /i "%REP%"=="y" venv\Scripts\python.exe migrate_data.py --from "%SRC%" %DSTARG% --replace

:end
echo.
pause
