# ==============================================================================
#  ANGELIM CONSTRUTORA — Criar Instância e Conectar na Evolution API v2
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding           = [System.Text.Encoding]::UTF8

$EvolutionUrl = "http://localhost:8080"
$ApiKey       = "ANGELIM-FINANCAS-EVOLUTION-2026-KEY"
$InstanceName = "angelim"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  ANGELIM CONSTRUTORA — Conectar Evolution API v2   " -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "apikey"       = $ApiKey
    "Content-Type" = "application/json"
}

# 1. Tenta criar a instância
$bodyCreate = @{
    "instanceName" = $InstanceName
    "token"        = $ApiKey
    "qrcode"       = $true
    "integration"  = "WHATSAPP-BAILEYS"
} | ConvertTo-Json

Write-Host "Criando/Verificando instancia '$InstanceName' na Evolution API..." -ForegroundColor Cyan
try {
    $resp = Invoke-RestMethod -Uri "$EvolutionUrl/instance/create" -Method Post -Headers $headers -Body $bodyCreate
    Write-Host "Instancia criada com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "Instancia ja existente ou pronta." -ForegroundColor Gray
}

# 2. Busca o QR Code de conexão
Write-Host "Obtendo QR Code de conexao..." -ForegroundColor Cyan
try {
    $connectResp = Invoke-RestMethod -Uri "$EvolutionUrl/instance/connect/$InstanceName" -Method Get -Headers $headers
    $qrBase64 = $connectResp.base64

    if ($qrBase64) {
        $htmlContent = @"
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QR Code Evolution API - Angelim Construtora</title>
  <style>
    body { font-family: sans-serif; background: #0f1117; color: #f0ead6; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #181b24; padding: 32px; border-radius: 16px; text-align: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
    h1 { color: #c9a227; font-size: 1.4rem; margin-bottom: 8px; }
    p { font-size: 0.88rem; color: #aaa; margin-bottom: 20px; }
    img { background: #fff; padding: 12px; border-radius: 12px; width: 260px; height: 260px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📲 Evolution API — Angelim Construtora</h1>
    <p>Abra o WhatsApp > Aparelhos Conectados > Conectar Aparelho:</p>
    <img src="$qrBase64" alt="QR Code">
    <p style="margin-top: 16px; font-size: 0.76rem; color: #888;">Atualize a pagina se o QR Code expirar.</p>
  </div>
</body>
</html>
"@
        $htmlFile = Join-Path $PSScriptRoot "qrcode_evolution.html"
        Set-Content -Path $htmlFile -Value $htmlContent -Encoding UTF8
        Start-Process $htmlFile
        Write-Host "✅ QR Code aberto no seu navegador!" -ForegroundColor Green
    } else {
        Write-Host "✅ WhatsApp ja esta conectado na Evolution API!" -ForegroundColor Green
    }
} catch {
    Write-Error "Erro ao conectar com a Evolution API: $_"
}
