# 🚀 Setup Rápido - OAuth PHP

## Passo 1: Instalar Dependências

```bash
cd Painel_Administrativo_Php
composer install
```

## Passo 2: Configurar .env

Se você já tem credenciais OAuth configuradas em outro arquivo `.env` do projeto:

### Opção A: Usar o .env existente (se estiver na raiz do projeto)
```bash
# Copiar .env da raiz para o diretório PHP
cp ../.env .env
```

### Opção B: Criar novo .env apenas para PHP
```bash
# Copiar exemplo
cp env.example.txt .env

# Editar .env e adicionar suas credenciais:
```

```env
# ================== GOOGLE OAUTH ==================
GOOGLE_CLIENT_ID=928179391463-kkjun7plqvf61la74t0c975gjaleu51g.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# ================== GITHUB OAUTH ==================
GITHUB_CLIENT_ID=seu_github_client_id
GITHUB_CLIENT_SECRET=seu_github_client_secret

# Base URLs
BASE_URL=http://localhost/PromoPing/Painel_Administrativo_Php
DASHBOARD_URL=http://localhost/PromoPing/Painel_Administrativo_Php/pages/dashboard.html
```

## Passo 3: Verificar Configuração

Acesse: `http://localhost/PromoPing/Painel_Administrativo_Php/check_config.php`

Isso mostrará:
- ✅ Dependências instaladas
- ✅ Credenciais configuradas
- ✅ Status da sessão

## Passo 4: Testar Login

Acesse: `http://localhost/PromoPing/Painel_Administrativo_Php/login.php`

## ⚠️ URLs de Callback IMPORTANTES

Certifique-se de que as URLs de callback estão configuradas corretamente nos provedores OAuth:

### Google Cloud Console
```
Authorized redirect URIs:
http://localhost/PromoPing/Painel_Administrativo_Php/auth/google_callback.php
```

### GitHub Developer Settings
```
Authorization callback URL:
http://localhost/PromoPing/Painel_Administrativo_Php/auth/github_callback.php
```

## 🔧 Se já tem credenciais no backend Node.js

Se você já tem credenciais OAuth configuradas no backend Node.js, pode:

1. **Reutilizar as mesmas credenciais** (recomendado para desenvolvimento)
2. **Criar novos OAuth apps** (recomendado para produção)

### Reutilizar credenciais existentes

As URLs de callback precisam estar configuradas para AMBOS:
- Node.js: `http://127.0.0.1:3000/api/auth/google/callback`
- PHP: `http://localhost/PromoPing/Painel_Administrativo_Php/auth/google_callback.php`

**Nota:** Você pode adicionar múltiplas URLs de callback no Google/GitHub, então pode configurar ambas.

## ✅ Verificação Final

1. ✅ `composer install` executado
2. ✅ Arquivo `.env` criado com credenciais
3. ✅ URLs de callback configuradas no Google/GitHub
4. ✅ `check_config.php` mostra tudo OK
5. ✅ `login.php` abre sem erros

## 🎯 Pronto!

Agora você pode fazer login com Google ou GitHub no painel administrativo PHP!

