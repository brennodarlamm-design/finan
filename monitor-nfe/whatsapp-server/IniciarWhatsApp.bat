@echo off
title Angelim Construtora - Servidor WhatsApp
cd /d "%~dp0"
echo =====================================================
echo   ANGELIM CONSTRUTORA - Servidor Local de WhatsApp
echo =====================================================
echo.

echo Liberando porta 3333...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3333" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo Iniciando servidor WhatsApp...
start http://localhost:3333
node server.js
pause
