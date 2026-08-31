# ============================================================
#  Instalar Alerta Matinal de Boletos como Tarefa Agendada
# ============================================================

$ScriptDir    = $PSScriptRoot
$ScriptAlerta = Join-Path $ScriptDir "AlertaBoletosWhatsApp.ps1"
$NomeTarefa   = "Alerta_Boletos_WhatsApp_Angelim"

if (-not (Test-Path $ScriptAlerta)) {
    Write-Error "AlertaBoletosWhatsApp.ps1 nao encontrado em: $ScriptAlerta"
    exit 1
}

Write-Host "Instalando tarefa agendada: '$NomeTarefa' para rodar diariamente as 08:00..." -ForegroundColor Cyan

$cmd = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptAlerta`""
$null = & schtasks.exe /create /tn $NomeTarefa /tr $cmd /sc DAILY /st 08:00 /f 2>&1

Write-Host ""
Write-Host "✅ Tarefa matinal configurada com sucesso!" -ForegroundColor Green
Write-Host "   Executara todos os dias as 08:00 da manha em segundo plano." -ForegroundColor Green
Write-Host ""
Write-Host "Comandos uteis:" -ForegroundColor Gray
Write-Host "  - Testar agora: schtasks /run /tn $NomeTarefa" -ForegroundColor Gray
Write-Host "  - Desinstalar:  schtasks /delete /tn $NomeTarefa /f" -ForegroundColor Gray
