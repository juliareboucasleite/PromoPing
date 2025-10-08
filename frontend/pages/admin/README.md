# Painel Administrativo de Status - PromoPing

Este é o painel administrativo completo para gerenciar o sistema de status do PromoPing.

## 📋 Funcionalidades

### ✅ Gestão de Componentes
- **Visualizar** todos os componentes do sistema
- **Adicionar** novos componentes (API, Extensão Chrome, App Móvel, etc.)
- **Editar** status, uptime, latência e notas dos componentes
- **Estatísticas** em tempo real dos componentes

### ✅ Gestão Completa de Incidentes
- **Criar** novos incidentes com título, impacto e descrição
- **Visualizar** histórico completo de incidentes
- **Encerrar** incidentes ativos (marca como resolvido)
- **Filtrar** por estado e componente em tempo real
- **Exportar** incidentes para CSV (planos pagos)
- **Exportar** relatórios profissionais para Excel (.xlsx) (planos pagos)
- **Status** em tempo real (investigando, identificado, monitorando, resolvido)

### ✅ Sistema de Planos
- **Plano Free**: Visualização básica, funcionalidades limitadas
- **Plano Basic**: Exportação CSV e Excel, até 100 incidentes/mês
- **Plano Standard**: Tudo do Basic + PDF, até 500 incidentes/mês
- **Plano Premium**: Funcionalidades ilimitadas + integrações avançadas
- **Upgrade**: Modal elegante com comparação de planos
- **Mensagens**: Call-to-action para planos pagos

### ✅ Métricas do Sistema
- **Uptime geral** do sistema
- **Tempo de resposta** médio
- **Usuários ativos**
- **Produtos monitorizados**
- **Notificações enviadas**

## 🚀 Como Usar

### 1. **Pré-requisitos**
```bash
# Certifique-se de que o servidor está rodando
npm run dev

# Configure o sistema de status (se ainda não foi feito)
npm run status:setup
```

### 2. **Acessar o Painel**
Abra o arquivo `status-panel.html` no navegador:
```
http://localhost:3000/pages/admin/status-panel.html
```

### 3. **Funcionalidades Principais**

#### **Adicionar Novo Componente**
1. Preencha o formulário na seção "Adicionar Novo Componente"
2. Clique em "✅ Adicionar Componente"
3. O componente será criado e aparecerá na tabela

#### **Editar Componente Existente**
1. Clique no botão "✏️ Editar" na linha do componente
2. Modifique os campos no modal que abrir
3. Clique em "💾 Salvar Alterações"

#### **Criar Novo Incidente**
1. Preencha o formulário na seção "Registrar Novo Incidente"
2. Selecione o componente afetado (opcional)
3. Clique em "📝 Registrar Incidente"

#### **Encerrar Incidente**
1. Localize o incidente ativo na tabela
2. Clique no botão "🔒 Encerrar"
3. Confirme a ação

#### **Filtrar Incidentes**
1. Use os filtros por estado e componente
2. Os resultados são atualizados instantaneamente
3. Clique em "🧹 Limpar Filtros" para resetar

#### **Exportar Dados** (Planos Pagos)
1. **CSV**: Clique em "📊 Exportar CSV" para download rápido
2. **Excel**: Clique em "📈 Exportar Excel" para relatório profissional
3. **Plano Free**: Mensagem de upgrade com call-to-action
4. Arquivos são baixados automaticamente

#### **Visualizar Dados**
- **Componentes**: Tabela com todos os componentes e seus status
- **Incidentes**: Histórico completo de incidentes com filtros
- **Métricas**: Cards com estatísticas do sistema

### 4. **Testar Funcionalidades**
```bash
# Teste rápido do painel
npm run admin:test:rapido

# Teste completo do painel
npm run admin:test

# Teste específico de incidentes
npm run incidentes:test

# Teste rápido de incidentes
npm run incidentes:test:rapido

# Teste de exportação Excel
npm run excel:test

# Teste rápido de exportação Excel
npm run excel:test:rapido

# Teste de funcionalidade de planos
npm run plans:test

# Teste rápido de planos
npm run plans:test:rapido
```

## 🎨 Interface

### **Design Responsivo**
- ✅ Funciona em desktop, tablet e mobile
- ✅ Layout adaptativo
- ✅ Cores e ícones intuitivos

