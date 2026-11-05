@echo off
setlocal
cd /d "%~dp0"
title AnimeStack Launcher
set PORT=8766
set URL=http://localhost:%PORT%/dist/index.html

if not exist "dist\index.html" (
  echo [AnimeStack] dist\index.html not found. Run "npm install" then "npm run build" first.
  pause
  exit /b 1
)

rem --- 1) Python ---
python --version >nul 2>&1
if %errorlevel%==0 (
  echo [AnimeStack] Starting local server with Python on port %PORT% ...
  start "AnimeStack Server - close this window to stop" python -m http.server %PORT% --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
  start "" "%URL%"
  exit /b 0
)
py -3 --version >nul 2>&1
if %errorlevel%==0 (
  echo [AnimeStack] Starting local server with Python launcher on port %PORT% ...
  start "AnimeStack Server - close this window to stop" py -3 -m http.server %PORT% --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
  start "" "%URL%"
  exit /b 0
)

rem --- 2) Node.js ---
node --version >nul 2>&1
if %errorlevel%==0 (
  echo [AnimeStack] Starting local server with Node.js on port %PORT% ...
  start "AnimeStack Server - close this window to stop" node tools\serve.js %PORT%
  timeout /t 2 /nobreak >nul
  start "" "%URL%"
  exit /b 0
)

rem --- 3) Fallback: open the file directly (works offline, no server needed) ---
echo [AnimeStack] Python/Node not found, opening dist\index.html directly ...
start "" "%~dp0dist\index.html"
exit /b 0
