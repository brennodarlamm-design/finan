# ============================================================
#  Monitor NF-e SEFAZ — Angelim Construtora
#  Distribuicao de DFe via certificado digital A1 (.pfx)
#  Envia automaticamente para API MeuDanfe
# ============================================================
#  Como usar:
#    1. Copie config.example.json para config.json e preencha os dados nao secretos
#    2. Prefira FINOBRA_CERT_PASSWORD e MEUDANFE_API_KEY no ambiente
#    3. Execute: powershell -ExecutionPolicy Bypass -File MonitorNFe.ps1
#    4. Agende no Agendador de Tarefas (InstalarTarefa.ps1)
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

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

# ── Parser XML seguro: sem DTD/resolucao externa ─────────────
function ConvertTo-SafeXml {
    param([Parameter(Mandatory=$true)][string]$xmlText)

    $settings = New-Object System.Xml.XmlReaderSettings
    $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $settings.MaxCharactersInDocument = 52428800

    $stringReader = New-Object System.IO.StringReader($xmlText)
    $reader = [System.Xml.XmlReader]::Create($stringReader, $settings)
    $doc = New-Object System.Xml.XmlDocument
    $doc.XmlResolver = $null
    try {
        $doc.Load($reader)
        return $doc
    } finally {
        $reader.Dispose()
        $stringReader.Dispose()
    }
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

# ── Carregar certificado .pfx sem chave exportavel ───────────
function ValidarCertificado {
    $caminho = [string]$cfg.certificado.caminho
    $senha = [string]$env:FINOBRA_CERT_PASSWORD
    if ([string]::IsNullOrWhiteSpace($senha)) { $senha = [string]$cfg.certificado.senha }

    if (-not (Test-Path $caminho)) {
        throw "Certificado nao encontrado no caminho configurado."
    }
    if ([string]::IsNullOrWhiteSpace($senha)) {
        throw "Senha do certificado nao configurada. Defina FINOBRA_CERT_PASSWORD ou o fallback local em config.json."
    }

    Log "Validando certificado A1 configurado..."
    $flags = [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::UserKeySet
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($caminho, $senha, $flags)

    if (-not $cert.HasPrivateKey) {
        $cert.Dispose()
        throw "O certificado configurado nao possui chave privada."
    }
    if ($cert.NotAfter -le (Get-Date)) {
        $validade = $cert.NotAfter.ToString('dd/MM/yyyy')
        $cert.Dispose()
        throw "Certificado expirado em $validade."
    }
    if ($cert.NotBefore -gt (Get-Date)) {
        $inicio = $cert.NotBefore.ToString('dd/MM/yyyy')
        $cert.Dispose()
        throw "Certificado ainda nao e valido. Inicio: $inicio."
    }

    Log "Certificado valido ate $($cert.NotAfter.ToString('dd/MM/yyyy'))."
    $diasRestantes = ($cert.NotAfter - (Get-Date)).Days
    if ($diasRestantes -le 30) {
        Log "ATENCAO: Certificado vence em $diasRestantes dia(s)!" "WARN"
    }
    return $cert
}

# ── Ler/gravar ultimo NSU processado (estado local, nao versionado) ────────────
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

# ── Chamada SOAP mTLS via HttpClient ─────────────────────────
# Mantem validacao TLS normal, nao grava SOAP temporario e nao coloca senha do PFX
# na linha de comando do sistema operacional.
function ChamarSefaz {
    param(
        [Parameter(Mandatory=$true)]$cert,
        [Parameter(Mandatory=$true)][string]$url,
        [Parameter(Mandatory=$true)][string]$soapBody
    )

    $handler = New-Object System.Net.Http.HttpClientHandler
    $null = $handler.ClientCertificates.Add($cert)
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(60)
    $content = New-Object System.Net.Http.StringContent($soapBody, [System.Text.Encoding]::UTF8)
    $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"')
    $response = $null

    try {
        $response = $client.PostAsync($url, $content).GetAwaiter().GetResult()
        $result = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if (-not $response.IsSuccessStatusCode) {
            throw "SEFAZ retornou HTTP $([int]$response.StatusCode)."
        }
        if ([string]::IsNullOrWhiteSpace($result)) {
            throw "Nao houve retorno da SEFAZ."
        }
        return $result
    } finally {
        if ($null -ne $response) { $response.Dispose() }
        $content.Dispose()
        $client.Dispose()
        $handler.Dispose()
    }
}

# ── Descompactar XML de um docZip (gzip + base64) ────────────
function DescompactarDocZip([string]$base64) {
    $bytes     = [Convert]::FromBase64String($base64)
    $ms        = New-Object System.IO.MemoryStream(,$bytes)
    $gz        = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionMode]::Decompress)
    $reader    = New-Object System.IO.StreamReader($gz, [System.Text.Encoding]::UTF8)
    try {
        return $reader.ReadToEnd()
    } finally {
        $reader.Dispose()
        $gz.Dispose()
        $ms.Dispose()
    }
}

# ── Extrair retDistDFeInt XML limpo da resposta SOAP ─────────
function ExtrairXmlRetDistDFe([string]$soapResp) {
    $doc = ConvertTo-SafeXml $soapResp
    $ns = @{
        soap = "http://www.w3.org/2003/05/soap-envelope"
        ws   = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"
        nfe  = "http://www.portalfiscal.inf.br/nfe"
    }
    $retNode = Select-Xml -Xml $doc -XPath "//nfe:retDistDFeInt" -Namespace $ns | Select-Object -First 1 -ExpandProperty Node
    if ($null -ne $retNode) { return $retNode.OuterXml }
    return $null
}

