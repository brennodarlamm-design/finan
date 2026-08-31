# ============================================================
#  Monitor NF-e SEFAZ — Angelim Construtora
#  Distribuicao de DFe via certificado digital A1 (.pfx)
#  Envia automaticamente para API MeuDanfe
# ============================================================
#  Como usar:
#    1. Preencha o config.json com seus dados
#    2. Execute: powershell -ExecutionPolicy Bypass -File MonitorNFe.ps1
#    3. Agende no Agendador de Tarefas (InstalarTarefa.ps1)
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"


# ── Caminhos base ────────────────────────────────────────────
$ScriptDir  = $PSScriptRoot
$ConfigFile = Join-Path $ScriptDir "config.json"
$NsuFile    = Join-Path $ScriptDir "ultimo_nsu.txt"

# ── Carregar configuracao ────────────────────────────────────
if (-not (Test-Path $ConfigFile)) {
    Write-Error "Arquivo config.json nao encontrado em: $ConfigFile"
    exit 1
}
$cfg = Get-Content $ConfigFile -Raw | ConvertFrom-Json

# Criar pastas de saida se nao existirem
$PastaXml  = if ([System.IO.Path]::IsPathRooted($cfg.saida.pasta_xml))  { $cfg.saida.pasta_xml  } else { Join-Path $ScriptDir $cfg.saida.pasta_xml }
$PastaLogs = if ([System.IO.Path]::IsPathRooted($cfg.saida.pasta_logs)) { $cfg.saida.pasta_logs } else { Join-Path $ScriptDir $cfg.saida.pasta_logs }
New-Item -ItemType Directory -Path $PastaXml  -Force | Out-Null
New-Item -ItemType Directory -Path $PastaLogs -Force | Out-Null

# ── Logger ───────────────────────────────────────────────────
$LogFile = Join-Path $PastaLogs ("monitor_nfe_" + (Get-Date -Format "yyyy-MM") + ".log")
function Log {
    param([string]$msg, [string]$nivel = "INFO")
    $linha = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$nivel] $msg"
    Write-Host $linha
    Add-Content -Path $LogFile -Value $linha -Encoding UTF8
}

# ── Notificação nativa Windows (Toast / Balloon) ──────────────
function ExibirNotificacaoWindows {
    param([string]$titulo, [string]$mensagem)
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName("text")
        $textNodes.Item(0).AppendChild($template.CreateTextNode($titulo)) | Out-Null
        $textNodes.Item(1).AppendChild($template.CreateTextNode($mensagem)) | Out-Null
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Angelim Construtora - Monitor NF-e")
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
            $balloon.ShowBalloonTip(5000)
        } catch {}
    }
}

