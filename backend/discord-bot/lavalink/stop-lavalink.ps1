$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $scriptDir 'lavalink.pid'

if (-not (Test-Path $pidFile)) {
    Write-Host 'Nenhum PID de Lavalink encontrado.'
    exit 0
}

$lavalinkPid = Get-Content $pidFile -ErrorAction SilentlyContinue
if (-not $lavalinkPid) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host 'PID inválido removido.'
    exit 0
}

$process = Get-Process -Id $lavalinkPid -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Id $lavalinkPid -Force
    Wait-Process -Id $lavalinkPid -ErrorAction SilentlyContinue
    Write-Host "Lavalink parado (PID $lavalinkPid)."
} else {
    Write-Host "Processo $lavalinkPid já não estava em execução."
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
