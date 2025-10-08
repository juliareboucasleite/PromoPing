# 🚀 Quick Start - Painel Administrativo

## ⚡ Início Rápido (5 minutos)

### 1. **Configurar Sistema**
```bash
# Instalar dependências (se necessário)
npm install

# Configurar sistema de status
npm run status:setup

# Iniciar servidor
npm run dev
```

### 2. **Acessar Painel**
Abra no navegador:
```
http://localhost:3000/pages/admin/status-panel.html
```

### 3. **Testar Funcionalidades**
```bash
# Teste rápido
npm run admin:test:rapido

# Teste completo
npm run admin:test
```

## 🎯 Funcionalidades Principais

### ✅ **Adicionar Componente**
1. Preencha o formulário "Adicionar Novo Componente"
2. Clique em "✅ Adicionar Componente"
3. Componente aparece na tabela

### ✅ **Editar Componente**
1. Clique em "✏️ Editar" na linha do componente
2. Modifique os campos no modal
3. Clique em "💾 Salvar Alterações"

### ✅ **Criar Incidente**
1. Preencha o formulário "Registrar Novo Incidente"
2. Selecione componente afetado (opcional)
3. Clique em "📝 Registrar Incidente"

### ✅ **Encerrar Incidente**
1. Localize incidente ativo na tabela
2. Clique em "🔒 Encerrar"
3. Confirme a ação

### ✅ **Filtrar e Exportar**
- **Filtros**: Por estado e componente
- **Exportar CSV**: Download rápido de dados (planos pagos)
- **Exportar Excel**: Relatório profissional (.xlsx) (planos pagos)
- **Plano Free**: Mensagem de upgrade elegante
- **Limpar**: Resetar filtros

### ✅ **Visualizar Dados**
- **Componentes**: Status, uptime, latência
- **Incidentes**: Histórico completo com filtros
- **Métricas**: Estatísticas do sistema

## 🔧 Exemplos Práticos

### **Adicionar Extensão Chrome**
```json
Nome: "Extensão Chrome"
Estado: "Operacional"
Uptime: 99.8
Latência: 25
Notas: "Extensão funcionando normalmente"
```

### **Reportar Manutenção**
```json
Estado: "Fora do Ar"
Uptime: 0
Latência: 0
Notas: "Manutenção programada - retorno em 2 horas"
```

### **Degradação de Performance**
```json
Estado: "Degradado"
Uptime: 95.5
Latência: 500
Notas: "Alta latência detectada - investigando"
```

### **Criar Incidente de Falha**
```json
Título: "Falha na API de notificações"
Descrição: "API retornando erro 500 para algumas requisições"
Impacto: "Atraso no envio de emails"
Estado: "investigating"
Componente: "API Principal"
```

### **Reportar Manutenção**
```json
Título: "Manutenção programada - API Principal"
Descrição: "Atualização de segurança e otimizações"
Impacto: "Serviço indisponível por 2 horas"
Estado: "identified"
Componente: "API Principal"
```

### **Exportar Relatório Excel** (Planos Pagos)
- Clique em "📈 Exportar Excel"
- Arquivo .xlsx será baixado automaticamente
- Inclui: ID, título, descrição, impacto, datas, estado, componente
- Formatação profissional com cabeçalhos e bordas
- Ideal para relatórios de PAP e apresentações

### **Sistema de Planos**
- **Free**: Visualização básica, sem exportação
- **Basic**: €9.99/mês - CSV + Excel, 100 incidentes/mês
- **Standard**: €19.99/mês - Tudo + PDF, 500 incidentes/mês
- **Premium**: €39.99/mês - Ilimitado + integrações
- **Upgrade**: Modal elegante com comparação de planos

## 🚨 Troubleshooting

### **Problema: API não responde**
```bash
# Verificar se servidor está rodando
npm run dev

# Testar conectividade
npm run admin:test:rapido
```

### **Problema: Dados não carregam**
```bash
# Reconfigurar sistema
npm run status:setup

# Verificar banco de dados
npm run status:test
```

### **Problema: Componentes não aparecem**
```bash
# Verificar tabelas
mysql -u root -p -e "SELECT * FROM promoping.status_componentes;"

# Testar API
npm run componentes:test
```

## 📱 Acesso Mobile

O painel é totalmente responsivo:
- ✅ **Desktop**: Layout completo
- ✅ **Tablet**: Layout adaptativo
- ✅ **Mobile**: Interface otimizada

## 🔄 Auto-refresh

O painel atualiza automaticamente:
- ⏰ **A cada 30 segundos**
- 🔄 **Botão manual de atualização**
- 📊 **Status da API em tempo real**

## 🎨 Status e Cores

| Status | Cor | Ícone | Descrição |
|--------|-----|-------|-----------|
| Operacional | 🟢 Verde | ✅ | Funcionando normalmente |
| Degradado | 🟡 Amarelo | ⚠️ | Problemas de performance |
| Fora do Ar | 🔴 Vermelho | ❌ | Serviço indisponível |

## 📊 Métricas Disponíveis

- **Uptime Geral**: Porcentagem de disponibilidade
- **Tempo de Resposta**: Latência média em ms
- **Usuários Ativos**: Número de usuários online
- **Produtos Monitorizados**: Total de produtos
- **Notificações Enviadas**: Notificações do dia

## 🔗 Links Úteis

- **Painel**: `http://localhost:3000/pages/admin/status-panel.html`
- **API Status**: `http://localhost:3000/api/status`
- **Health Check**: `http://localhost:3000/api/status/health`
- **Documentação**: `README.md`

## 🆘 Suporte

Se encontrar problemas:
1. Verifique o console do navegador (F12)
2. Execute `npm run admin:test` para diagnóstico
3. Consulte a documentação completa em `README.md`

---

**🎉 Pronto! O painel está funcionando e você pode começar a gerenciar o status do sistema.**
