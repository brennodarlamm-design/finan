@echo off
title Angelim Construtora - Evolution API
cd /d "%~dp0"
echo =====================================================
echo   ANGELIM CONSTRUTORA - Iniciar Evolution API v2
echo =====================================================
echo.

docker compose up -d
timeout /t 5 >nul

powershell -ExecutionPolicy Bypass -File .\CriarInstancia.ps1
pause
