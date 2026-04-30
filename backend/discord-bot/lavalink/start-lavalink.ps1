$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$jarPath = Join-Path $scriptDir 'Lavalink.jar'
$logsDir = Join-Path $scriptDir 'logs'
$stdoutLog = Join-Path $logsDir 'lavalink-stdout.log'
$stderrLog = Join-Path $logsDir 'lavalink-stderr.log'
$pidFile = Join-Path $scriptDir 'lavalink.pid'

New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw 'Java não encontrado no PATH.'
}

if (-not (Test-Path $jarPath)) {
    & (Join-Path $scriptDir 'download-lavalink.ps1')
}

if (Test-Path $pidFile) {
    $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($existingPid) {
        $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
        if ($existingProcess) {
            Write-Host "Lavalink já está em execução com PID $existingPid"
            exit 0
        }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

$env:LAVALINK_PORT = if ($env:LAVALINK_PORT) { $env:LAVALINK_PORT } else { '2333' }
$env:LAVALINK_PASSWORD = if ($env:LAVALINK_PASSWORD) { $env:LAVALINK_PASSWORD } else { 'promoping-lavalink' }

$javaArgs = "-jar `"$jarPath`""

$process = Start-Process -FilePath 'java' `
    -ArgumentList $javaArgs `
    -WorkingDirectory $scriptDir `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru `
    -WindowStyle Hidden

Set-Content -Path $pidFile -Value $process.Id
Write-Host "Lavalink iniciado com PID $($process.Id) na porta $env:LAVALINK_PORT"
