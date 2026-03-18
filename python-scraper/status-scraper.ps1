# PromoPing Scraper - STATUS
# Script para verificar o status do monitor de precos

Write-Host "PromoPing Scraper - STATUS" -ForegroundColor Cyan
Write-Host "" -ForegroundColor Gray

$running = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { 
    $_.Name -eq 'python.exe' -and $_.CommandLine -match 'scraper\.py' 
}

if ($running) {
    Write-Host "[OK] Scraper esta em execucao" -ForegroundColor Green
    Write-Host "" -ForegroundColor Gray
    Write-Host "Processos ativos:" -ForegroundColor White
    
    $running | ForEach-Object {
        Write-Host "  PID: $($_.ProcessId)" -ForegroundColor Gray
        Write-Host "  Iniciado: $($_.CreationDate.ToString('dd/MM/yyyy HH:mm:ss'))" -ForegroundColor Gray
        Write-Host "  Comando: $($_.CommandLine)" -ForegroundColor Gray
        
        # Tentar mostrar uso de memoria se disponivel
        try {
            $proc = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
            if ($proc) {
                $memMB = [math]::Round($proc.WorkingSet / 1MB, 2)
                Write-Host "  Memoria: $($memMB) MB" -ForegroundColor Gray
            }
        } catch {}
        
        Write-Host ""
    }
    
    # Mostrar ultimas linhas do log
    $ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    $LogPath = Join-Path $ScriptPath "logs\app.log"
    
    if (Test-Path $LogPath) {
        Write-Host "Ultimas atividades (log):" -ForegroundColor White
        Get-Content $LogPath -Tail 5 | ForEach-Object {
            Write-Host "  $_" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "[INFO] Scraper nao esta em execucao" -ForegroundColor Red
    Write-Host "" -ForegroundColor Gray
    Write-Host "Para iniciar, execute:" -ForegroundColor Cyan
    Write-Host "  .\start-scraper.ps1" -ForegroundColor White
}
