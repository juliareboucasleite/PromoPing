# PromoPing Scraper - START
# Script para iniciar o monitor de precos em segundo plano (headless)
# Garante que apenas 1 instancia roda de cada vez

$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPath = Join-Path (Split-Path -Parent $ScriptPath) ".venv\Scripts\python.exe"
$ScraperPath = Join-Path $ScriptPath "scraper.py"

Write-Host "PromoPing Scraper - INICIANDO..." -ForegroundColor Cyan

# Verificar se ja existe instancia ativa
$running = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { 
    $_.Name -eq 'python.exe' -and $_.CommandLine -match 'scraper\.py' 
}

if ($running) {
    Write-Host "Scraper ja esta em execucao! PID: $($running[0].ProcessId)" -ForegroundColor Yellow
    Write-Host "" -ForegroundColor Gray
    Write-Host "Para parar e reiniciar, execute:" -ForegroundColor Cyan
    Write-Host "  .\stop-scraper.ps1" -ForegroundColor White
    Write-Host "  .\start-scraper.ps1" -ForegroundColor White
    Write-Host "" -ForegroundColor Gray
    Write-Host "Para ver status:" -ForegroundColor Cyan
    Write-Host "  .\status-scraper.ps1" -ForegroundColor White
    exit 0
}

# Se nenhuma instancia ativa, iniciar novo processo
Write-Host "Nenhuma instancia ativa encontrada. Iniciando nova..." -ForegroundColor Gray

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
