# 🚀 PromoPing - Início Rápido

## ⚡ Execução em 3 Passos

### 1. Clone o Projeto
```bash
git clone https://github.com/julia/PromoPing.git
cd PromoPing
```

### 2. Execute Automaticamente
```bash
node run.js
```

### 3. Acesse a Aplicação
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3000/api/health
- **phpMyAdmin** (se usar Docker): http://localhost:8081

## 🎯 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `node run.js` | Execução automática (recomendado) |
| `npm run dev` | Desenvolvimento local |
| `npm run docker:dev` | Com Docker |
| `npm run setup` | Configurar ambiente |
| `npm run check` | Verificar dependências |
| `npm run quick-start` | Setup + desenvolvimento |

## 🔧 Resolução de Problemas

### ❌ "Node.js não encontrado"
```bash
# Instale Node.js 18+ em: https://nodejs.org/
```

### ❌ "MySQL não acessível"
```bash
# Use Docker (mais fácil)
npm run docker:dev

# Ou instale MySQL localmente
```

### ❌ "Arquivo .env não encontrado"
```bash
npm run setup
```

### ❌ "Dependências em falta"
```bash
npm install
```

## 🐳 Com Docker (Mais Fácil)

Se você tem Docker instalado:
```bash
npm run docker:dev
```

Isso vai:
- ✅ Instalar todas as dependências
- ✅ Configurar MySQL automaticamente
- ✅ Criar base de dados
- ✅ Iniciar aplicação
- ✅ Incluir phpMyAdmin

## 💻 Desenvolvimento Local

Se preferir instalar localmente:
```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
npm run setup

# 3. Configurar MySQL
npm run db:init

# 4. Iniciar
npm run dev
```

## 📱 URLs Importantes

- **Aplicação**: http://localhost:3000
- **API Health**: http://localhost:3000/api/health
- **phpMyAdmin**: http://localhost:8081 (Docker)
- **MySQL**: localhost:3306

## 🆘 Precisa de Ajuda?

1. Execute `npm run check` para verificar dependências
2. Verifique se todas as portas estão livres
3. Consulte o README.md completo
4. Abra uma issue no GitHub

---

**🎉 Pronto! Agora é só usar!**
