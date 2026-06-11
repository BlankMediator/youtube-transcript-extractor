$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$extensionDir = Join-Path $root "youtube-transcript-extension"
$distDir = Join-Path $root "dist"
$manifestPath = Join-Path $extensionDir "manifest.json"

if (-not (Test-Path $manifestPath)) {
    throw "Manifest not found: $manifestPath"
}

$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
$version = $manifest.version
$name = "youtube-transcript-extractor-$version.zip"
$zipPath = Join-Path $distDir $name

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

$items = Get-ChildItem -LiteralPath $extensionDir -Force |
    Where-Object { $_.Name -notin @(".git", ".DS_Store") }

Compress-Archive -Path $items.FullName -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Created $zipPath"
