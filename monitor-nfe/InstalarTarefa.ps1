# ============================================================
#  Instalar Monitor NF-e como Tarefa Agendada do Windows
# ============================================================

$ScriptDir     = $PSScriptRoot
$ScriptMonitor = Join-Path $ScriptDir "MonitorNFe.ps1"
$NomeTarefa    = "Monitor_NFe_Angelim"

if (-not (Test-Path $ScriptMonitor)) {
    Write-Error "MonitorNFe.ps1 nao encontrado em: $ScriptMonitor"
    exit 1
}

Write-Host "Instalando tarefa agendada: '$NomeTarefa'..." -ForegroundColor Cyan

$cmd = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptMonitor`""
$null = & schtasks.exe /create /tn $NomeTarefa /tr $cmd /sc HOURLY /mo 1 /f 2>&1

Write-Host ""
Write-Host "✅ Tarefa agendada configurada com sucesso!" -ForegroundColor Green
Write-Host "   Executara automaticamente a cada 1 hora em segundo plano." -ForegroundColor Green
Write-Host ""
Write-Host "Comandos uteis:" -ForegroundColor Gray
Write-Host "  - Executar agora: schtasks /run /tn $NomeTarefa" -ForegroundColor Gray
Write-Host "  - Desinstalar:    schtasks /delete /tn $NomeTarefa /f" -ForegroundColor Gray
