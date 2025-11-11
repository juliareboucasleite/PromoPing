# Sistema de Status do PromoPing

Este documento descreve o sistema de monitoramento de status integrado ao PromoPing.

## 📋 Visão Geral

O sistema de status permite monitorar em tempo real:
- **Métricas do sistema** (uptime, latência, usuários ativos)
- **Componentes** (API, banco de dados, notificações)
- **Incidentes** (manutenções, problemas, resoluções)

##  Estrutura do Banco de Dados

### Tabelas Principais

#### `metricas_sistema`
Armazena métricas gerais do sistema:
- `UptimeGeral`: Uptime em porcentagem
- `TempoRespostaMedia`: Latência média em ms
- `UtilizadoresAtivos`: Número de usuários ativos
- `ProdutosMonitorizados`: Total de produtos monitorados
- `NotificacoesEnviadas`: Notificações enviadas no período

#### `status_componentes`
Status dos componentes do sistema:
- `Nome`: Nome do componente
- `Status`: operational/degraded/outage
- `Uptime`: Uptime específico do componente
- `Latencia`: Latência do componente
- `Detalhes`: Informações adicionais em JSON

#### `incidentes`
Registro de incidentes e manutenções:
- `Titulo`: Título do incidente
- `Descricao`: Descrição detalhada
- `DataInicio/DataFim`: Período do incidente
- `Status`: investigating/identified/monitoring/resolved
- `ComponenteAfetado`: Componente impactado

## 🚀 Instalação

### 1. Executar Migrações
```bash
npm run status:setup
```

### 2. Testar Sistema
```bash
npm run status:test
```

### 3. Testar API de Componentes
```bash
npm run componentes:test
```

### 4. Reiniciar Servidor
```bash
npm run dev
```

## 🔌 API Endpoints

### Status Geral
```
GET /api/status
```
Retorna status completo do sistema com métricas, componentes e incidentes.

### Estatísticas em Tempo Real
```
GET /api/status/realtime
```
Retorna estatísticas atualizadas em tempo real.

### Health Check
```
GET /api/status/health
```
Verifica saúde da API e banco de dados.

### Atualizar Métricas
```
POST /api/metricas/update
Body: {
  "uptime": 99.9,
  "resposta": 45,
  "ativos": 100,
  "produtos": 500,
  "notificacoes": 25
}
```

### Incidentes
```
GET /api/incidentes
```
Lista todos os incidentes.

### Componentes (NOVO!)
```
GET /api/componentes          # Listar todos os componentes
GET /api/componentes/:id      # Obter componente específico
PUT /api/componentes/:id      # Atualizar componente
POST /api/componentes         # Criar novo componente
```

#### Exemplo de Atualização de Componente:
```bash
PUT /api/componentes/1
Content-Type: application/json

{
  "status": "degraded",
  "uptime": 97.5,
  "latencia": 120,
  "notas": "Alta latência detectada - investigando"
}
```

##  Views e Procedures

### Views
- `v_status_geral`: Status consolidado do sistema
- `v_incidentes_ativos`: Incidentes em andamento

### Procedures
- `sp_atualizar_metricas()`: Atualiza métricas do sistema
- `sp_criar_incidente()`: Cria novo incidente
- `sp_resolver_incidente()`: Resolve incidente existente

##  Integração com Frontend

O frontend (`service-status.html`) consome automaticamente:
- Dados reais da API a cada 30 segundos
- Estatísticas em tempo real a cada 10 segundos
- Health check a cada 5 minutos

### Fallback
Em caso de erro na API, o sistema usa dados simulados para manter a funcionalidade.

##  Monitoramento Automático

### Cron Jobs Recomendados
```bash
# Atualizar métricas a cada hora
0 * * * * curl -X POST http://localhost:3000/api/metricas/update

# Health check a cada 5 minutos
*/5 * * * * curl http://localhost:3000/api/status/health
```

### Scripts de Monitoramento
```javascript
// Exemplo de script para atualizar métricas
const atualizarMetricas = async () => {
  const response = await fetch('/api/status/realtime');
  const data = await response.json();
  
  // Processar dados e atualizar métricas
  await fetch('/api/metricas/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uptime: 99.9,
      resposta: data.latencia,
      ativos: data.usuarios,
      produtos: data.produtos,
      notificacoes: data.notificacoes
    })
  });
};
```

##  Manutenção

### Limpeza de Dados Antigos
```sql
-- Limpar métricas antigas (manter últimos 30 dias)
DELETE FROM metricas_sistema 
WHERE DataAtualizacao < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Limpar incidentes resolvidos antigos (manter últimos 90 dias)
DELETE FROM incidentes 
WHERE Status = 'resolved' 
AND DataFim < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

### Backup
```bash
# Backup das tabelas de status
mysqldump -u root -p promoping metricas_sistema status_componentes incidentes > status_backup.sql
```

## 🔧 Troubleshooting

### Problemas Comuns

1. **API não responde**
   - Verificar se o servidor está rodando
   - Testar endpoint `/api/health`

2. **Dados não atualizam**
   - Verificar conexão com banco
   - Executar `npm run status:test`

3. **Frontend mostra dados simulados**
   - Verificar console do navegador
   - Testar endpoints da API manualmente

### Logs Úteis
```bash
# Logs do servidor
tail -f logs/server.log

# Logs de erro
grep "ERROR" logs/server.log
```

## 📚 Recursos Adicionais

- [Documentação da API](./API_ROUTES.md)
- [Guia de Deploy](../docs/DEPLOYMENT.md)
- [Arquitetura do Sistema](../docs/ARCHITECTURE.md)

## 🤝 Contribuição

Para adicionar novos componentes ou métricas:

1. Adicionar entrada em `status_componentes`
2. Atualizar API em `backend/routes/status.js`
3. Modificar frontend se necessário
4. Atualizar documentação

---

**Última atualização:** Janeiro 2024  
**Versão:** 1.0.0