### **Temas e Cores**
- **Operacional**: 🟢 Verde
- **Degradado**: 🟡 Amarelo  
- **Fora do Ar**: 🔴 Vermelho
- **Investigando**: 🔵 Azul
- **Resolvido**: ✅ Verde

### **Notificações**
- ✅ Toast notifications para feedback
- ✅ Loading overlay durante operações
- ✅ Status da API em tempo real

## 🔧 Configuração

### **URL da API**
Por padrão, o painel se conecta a:
```javascript
const API_URL = "http://localhost:3000/api";
```

Para alterar, edite o arquivo `script.js`:
```javascript
const API_URL = "https://seu-dominio.com/api";
```

### **Auto-refresh**
O painel atualiza automaticamente a cada 30 segundos:
```javascript
setInterval(carregarDados, 30000);
```

## 📊 Endpoints Utilizados

### **Componentes**
- `GET /api/status` - Obter status geral
- `POST /api/componentes` - Criar componente
- `PUT /api/componentes/:id` - Atualizar componente

### **Incidentes**
- `GET /api/incidentes` - Listar incidentes

### **Métricas**
- `GET /api/status` - Obter métricas do sistema

## 🛠️ Estrutura de Arquivos

```
frontend/pages/admin/
├── status-panel.html    # Interface principal
├── styles.css          # Estilos CSS
├── script.js           # Lógica JavaScript
└── README.md           # Esta documentação
```

## 🎯 Casos de Uso

### **Adicionar Novo Serviço**
```javascript
// Exemplo: Adicionar Extensão Chrome
{
  "nome": "Extensão Chrome",
  "status": "operational",
  "uptime": 99.8,
  "latencia": 25,
  "notas": "Extensão funcionando normalmente"
}
```

### **Atualizar Status Durante Manutenção**
```javascript
// Exemplo: Colocar API em manutenção
{
  "status": "outage",
  "uptime": 0,
  "latencia": 0,
  "notas": "Manutenção programada - retorno em 2 horas"
}
```

### **Reportar Problema**
```javascript
// Exemplo: Degradação de performance
{
  "status": "degraded",
  "uptime": 95.5,
  "latencia": 500,
  "notas": "Alta latência detectada - investigando"
}
```

## 🔍 Troubleshooting

### **Problemas Comuns**

#### **1. API não responde**
- Verifique se o servidor está rodando (`npm run dev`)
- Confirme a URL da API no `script.js`
- Verifique o console do navegador para erros

#### **2. Dados não carregam**
- Execute `npm run status:setup` para configurar o banco
- Verifique se as tabelas foram criadas
- Teste os endpoints manualmente

#### **3. Componentes não aparecem**
- Verifique se há dados na tabela `status_componentes`
- Execute `npm run componentes:test` para testar a API
- Verifique os logs do servidor

### **Logs Úteis**
```bash
# Logs do servidor
tail -f logs/server.log

# Testar API de componentes
npm run componentes:test

# Verificar banco de dados
mysql -u root -p -e "SELECT * FROM promoping.status_componentes;"
```

## 📱 Responsividade

### **Desktop (1200px+)**
- Layout em grid completo
- Todas as funcionalidades visíveis
- Tabelas com todas as colunas

### **Tablet (768px - 1199px)**
- Layout adaptativo
- Tabelas com scroll horizontal
- Formulários em coluna única

### **Mobile (< 768px)**
- Layout em coluna única
- Tabelas compactas
- Botões maiores para touch

## 🔐 Segurança

### **Recomendações**
- ✅ Use HTTPS em produção
- ✅ Implemente autenticação se necessário
- ✅ Valide dados no backend
- ✅ Use CORS adequadamente

### **Validações**
- ✅ Campos obrigatórios
- ✅ Tipos de dados corretos
- ✅ Valores dentro dos limites
- ✅ Sanitização de entrada

## 🚀 Próximos Passos

### **Funcionalidades Futuras**
- [ ] Autenticação de usuários
- [ ] Histórico de alterações
- [ ] Exportação de dados
- [ ] Notificações push
- [ ] Dashboard em tempo real
- [ ] Integração com Slack/Discord

### **Melhorias Técnicas**
- [ ] Cache de dados
- [ ] Paginação de tabelas
- [ ] Filtros avançados
- [ ] Gráficos de performance
- [ ] Backup automático

---

**Última atualização:** Janeiro 2024  
**Versão:** 1.0.0  
**Compatibilidade:** Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
