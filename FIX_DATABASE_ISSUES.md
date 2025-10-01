# 🔧 Correção dos Problemas do Banco de Dados

## ❌ Problemas Identificados

### 1. **Erro de Coluna Inexistente**
```
Error: Unknown column 'Plano' in 'field list'
```
**Causa**: A query está tentando buscar a coluna `Plano` que não existe na tabela `ConfigUtilizador`.

**Solução**: ✅ Corrigido - Alterado para `PlanoId`

### 2. **Erro de Sintaxe SQL**
```
You have an error in your SQL syntax near ')'
```
**Causa**: Query com `IN ()` vazio quando não há produtos.

**Solução**: ✅ Corrigido - Adicionada verificação antes da query

## ✅ Correções Implementadas

### 1. **Arquivo: `backend/routes/produtos.js`**
- **Linha 22**: Alterado `Plano` para `PlanoId`
- **Linhas 84-93**: Adicionada verificação para evitar `IN ()` vazio

### 2. **Estrutura da Tabela ConfigUtilizador**
A tabela deve ter as seguintes colunas:
- `UserId` (INT)
- `PlanoId` (INT) - Referência à tabela Planos
- `LimiteProdutos` (INT)
- `DataAtivacao` (DATETIME)

## 🚀 Próximos Passos

1. **Reiniciar o servidor backend**:
   ```bash
   cd backend
   node server.js
   ```

2. **Testar funcionalidades**:
   - Adicionar produtos
   - Listar produtos
   - Verificar se os erros foram resolvidos

## 📋 Verificação da Estrutura

Para verificar se a tabela `ConfigUtilizador` tem a estrutura correta:

```sql
DESCRIBE ConfigUtilizador;
```

Deve mostrar:
- `UserId`
- `PlanoId` 
- `LimiteProdutos`
- `DataAtivacao`
