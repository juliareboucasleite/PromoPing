# PromoPing Scraper - STOP
# Script para parar o monitor de precos

Write-Host "PromoPing Scraper - PARANDO..." -ForegroundColor Cyan

$running = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { 
    $_.Name -eq 'python.exe' -and $_.CommandLine -match 'scraper\.py' 
}

if ($running) {
    $count = $running | Measure-Object | Select-Object -ExpandProperty Count
    Write-Host "Encontrado(s) $count processo(s) scraper.py" -ForegroundColor Gray
    
    foreach ($p in $running) {
        try {
            Write-Host "  Parando PID $($p.ProcessId)..." -ForegroundColor Yellow
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 500
            
            # Verificar se foi parado
            $check = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
                $_.ProcessId -eq $p.ProcessId
            }
            
            if (-not $check) {
                Write-Host "    [OK] PID $($p.ProcessId) parou com sucesso" -ForegroundColor Green
            }
        } catch {
            Write-Host "    [ERRO] Ao parar PID $($p.ProcessId): $_" -ForegroundColor Red
        }
    }
    
    Write-Host "" -ForegroundColor Gray
    Write-Host "[OK] Scraper foi parado" -ForegroundColor Green
} else {
    Write-Host "[INFO] Nenhuma instancia do scraper encontrada" -ForegroundColor Red
}

Write-Host "" -ForegroundColor Gray
Write-Host "Para iniciar novamente, execute:" -ForegroundColor Cyan
Write-Host "  .\start-scraper.ps1" -ForegroundColor White