# ── Enviar XML para API MeuDanfe ─────────────────────────────
function EnviarParaMeuDanfe([string]$xmlString) {
    $url = "$($cfg.meudanfe.api_base)/fd/add/sefaz-xml"
    $apiKey = [string]$env:MEUDANFE_API_KEY
    if ([string]::IsNullOrWhiteSpace($apiKey)) { $apiKey = [string]$cfg.meudanfe.api_key }
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        throw "MEUDANFE_API_KEY nao configurada."
    }

    $headers = @{
        "Api-Key"      = $apiKey
        "Content-Type" = "application/xml; charset=utf-8"
        "Accept"       = "application/json"
    }
    $body = [System.Text.Encoding]::UTF8.GetBytes($xmlString)
    $resp = Invoke-WebRequest -Uri $url -Method Put -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 30
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

    $cert = ValidarCertificado
    try {
        $cnpj  = ([string]$cfg.empresa.cnpj) -replace '\D',''
        $codUF = [string]$cfg.empresa.cod_uf
        $amb   = [string]$cfg.sefaz.ambiente
        $url   = if ($amb -eq "1") { [string]$cfg.sefaz.url_producao } else { [string]$cfg.sefaz.url_homologacao }

        $ultNSU           = GetUltimoNSU
        $totalProcessados = 0
        $totalErros       = 0
        $continuarBusca   = $true

        Log "Ultimo NSU registrado: $ultNSU"

        while ($continuarBusca) {
            Log "Consultando SEFAZ (ultNSU: $ultNSU)..."
            $soap    = MontarSoapDistDFe $cnpj $codUF $amb $ultNSU
            $respXml = ChamarSefaz $cert $url $soap

            $doc = ConvertTo-SafeXml $respXml
            $ns = @{
                soap = "http://www.w3.org/2003/05/soap-envelope"
                ws   = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"
                nfe  = "http://www.portalfiscal.inf.br/nfe"
            }
            $ret = Select-Xml -Xml $doc -XPath "//nfe:retDistDFeInt" -Namespace $ns | Select-Object -First 1 -ExpandProperty Node

            if ($null -eq $ret) {
                Log "Resposta SEFAZ sem retDistDFeInt; conteudo bruto omitido do log por seguranca." "WARN"
                break
            }

            $cStat   = $ret.cStat
            $xMotivo = $ret.xMotivo
            Log "SEFAZ cStat=$cStat | $xMotivo"

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

            if ($cStat -eq "656") {
                Log "Nenhum documento novo na SEFAZ no momento. Proxima consulta agendada em 1 hora." "INFO"
                $continuarBusca = $false
                break
            }
            if ($cStat -eq "138") {
                Log "Documentos localizados na SEFAZ (cStat 138). Processando lote..." "INFO"
            }
            if ($cStat -eq "137") {
                Log "Nenhum documento novo localizado na SEFAZ (fim da fila)." "INFO"
                $continuarBusca = $false
                break
            }
            if ($cStat -ne "138" -and $cStat -ne "137" -and $null -eq $ret.loteDistDFeInt) {
                Log "SEFAZ retornou status nao esperado: $cStat - $xMotivo" "WARN"
                $continuarBusca = $false
                break
            }

            $docs = $ret.loteDistDFeInt.docZip
            if ($null -eq $docs) {
                $continuarBusca = $false
                break
            }
            if ($docs -isnot [array]) { $docs = @($docs) }

            Log "Documentos recebidos neste lote: $($docs.Count)"

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
                    Log "Aviso ao enviar para MeuDanfe: $($_.Exception.Message)" "WARN"
                }
            }

            foreach ($docZip in $docs) {
                try {
                    $schema = $docZip.schema -replace '[^a-zA-Z0-9_]',''
                    $nsuDoc = $docZip.NSU -replace '\D',''
                    $xmlDoc = DescompactarDocZip $docZip.'#text'

                    $xmlParsed = ConvertTo-SafeXml $xmlDoc
                    $nfNs = @{ nfe = "http://www.portalfiscal.inf.br/nfe" }
                    $chaveNode = Select-Xml -Xml $xmlParsed -XPath "//nfe:chNFe | //nfe:chCTe" -Namespace $nfNs |
                                 Select-Object -First 1 -ExpandProperty Node
                    $chave = if ($null -ne $chaveNode) { $chaveNode.'#text' } else { $nsuDoc }

                    SalvarXml $xmlDoc $chave $schema
                } catch {
                    Log "Aviso ao salvar XML individual: $($_.Exception.Message)" "WARN"
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
        Log "Execucao finalizada. Documentos processados: $totalProcessados | erros reportados: $totalErros" "INFO"
        Log "========================================" "INFO"

        if ($totalProcessados -gt 0) {
            ExibirNotificacaoWindows "Angelim Construtora - Novas NF-e Recebidas" "$totalProcessados nova(s) NF-e recebida(s) da SEFAZ e sincronizada(s) com a Nuvem."
        }
    } finally {
        $cert.Dispose()
    }
}

# ── Executar ─────────────────────────────────────────────────
try {
    Main
    exit 0
} catch {
    Log "ERRO: $($_.Exception.Message)" "ERROR"
    exit 1
}
