@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Edu Platform - Local Launcher
echo ============================================

if not exist "backend\venv" (
    echo [1/3] Creating Python virtual environment ^(first run only^)...
    py -3.12 -m venv backend\venv
    if errorlevel 1 (
        echo Failed to create the virtual environment. Is Python 3.12 installed?
        pause
        exit /b 1
    )
    echo [1/3] Installing backend dependencies ^(first run only, this can take a few minutes^)...
    call backend\venv\Scripts\activate.bat
    pip install --disable-pip-version-check -r backend\requirements.txt
    call deactivate
) else (
    echo [1/3] Backend virtual environment already set up, skipping install.
)

echo [2/3] Starting backend ^(FastAPI on :8000^)...
start "Edu Platform - Backend" cmd /k "cd backend && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

echo [3/3] Starting frontend ^(Next.js on :3000^)...
start "Edu Platform - Frontend" cmd /k "cd frontend && npm run dev"

echo Waiting for the servers to come up...
timeout /t 6 /nobreak >nul

start "" "http://localhost:3000"

echo Done. Close the two server windows to stop the app.
endlocal
