# Configuração OAuth - PromoPing

Este guia explica como configurar autenticação OAuth com Google e GitHub no Painel Administrativo PHP.

## 📋 Pré-requisitos

- PHP 8.0 ou superior
- Composer instalado
- Servidor web (Apache/Nginx) ou XAMPP rodando em `http://localhost/PromoPing/Painel_Administrativo_Php/`

## 🚀 Instalação

### 1. Instalar Dependências

```bash
cd Painel_Administrativo_Php
composer install
```

Isso instalará:
- `league/oauth2-google` - Provider OAuth para Google
- `league/oauth2-github` - Provider OAuth para GitHub
- `vlucas/phpdotenv` - Gerenciamento de variáveis de ambiente

### 2. Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux/Mac
cp .env.example .env
```

Edite o arquivo `.env` e preencha com suas credenciais OAuth (obtenha as instruções abaixo).

## 🔐 Configurar Google OAuth

### Passo 1: Criar Projeto no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Google+ API** (agora chamada de **Google Identity API**)
   - Vá em "APIs & Services" > "Library"
   - Busque por "Google Identity"
   - Clique em "Enable"

### Passo 2: Criar Credenciais OAuth

1. Vá em "APIs & Services" > "Credentials"
2. Clique em "Create Credentials" > "OAuth client ID"
3. Se solicitado, configure a **OAuth consent screen**:
   - Tipo: Internal (para desenvolvimento) ou External (produção)
   - Preencha nome do app, email de suporte, etc.
4. Configure o OAuth Client ID:
   - **Application type**: Web application
   - **Name**: PromoPing Admin
   - **Authorized JavaScript origins**:
     ```
     http://localhost
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost/PromoPing/Painel_Administrativo_Php/auth/google_callback.php
     ```
5. Clique em "Create"
6. Copie o **Client ID** e **Client Secret**
7. Cole no arquivo `.env`:
   ```env
   GOOGLE_CLIENT_ID=seu_client_id_aqui
   GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
   ```

## 🐙 Configurar GitHub OAuth

### Passo 1: Criar OAuth App no GitHub

1. Acesse [GitHub Developer Settings](https://github.com/settings/developers)
2. Clique em "OAuth Apps" > "New OAuth App"
3. Preencha o formulário:
   - **Application name**: PromoPing Admin
   - **Homepage URL**: 
     ```
     http://localhost/PromoPing/Painel_Administrativo_Php/
     ```
   - **Authorization callback URL**:
     ```
     http://localhost/PromoPing/Painel_Administrativo_Php/auth/github_callback.php
     ```
4. Clique em "Register application"
5. Copie o **Client ID**
6. Clique em "Generate a new client secret"
7. Copie o **Client Secret** (apenas mostrado uma vez!)
8. Cole no arquivo `.env`:
   ```env
   GITHUB_CLIENT_ID=seu_client_id_aqui
   GITHUB_CLIENT_SECRET=seu_client_secret_aqui
   ```

### Passo 2: Configurar Permissões (Opcional)

Por padrão, o app já solicita permissão de email (`user:email`). Se precisar de outras permissões, edite `auth/github_login.php` e adicione ao array `scope`.

## 🧪 Testando Localmente

### 1. Verificar Instalação

```bash
# Verificar se o Composer instalou as dependências
ls vendor/league/oauth2-google
ls vendor/league/oauth2-github
```

### 2. Testar Login

1. Acesse: `http://localhost/PromoPing/Painel_Administrativo_Php/login.php`
2. Clique em "Entrar com Google" ou "Entrar com GitHub"
3. Você será redirecionado para o provedor OAuth
4. Autorize o acesso
5. Será redirecionado de volta para o dashboard

### 3. Verificar Sessão

Após login bem-sucedido, você deve ser redirecionado para:
```
http://localhost/PromoPing/Painel_Administrativo_Php/pages/dashboard.html
```

Os dados do usuário serão armazenados em `$_SESSION['user']` com:
- `id` - ID do usuário
- `name` - Nome completo
- `email` - Email
- `picture` - URL da foto de perfil
- `provider` - 'google' ou 'github'
- `login_time` - Timestamp do login

## 🛡️ Segurança

### Proteger Páginas

Para proteger uma página, adicione no início:

```php
<?php
require_once __DIR__ . '/../config.php';
requireAuth(); // Redireciona para login se não autenticado

$user = getLoggedUser();
?>
```

### Fazer Logout

```php
<?php
require_once __DIR__ . '/../config.php';
logout();
header('Location: ' . BASE_URL . '/login.php');
exit;
?>
```

Ou simplesmente acesse: `http://localhost/PromoPing/Painel_Administrativo_Php/auth/logout.php`

## 🔧 Solução de Problemas

### Erro: "Configuração OAuth não encontrada"

- Verifique se o arquivo `.env` existe
- Verifique se as variáveis estão preenchidas
- Verifique se o `vendor/autoload.php` foi gerado pelo Composer

### Erro: "State inválido"

- Limpe os cookies do navegador
- Verifique se a sessão PHP está funcionando
- Tente novamente o login

### Erro: "Redirect URI mismatch"

- Verifique se as URLs de callback no Google/GitHub estão **exatamente** como:
  - Google: `http://localhost/PromoPing/Painel_Administrativo_Php/auth/google_callback.php`
  - GitHub: `http://localhost/PromoPing/Painel_Administrativo_Php/auth/github_callback.php`
- URLs são case-sensitive e devem corresponder exatamente

### Erro 404 ao acessar login.php

- Verifique se o servidor web está rodando
- Verifique se o caminho está correto: `http://localhost/PromoPing/Painel_Administrativo_Php/login.php`

### Foto de perfil não aparece

- Verifique se a sessão está salvando os dados corretamente
- Verifique os logs do PHP: `var/log/apache_error.log` ou logs do PHP

## 📝 Estrutura de Arquivos

```
Painel_Administrativo_Php/
├── auth/
│   ├── google_login.php       # Inicia login Google
│   ├── google_callback.php    # Processa retorno Google
│   ├── github_login.php       # Inicia login GitHub
│   ├── github_callback.php    # Processa retorno GitHub
│   └── logout.php             # Faz logout
├── config.php                 # Configurações e funções
├── login.php                  # Página de login
├── .env                       # Variáveis de ambiente (não commitado)
├── .env.example              # Exemplo de .env
├── composer.json             # Dependências
└── vendor/                    # Dependências instaladas
```

## 🚀 Produção

Para usar em produção:

1. Altere `BASE_URL` no `.env` para sua URL de produção
2. Configure HTTPS (OAuth requer HTTPS em produção)
3. Atualize as URLs de callback nos provedores OAuth
4. Configure sessões seguras no PHP:
   ```php
   ini_set('session.cookie_secure', 1);
   ini_set('session.cookie_httponly', 1);
   ```

## 📚 Recursos

- [League OAuth2 Client](https://oauth2-client.thephpleague.com/)
- [Google OAuth2 Docs](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Docs](https://docs.github.com/en/developers/apps/building-oauth-apps)

