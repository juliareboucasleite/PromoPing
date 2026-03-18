$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPath = Join-Path (Split-Path -Parent $ScriptPath) ".venv\Scripts\python.exe"
$ScraperPath = Join-Path $ScriptPath "scraper.py"

Write-Host "PromoPing Scraper - INICIANDO..." -ForegroundColor Cyan

# Parar instancias anteriores (se houver)
$running = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { 
    $_.Name -eq 'python.exe' -and $_.CommandLine -match 'scraper\.py' 
}

if ($running) {
    Write-Host "Parando instancias anteriores..." -ForegroundColor Yellow
    foreach ($p in $running) {
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "  Parou PID $($p.ProcessId)" -ForegroundColor Gray
        } catch {
            Write-Host "  Erro ao parar PID $($p.ProcessId): $_" -ForegroundColor Gray
        }
    }
    Start-Sleep -Seconds 2
}

# Iniciar novo processo
try {
    $process = Start-Process -FilePath $VenvPath `
        -ArgumentList $ScraperPath `
        -WorkingDirectory $ScriptPath `
        -WindowStyle Hidden `
        -PassThru

    Start-Sleep -Seconds 2

    # Verificar se o processo esta ativo
    $check = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessId -eq $process.Id
    }

    if ($check) {
        Write-Host "[OK] Scraper iniciado com sucesso!" -ForegroundColor Green
        Write-Host "  PID: $($process.Id)" -ForegroundColor Gray
        Write-Host "  Modo: Headless (sem janela visivel)" -ForegroundColor Gray
        Write-Host "  Status: Monitorando produtos em tempo real" -ForegroundColor Gray
        Write-Host "" -ForegroundColor Gray
        Write-Host "Para parar o scraper, execute:" -ForegroundColor Cyan
        Write-Host "  .\stop-scraper.ps1" -ForegroundColor White
    } else {
        Write-Host "[ERRO] Processo nao esta ativo apos inicializacao" -ForegroundColor Red
    }
} catch {
    Write-Host "[ERRO] Ao iniciar scraper: $_" -ForegroundColor Red
    exit 1
}
