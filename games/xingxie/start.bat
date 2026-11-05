@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 「星屑轮舞」启动器
set PORT=8767
set URL=http://localhost:%PORT%/dist/index.html

if not exist "dist\index.html" (
  echo [星屑轮舞] 找不到 dist\index.html，请先运行 npm install 和 npm run build。
  pause
  exit /b 1
)

rem --- 1) Python ---
python --version >nul 2>&1
if %errorlevel%==0 (
  echo [星屑轮舞] 用 Python 在端口 %PORT% 启动本地服务器……
  start "「星屑轮舞」服务器 - 关闭此窗口即停止" python -m http.server %PORT% --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
  start "" "%URL%"
  exit /b 0
)
py -3 --version >nul 2>&1
if %errorlevel%==0 (
  echo [星屑轮舞] 用 Python 启动器在端口 %PORT% 启动本地服务器……
  start "「星屑轮舞」服务器 - 关闭此窗口即停止" py -3 -m http.server %PORT% --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
  start "" "%URL%"
  exit /b 0
)

rem --- 2) Node.js ---
node --version >nul 2>&1
if %errorlevel%==0 (
  echo [星屑轮舞] 用 Node.js 在端口 %PORT% 启动本地服务器……
  start "「星屑轮舞」服务器 - 关闭此窗口即停止" node tools\serve.js %PORT%
  timeout /t 2 /nobreak >nul
  start "" "%URL%"
  exit /b 0
)

rem --- 3) Fallback: open the file directly (works offline, no server needed) ---
echo [星屑轮舞] 没找到 Python / Node，直接打开 dist\index.html ……
start "" "%~dp0dist\index.html"
exit /b 0
