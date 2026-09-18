# ==============================================================================
#  ANGELIM CONSTRUTORA — Robo Matinal de Alerta de Boletos no WhatsApp & Windows
# ==============================================================================
#  Consulta as contas a pagar do tenant no FinObra e envia o resumo pelo backend
#  oficial do FinObra. Nao depende de servidor WhatsApp local.
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding           = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot

$ScriptDir   = $PSScriptRoot
$ConfigFile  = Join-Path $ScriptDir "config.json"
$PastaLogs   = Join-Path $ScriptDir "logs"
New-Item -ItemType Directory -Path $PastaLogs -Force | Out-Null

$LogFile = Join-Path $PastaLogs ("alerta_boletos_" + (Get-Date -Format "yyyy-MM") + ".log")
function Log {
    param([string]$msg, [string]$nivel = "INFO")
    $linha = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$nivel] $msg"
    Write-Host $linha
    Add-Content -Path $LogFile -Value $linha -Encoding UTF8
}

function ExibirNotificacaoWindows {
    param([string]$titulo, [string]$mensagem)
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $balloon = New-Object System.Windows.Forms.NotifyIcon
        $balloon.Icon = [System.Drawing.SystemIcons]::Information
        $balloon.BalloonTipTitle = $titulo
        $balloon.BalloonTipText = $mensagem
        $balloon.Visible = $true
        $balloon.ShowBalloonTip(7000)
    } catch {}
}

function NovaAutenticacaoFinObra {
    param([string]$segredo, [string]$tenantId)

    if ([string]::IsNullOrWhiteSpace($segredo)) {
        throw "FINOBRA_API_SECRET nao configurado."
    }
    if ([string]::IsNullOrWhiteSpace($tenantId) -or $tenantId -eq "SEU_TENANT_ID_FINOBRA_AQUI") {
        throw "empresa.tenant_id nao configurado no config.json."
    }

    return @{
        "Authorization" = "Bearer $segredo"
        "x-api-key"     = $segredo
        "x-tenant-id"   = $tenantId
    }
}

function EnviarWhatsApp {
    param(
        [string]$url,
        [string]$telefone,
        [string]$mensagem,
        [hashtable]$authHeaders
    )

    try {
        $headers = @{
            "Content-Type" = "application/json; charset=utf-8"
        }
        foreach ($key in $authHeaders.Keys) { $headers[$key] = $authHeaders[$key] }

        $payload = @{
            number  = $telefone
            phone   = $telefone
            to      = $telefone
            message = $mensagem
            text    = $mensagem
        } | ConvertTo-Json -Compress

        $body = [System.Text.Encoding]::UTF8.GetBytes($payload)
        $targetUrl = if ($url) { $url } else { "https://fingo.api.br/api/send-whatsapp" }

        $resp = Invoke-WebRequest -Uri $targetUrl -Method Post -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 15
        Log "Mensagem enviada com sucesso pela API FinObra. HTTP $($resp.StatusCode)"
        return $true
    } catch {
        Log "Falha ao disparar WhatsApp pela API FinObra: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# ── Execucao Principal ───────────────────────────────────────
Log "========================================" "INFO"
Log "Robo Matinal de Boletos iniciado" "INFO"

if (-not (Test-Path $ConfigFile)) {
    Log "Arquivo config.json nao encontrado!" "ERROR"
    exit 1
}

$cfg = Get-Content $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
$waCfg = $cfg.whatsapp

if (-not $waCfg -or -not $waCfg.ativo) {
    Log "Modulo de WhatsApp desativado em config.json." "WARN"
    exit 0
}

$tenantId = [string]$cfg.empresa.tenant_id
$apiSecret = [string]$env:FINOBRA_API_SECRET
if ([string]::IsNullOrWhiteSpace($apiSecret)) { $apiSecret = [string]$waCfg.api_secret }
if ([string]::IsNullOrWhiteSpace($apiSecret)) { $apiSecret = [string]$waCfg.api_token }

try {
    $authHeaders = NovaAutenticacaoFinObra $apiSecret $tenantId
} catch {
    Log $_.Exception.Message "ERROR"
    exit 1
}

$hojeData = (Get-Date).ToString("yyyy-MM-dd")
$hojeFmt  = (Get-Date).ToString("dd/MM/yyyy")
Log "Consultando contas a pagar do tenant configurado..."

# Consulta os lancamentos da nuvem com escopo explicito de tenant.
$lancamentos = @()
try {
    $apiUrl = "https://fingo.api.br/api/db?table=all"
    $response = Invoke-RestMethod -Uri $apiUrl -Method Get -Headers $authHeaders -TimeoutSec 15
    if ($response.success -and $response.data.lancamentos) {
        $lancamentos = $response.data.lancamentos
    }
} catch {
    Log "Nao foi possivel consultar a API FinObra: $($_.Exception.Message)" "WARN"
}

# Filtra contas a pagar
$boletosHoje = @()
$totalValor = 0

foreach ($l in $lancamentos) {
    if ($l.tipo -eq 'despesa' -and $l.status -eq 'a_pagar') {
        $dtVenc = $l.data_vencimento
        if (-not $dtVenc) { $dtVenc = $l.data }

        if ($dtVenc -le $hojeData) {
            $boletosHoje += $l
            $totalValor += [double]($l.valor)
        }
    }
}

Log "Encontrados $($boletosHoje.Count) boleto(s) a pagar hoje. Total: R$ $($totalValor.ToString('N2'))"

# Monta o texto detalhado da mensagem
$msg = "*ANGELIM CONSTRUTORA -- RESUMO DE CONTAS A PAGAR*`n"
$msg += "Data: $hojeFmt`n"

if ($boletosHoje.Count -gt 0) {
    $msg += "`nAtencao: Voce possui $($boletosHoje.Count) conta(s) com vencimento hoje ou pendentes:`n"

    $idx = 1
    foreach ($b in $boletosHoje) {
        $vFmt = [string]::Format((New-Object System.Globalization.CultureInfo("pt-BR")), "{0:C}", [double]($b.valor))
        $forn = if ($b.fornecedor_beneficiario) { $b.fornecedor_beneficiario } else { $b.descricao }
        $msg += "`n$idx. *$forn*`n   Valor: $vFmt"
        if ($b.codigo_barras) {
            $msg += "`n   Codigo: $($b.codigo_barras)"
        }
        $msg += "`n"
        $idx++
    }

    $totalFmt = [string]::Format((New-Object System.Globalization.CultureInfo("pt-BR")), "{0:C}", $totalValor)
    $msg += "`nTotal a pagar: *$totalFmt*`n"
} else {
    $msg += "`nNenhuma conta a pagar com vencimento para hoje.`n"
}

$msg += "`n_Mensagem automatica gerada as 08:00 pelo Robo Financeiro Angelim._"

# 1. Notificacao do Windows
if ($waCfg.notificar_windows_toast) {
    $txtToast = if ($boletosHoje.Count -gt 0) {
        "$($boletosHoje.Count) conta(s) a pagar hoje. Total: R$ $($totalValor.ToString('N2'))"
    } else {
        "Nenhuma conta vencendo hoje ($hojeFmt)."
    }
    ExibirNotificacaoWindows "Angelim Construtora - Resumo Matinal" $txtToast
}

# 2. Envio WhatsApp pelo endpoint oficial do FinObra
if ($waCfg.telefone_destino) {
    $null = EnviarWhatsApp $waCfg.webhook_url $waCfg.telefone_destino $msg $authHeaders
} else {
    Log "Telefone de destino nao configurado em config.json." "WARN"
}

Log "Robo matinal concluido." "INFO"
Log "========================================" "INFO"
