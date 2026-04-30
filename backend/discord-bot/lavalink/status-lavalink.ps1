$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $scriptDir 'lavalink.pid'
$port = if ($env:LAVALINK_PORT) { [int]$env:LAVALINK_PORT } else { 2333 }

$processStatus = 'stopped'
$lavalinkPid = $null

if (Test-Path $pidFile) {
    $lavalinkPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($lavalinkPid -and (Get-Process -Id $lavalinkPid -ErrorAction SilentlyContinue)) {
        $processStatus = 'running'
    } else {
        $lavalinkPid = $null
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}

$netstatLine = netstat -ano | Select-String -Pattern "LISTENING\s+$lavalinkPid$" | Select-Object -First 1
$isListening = $false
if ($netstatLine) {
    $isListening = $netstatLine.Line -match (":$port\s+")
}

[pscustomobject]@{
    ProcessStatus = $processStatus
    Pid = $lavalinkPid
    Port = $port
    Listening = $isListening
}
