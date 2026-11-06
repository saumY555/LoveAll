@echo off
title Photo Event Gallery
cd /d "%~dp0"

echo ========================================================
echo   Photo Event Gallery - Starting Development Server
echo ========================================================
echo.
echo Project Directory: %~dp0
echo Web App URL:       http://localhost:3000
echo.

echo Starting Face Background Worker...
start "Photo Event Gallery - Face Worker" cmd /k "title Face Worker && npm run worker:faces"

echo Opening browser in 3 seconds...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

echo Starting Next.js server (npm run dev)...
echo Press Ctrl+C in this window anytime to stop the server.
echo.
call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo Server encountered an error (exit code: %errorlevel%).
    pause
)
