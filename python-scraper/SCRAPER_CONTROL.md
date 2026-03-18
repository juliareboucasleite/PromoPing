# PromoPing Scraper - Controle de Execução

Scripts PowerShell para iniciar, parar e monitorar o PromoPing Python Scraper.

## Uso Rápido

### Iniciar o Scraper
```powershell
.\start-scraper.ps1
```
Inicia o monitor de preços em segundo plano (sem janela visível). A navegação acontece em modo headless e anônimo.

### Parar o Scraper
```powershell
.\stop-scraper.ps1
```
Para todas as instâncias do scraper em execução.

### Ver Status
```powershell
.\status-scraper.ps1
```
Mostra processos ativos, memória utilizada e últimas atividades do log.

## Configuração Padrão

| Configuração | Valor | Descrição |
|---|---|---|
| **Modo** | Headless | Sem janela visível (roda por trás) |
| **Navegação** | Anônimo | Sem cookies persistidos |
| **Chrome** | Auto-detectado | Compatível com versão 146+ |
| **Ciclo** | 60s | Recarrega produtos a cada minuto |
| **Histórico** | Salvo | Cada preço fica registrado |

## Variáveis de Ambiente (Opcional)

Edite `.env` na pasta `python-scraper` para customizar:

```
# Intervalo entre ciclos de monitoramento (segundos)
CYCLE_INTERVAL=60

# Rodar em janela (false) ou oculto (true) - default: true
HEADLESS=true

# Versão major do Chrome (auto-detectado por padrão)
CHROME_VERSION_MAIN=146
```

## Logs

Os logs são salvos em `python-scraper/logs/app.log`.

Acompanhe em tempo real com:
```powershell
Get-Content -Path ".\logs\app.log" -Wait
```

## Troubleshooting

### Scraper para inesperadamente
1. Verifique se há erro no log: `Get-Content -tail 20 logs/app.log`
2. Reinicie com `.\stop-scraper.ps1` seguido de `.\start-scraper.ps1`
3. Valide a conexão com o banco: `python start.py --test`

### Chrome version mismatch
Atualize a variável no `.env`:
```
CHROME_VERSION_MAIN=146
```
(ajuste a versão conforme sua instalação do Chrome)

### Múltiplas instâncias rodando
Execute `.\stop-scraper.ps1` para parar todas, então `.\start-scraper.ps1` para iniciar uma única.
