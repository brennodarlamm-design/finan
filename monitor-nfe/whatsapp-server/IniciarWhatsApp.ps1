# ============================================================
#  ANGELIM CONSTRUTORA — Iniciar Servidor Local de WhatsApp
# ============================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding           = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  ANGELIM CONSTRUTORA — Servidor Local de WhatsApp  " -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias (isso ocorre apenas na primeira vez)..." -ForegroundColor Yellow
    npm install
}

Write-Host "Iniciando servidor de WhatsApp..." -ForegroundColor Green
Start-Process "http://localhost:3333"

node server.js
