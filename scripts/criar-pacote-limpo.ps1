$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Temp = Join-Path $env:TEMP "finobra_release_$Stamp"
$Zip = Join-Path $Root "FINOBRA_RELEASE_$Stamp.zip"

# Pastas que nunca devem entrar no pacote compartilhável, em qualquer nível.
$ExcludedDirs = @('.git','.vercel','node_modules','scratch','bin','logs','auth_info_baileys','.wwebjs_auth','.wwebjs_cache')
# Arquivos sensíveis/locais. Exemplos (.env.example/config.example.json) são mantidos.
$ExcludedExactFiles = @('.env','.env.local','.env.production','.env.development','config.json','ultimo_nsu.txt')
$ExcludedExtensions = @('.pfx','.p12','.pem','.key','.log','.tmp','.bak','.zip','.rar','.7z')

function Should-Skip([string]$RelativePath, [System.IO.FileSystemInfo]$Item) {
  $parts = $RelativePath -split '[\\/]'
  foreach ($part in $parts) {
    if ($ExcludedDirs -contains $part) { return $true }
  }

  if (-not $Item.PSIsContainer) {
    $name = $Item.Name
    $lower = $name.ToLowerInvariant()
    if ($ExcludedExactFiles -contains $lower) { return $true }
    if ($lower -like '.env.*' -and $lower -notlike '*.example') { return $true }
    if ($lower -like 'finobra_patch_*' -or $lower -like 'finobra_release_*') { return $true }
    if ($ExcludedExtensions -contains $Item.Extension.ToLowerInvariant()) { return $true }
  }
  return $false
}

New-Item -ItemType Directory -Force -Path $Temp | Out-Null
try {
  Get-ChildItem -LiteralPath $Root -Force -Recurse | ForEach-Object {
    $relative = $_.FullName.Substring($Root.Length).TrimStart('\\','/')
    if (-not $relative -or (Should-Skip $relative $_)) { return }

    $dest = Join-Path $Temp $relative
    if ($_.PSIsContainer) {
      New-Item -ItemType Directory -Force -Path $dest | Out-Null
    } else {
      $parent = Split-Path -Parent $dest
      if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
      Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
    }
  }

  Compress-Archive -Path (Join-Path $Temp '*') -DestinationPath $Zip -CompressionLevel Optimal -Force
  Write-Host "Pacote limpo criado:" -ForegroundColor Green
  Write-Host $Zip
  Write-Host "Segredos, caches, node_modules, .git, .vercel, binarios e arquivos de sessao foram excluidos." -ForegroundColor DarkGray
} finally {
  Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
}
