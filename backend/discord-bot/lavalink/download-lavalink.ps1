$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$jarPath = Join-Path $scriptDir 'Lavalink.jar'
$version = '4.2.2'
$downloadUrl = "https://github.com/lavalink-devs/Lavalink/releases/download/$version/Lavalink.jar"

New-Item -ItemType Directory -Path $scriptDir -Force | Out-Null

Write-Host "A transferir Lavalink $version de $downloadUrl"
if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    & curl.exe -L $downloadUrl -o $jarPath
} else {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $jarPath
}

if (-not (Test-Path $jarPath)) {
    throw "Falha ao descarregar Lavalink.jar"
}

Write-Host "Lavalink descarregado em $jarPath"
