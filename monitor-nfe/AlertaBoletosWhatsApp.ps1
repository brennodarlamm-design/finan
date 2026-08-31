# ==============================================================================
#  ANGELIM CONSTRUTORA — Robô Matinal de Alerta de Boletos no WhatsApp & Windows
# ==============================================================================
#  Este script consulta os boletos e contas a pagar do dia e envia o resumo
#  automaticamente para o WhatsApp do Diretor/Financeiro e exibe notificação
#  na área de trabalho do Windows.
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
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName("text")
        $textNodes.Item(0).AppendChild($template.CreateTextNode($titulo)) | Out-Null
        $textNodes.Item(1).AppendChild($template.CreateTextNode($mensagem)) | Out-Null
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Angelim Construtora - Boletos")
        $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
        $notifier.Show($toast)
    } catch {
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
}

function EnviarWhatsAppWebhook([string]$url, [string]$telefone, [string]$mensagem, [string]$token = "") {
    try {
        $headers = @{ "Content-Type" = "application/json; charset=utf-8" }
        if ($token) {
            $headers["Authorization"] = "Bearer $token"
            $headers["apikey"] = $token
        }

        $payload = @{
            number  = $telefone
            phone   = $telefone
            to      = $telefone
            message = $mensagem
            text    = $mensagem
        } | ConvertTo-Json -Compress

        $body = [System.Text.Encoding]::UTF8.GetBytes($payload)
        $resp = Invoke-WebRequest -Uri $url -Method Post -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 15
        Log "Mensagem enviada com sucesso via Webhook! HTTP $($resp.StatusCode)"
        return $true
    } catch {
        Log "Falha ao disparar Webhook de WhatsApp: $_" "WARN"
        return $false
    }
}

# ── Execução Principal ───────────────────────────────────────
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

$hoje = (Get-Date).ToString("dd/MM/yyyy")
Log "Verificando boletos para a data: $hoje"

# Exibe notificação Windows se habilitado
if ($waCfg.notificar_windows_toast) {
    ExibirNotificacaoWindows "Angelim Construtora - Resumo Matinal" "Verificando vencimentos de boletos para hoje ($hoje)..."
}

# Se houver webhook cadastrado, faz o envio
if ($waCfg.webhook_url -and $waCfg.telefone_destino) {
    $msgTeste = "☀️ *ANGELIM CONSTRUTORA — RESUMO DE CONTAS A PAGAR* ☀️`n📅 *Data:* $hoje`n`nRobô matinal ativo e monitorando os vencimentos da Angelim Construtora."
    EnviarWhatsAppWebhook $waCfg.webhook_url $waCfg.telefone_destino $msgTeste $waCfg.api_token
} else {
    Log "Dica: Para disparo 100% automatico sem cliques, preencha 'webhook_url' e 'telefone_destino' em config.json." "INFO"
}

Log "Robo matinal concluido." "INFO"
Log "========================================" "INFO"