# ── Carregar certificado .pfx ────────────────────────────────
function ValidarCertificado {
    $caminho = $cfg.certificado.caminho
    $senha   = $cfg.certificado.senha
    if (-not (Test-Path $caminho)) {
        throw "Certificado nao encontrado em: $caminho"
    }
    Log "Validando certificado: $caminho"
    $flags = [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::UserKeySet -bor [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($caminho, $senha, $flags)
    Log "Certificado valido: $($cert.Subject) | Validade: $($cert.NotAfter.ToString('dd/MM/yyyy'))"

    $diasRestantes = ($cert.NotAfter - (Get-Date)).Days
    if ($diasRestantes -le 30) {
        Log "ATENCAO: Certificado vence em $diasRestantes dia(s)!" "WARN"
    }
    return $cert
}

# ── Ler/gravar ultimo NSU processado ────────────────────────
function GetUltimoNSU {
    if (Test-Path $NsuFile) {
        $nsu = (Get-Content $NsuFile -Raw).Trim()
        if ($nsu -match '^\d{15}$') { return $nsu }
    }
    return "000000000000000"
}
function SalvarUltimoNSU([string]$nsu) {
    Set-Content -Path $NsuFile -Value $nsu -Encoding UTF8
}

# ── Montar SOAP envelope para DistDFeInt ─────────────────────
function MontarSoapDistDFe([string]$cnpj, [string]$codUF, [string]$ambiente, [string]$ultNSU) {
    return @"
<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>$ambiente</tpAmb>
          <cUFAutor>$codUF</cUFAutor>
          <CNPJ>$cnpj</CNPJ>
          <distNSU>
            <ultNSU>$ultNSU</ultNSU>
          </distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>
"@
}

# ── Chamada SOAP para SEFAZ com certificado via curl nativo ──
function ChamarSefaz {
    param(
        [string]$pfxPath,
        [string]$pfxSenha,
        [string]$url,
        [string]$soapBody
    )

    $tempSoapFile = Join-Path $PastaLogs ("temp_soap_" + [Guid]::NewGuid().ToString("N") + ".xml")
    Set-Content -Path $tempSoapFile -Value $soapBody -Encoding UTF8

    $certParam = "${pfxPath}:${pfxSenha}"

    $curlArgs = @(
        "-s",
        "-k",
        "--cert-type", "P12",
        "--cert", $certParam,
        "-H", "Content-Type: application/soap+xml; charset=utf-8; action=`"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse`"",
        "-d", "@$tempSoapFile",
        $url
    )

    $result = & curl.exe @curlArgs
    Remove-Item $tempSoapFile -Force -ErrorAction SilentlyContinue

    if (-not $result) {
        throw "Nao houve retorno da SEFAZ via curl."
    }
    return $result
}

# ── Descompactar XML de um docZip (gzip + base64) ────────────
function DescompactarDocZip([string]$base64) {
    $bytes     = [Convert]::FromBase64String($base64)
    $ms        = New-Object System.IO.MemoryStream(,$bytes)
    $gz        = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionMode]::Decompress)
    $reader    = New-Object System.IO.StreamReader($gz, [System.Text.Encoding]::UTF8)
    $xmlString = $reader.ReadToEnd()
    $reader.Close(); $gz.Close(); $ms.Close()
    return $xmlString
}

# ── Extrair retDistDFeInt XML limpo da resposta SOAP ─────────
function ExtrairXmlRetDistDFe([string]$soapResp) {
    [xml]$doc = $soapResp
    $ns = @{
        soap = "http://www.w3.org/2003/05/soap-envelope"
        ws   = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"
        nfe  = "http://www.portalfiscal.inf.br/nfe"
    }
    $retNode = Select-Xml -Xml $doc -XPath "//nfe:retDistDFeInt" -Namespace $ns | Select-Object -First 1 -ExpandProperty Node
    if ($null -ne $retNode) {
        return $retNode.OuterXml
    }
    return $null
}

# ── Enviar XML para API MeuDanfe ─────────────────────────────
function EnviarParaMeuDanfe([string]$xmlString) {
    $url     = "$($cfg.meudanfe.api_base)/fd/add/sefaz-xml"
    $apiKey  = $cfg.meudanfe.api_key
    $headers = @{
        "Api-Key"      = $apiKey
        "Content-Type" = "application/xml; charset=utf-8"
        "Accept"       = "application/json"
    }
    $body = [System.Text.Encoding]::UTF8.GetBytes($xmlString)

    $resp = Invoke-WebRequest -Uri $url -Method Put -Headers $headers -Body $body -UseBasicParsing
    return $resp.Content | ConvertFrom-Json
}

# ── Salvar XML individual em arquivo ─────────────────────────
function SalvarXml([string]$xmlString, [string]$chave, [string]$schema) {
    if (-not $cfg.saida.salvar_xml_local) { return }
    $nome    = "${schema}_${chave}.xml"
    $arquivo = Join-Path $PastaXml $nome
    Set-Content -Path $arquivo -Value $xmlString -Encoding UTF8
    Log "  XML salvo localmente: $arquivo"
}

# ============================================================
#  FUNCAO PRINCIPAL
# ============================================================
function Main {
    Log "========================================" "INFO"
    Log "Monitor NF-e iniciado" "INFO"
    Log "Empresa: $($cfg.empresa.razao_social) | CNPJ: $($cfg.empresa.cnpj) | UF: $($cfg.empresa.uf)" "INFO"

    $null = ValidarCertificado

    $pfxPath = $cfg.certificado.caminho
    $pfxPass = $cfg.certificado.senha
    $cnpj    = $cfg.empresa.cnpj -replace '\D',''
    $codUF   = $cfg.empresa.cod_uf
    $amb     = $cfg.sefaz.ambiente
    $url     = if ($amb -eq "1") { $cfg.sefaz.url_producao } else { $cfg.sefaz.url_homologacao }

    $ultNSU           = GetUltimoNSU
    $totalProcessados = 0
    $totalErros       = 0
    $continuarBusca   = $true

    Log "Ultimo NSU registrado: $ultNSU"

    while ($continuarBusca) {
        Log "Consultando SEFAZ (ultNSU: $ultNSU)..."
        $soap    = MontarSoapDistDFe $cnpj $codUF $amb $ultNSU
        $respXml = ChamarSefaz $pfxPath $pfxPass $url $soap

        # Parsear resposta SOAP
        [xml]$doc = $respXml
        $ns = @{
            soap = "http://www.w3.org/2003/05/soap-envelope"
            ws   = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"
            nfe  = "http://www.portalfiscal.inf.br/nfe"
        }
        $ret = Select-Xml -Xml $doc -XPath "//nfe:retDistDFeInt" -Namespace $ns | Select-Object -First 1 -ExpandProperty Node

        if ($null -eq $ret) {
            Log "Resposta SEFAZ nao contem retDistDFeInt. Resposta: $respXml" "WARN"
            break
        }

        $cStat   = $ret.cStat
        $xMotivo = $ret.xMotivo
        Log "SEFAZ cStat=$cStat | $xMotivo"

        # Atualizar maxNSU retornado se disponivel
        $maxNSURetornado = $ret.maxNSU
        $ultNSURetornado = $ret.ultNSU
        if ($ultNSURetornado -and $ultNSURetornado -ne "000000000000000" -and $ultNSURetornado -ne $ultNSU) {
            $ultNSU = $ultNSURetornado
            SalvarUltimoNSU $ultNSU
            Log "Novo ultNSU salvo: $ultNSU"
        } elseif ($maxNSURetornado -and $maxNSURetornado -ne "000000000000000" -and $maxNSURetornado -ne $ultNSU) {
            $ultNSU = $maxNSURetornado
            SalvarUltimoNSU $ultNSU
            Log "Novo maxNSU salvo: $ultNSU"
        }

        # 656 = Consumo Indevido (aguardar 1 hora quando nao ha novos docs)
        if ($cStat -eq "656") {
            Log "Nenhum documento novo na SEFAZ no momento. Proxima consulta agendada em 1 hora." "INFO"
            $continuarBusca = $false
            break
        }

        # 138 = Documento localizado para o NSU informado / fim da fila
        if ($cStat -eq "138") {
            Log "Fim da fila de documentos na SEFAZ." "INFO"
            $continuarBusca = $false
            break
        }

        # 137 = Nenhum documento localizado
        if ($cStat -eq "137") {
            Log "Nenhum documento novo localizado na SEFAZ." "INFO"
            $continuarBusca = $false
            break
        }

        # Outros codigos de erro
        if ($cStat -ne "138" -and $cStat -ne "137" -and $null -eq $ret.loteDistDFeInt) {
            Log "SEFAZ retornou status nao esperado: $cStat - $xMotivo" "WARN"
            $continuarBusca = $false
            break
        }

        # Processar docZip se houver
        $docs = $ret.loteDistDFeInt.docZip
        if ($null -eq $docs) {
            $continuarBusca = $false
            break
        }
        if ($docs -isnot [array]) { $docs = @($docs) }

        Log "Documentos recebidos neste lote: $($docs.Count)"

        # Enviar retDistDFeInt para o MeuDanfe
        $cleanXml = ExtrairXmlRetDistDFe $respXml
        if ($cleanXml) {
            try {
                Log "Enviando lote para API MeuDanfe..."
                $resultados = EnviarParaMeuDanfe $cleanXml
                if ($resultados -is [array]) {
                    foreach ($item in $resultados) {
                        $chave  = $item.chave -replace '\D',''
                        $status = $item.status
                        $msg    = $item.statusMessage
                        Log "  [MeuDanfe] $status | Chave: $chave | $msg"
                        if ($status -eq "OK" -or $status -eq "WAITING") { $totalProcessados++ }
                        else { $totalErros++ }
                    }
                }
            } catch {
                Log "Aviso ao enviar para MeuDanfe: $_" "WARN"
            }
        }

        # Salvar XMLs individuais localmente
        foreach ($docZip in $docs) {
            try {
                $schema  = $docZip.schema -replace '[^a-zA-Z0-9_]',''
                $nsuDoc  = $docZip.NSU -replace '\D',''
                $xmlDoc  = DescompactarDocZip $docZip.'#text'

                [xml]$xmlParsed = $xmlDoc
                $nfNs = @{ nfe = "http://www.portalfiscal.inf.br/nfe" }
                $chaveNode = Select-Xml -Xml $xmlParsed -XPath "//nfe:chNFe | //nfe:chCTe" -Namespace $nfNs |
                             Select-Object -First 1 -ExpandProperty Node
                $chave = if ($null -ne $chaveNode) { $chaveNode.'#text' } else { $nsuDoc }

                SalvarXml $xmlDoc $chave $schema
            } catch {
                Log "Aviso ao salvar XML individual: $_" "WARN"
            }
        }

        if ($docs.Count -lt 50) {
            $continuarBusca = $false
        } else {
            Log "Aguardando 2s antes do proximo lote..."
            Start-Sleep -Seconds 2
        }
    }

    Log "========================================" "INFO"
    Log "Execucao finalizada com sucesso! Documentos processados: $totalProcessados" "INFO"
    Log "========================================" "INFO"

    if ($totalProcessados -gt 0) {
        ExibirNotificacaoWindows "Angelim Construtora - Novas NF-e Recebidas" "$totalProcessados nova(s) NF-e recebida(s) da SEFAZ e sincronizada(s) com a Nuvem."
    }
}

# ── Executar ─────────────────────────────────────────────────
try {
    Main
    exit 0
} catch {
    Log "ERRO: $_" "ERROR"
    Log $_.ScriptStackTrace "ERROR"
    exit 1
}
