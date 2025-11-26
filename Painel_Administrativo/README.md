# Painel Administrativo PromoPing

Painel administrativo moderno desenvolvido com PHP e Soft UI Dashboard, incluindo autenticação OAuth através de Google e GitHub.

## Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Uso](#uso)
- [Desenvolvimento](#desenvolvimento)
- [Documentação](#documentação)
- [Licença](#licença)

## Sobre o Projeto

Painel administrativo desenvolvido para gerenciamento e controle de funcionalidades do PromoPing. O sistema oferece interface moderna e responsiva, com autenticação segura através de OAuth 2.0, permitindo acesso através de contas Google ou GitHub.

### Principais Funcionalidades

- Autenticação OAuth 2.0 (Google e GitHub)
- Dashboard responsivo e moderno
- Gestão de sessões de usuário
- Interface baseada em Soft UI Dashboard
- Documentação integrada
- Perfil de usuário
- Sistema de billing e tabelas de dados

## Tecnologias

### Backend
- **PHP 8.0+** - Linguagem de programação
- **Composer** - Gerenciador de dependências PHP
- **League OAuth2 Client** - Biblioteca OAuth2
  - `league/oauth2-google` - Integração com Google
  - `league/oauth2-github` - Integração com GitHub
- **vlucas/phpdotenv** - Gerenciamento de variáveis de ambiente

### Frontend
- **Soft UI Dashboard** - Template Bootstrap 5
- **Bootstrap 5** - Framework CSS
- **JavaScript** - Linguagem de script
- **SCSS/SASS** - Pré-processador CSS
- **Gulp** - Build tool para desenvolvimento

## Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- PHP 8.0 ou superior
- Composer
- Node.js e NPM (para desenvolvimento frontend)
- Servidor web (Apache/Nginx) ou XAMPP
- Contas de desenvolvedor para:
  - Google Cloud Platform (para OAuth Google)
  - GitHub (para OAuth GitHub)

## Instalação

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd Painel_Administrativo
```

### 2. Instale as dependências PHP

```bash
composer install
```

### 3. Instale as dependências Node.js (opcional, para desenvolvimento)

```bash
npm install
```

### 4. Configure o servidor web

Certifique-se de que o diretório do projeto está acessível através do seu servidor web configurado.

## Configuração

### 1. Variáveis de Ambiente

Copie o arquivo de exemplo e configure suas variáveis:

```bash
cp env.example.txt .env
```

Edite o arquivo `.env` com suas credenciais:

```env
# OAuth Google
GOOGLE_CLIENT_ID=seu_client_id_google
GOOGLE_CLIENT_SECRET=seu_client_secret_google

# OAuth GitHub
GITHUB_CLIENT_ID=seu_client_id_github
GITHUB_CLIENT_SECRET=seu_client_secret_github

# Configurações de Sessão
SESSION_NAME=promoping_session
SESSION_LIFETIME=86400

# URLs Base
BASE_URL=http://localhost/caminho/para/projeto
DASHBOARD_URL=http://localhost/caminho/para/projeto/pages/dashboard.html
```

### 2. Configurar OAuth Google

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Crie um novo projeto ou selecione um existente
3. Ative a API OAuth 2.0
4. Crie credenciais (OAuth 2.0 Client ID)
5. Configure as URLs de redirecionamento autorizadas:
   - `http://seu-dominio/auth/google_callback.php`
   - `http://localhost/seu-projeto/auth/google_callback.php` (para desenvolvimento)
6. Copie o Client ID e Client Secret para o arquivo `.env`

### 3. Configurar OAuth GitHub

1. Acesse [GitHub Developer Settings](https://github.com/settings/developers)
2. Clique em "New OAuth App"
3. Preencha as informações:
   - **Application name**: PromoPing Admin Panel
   - **Homepage URL**: URL do seu projeto
   - **Authorization callback URL**: `http://seu-dominio/auth/github_callback.php`
4. Copie o Client ID e Client Secret para o arquivo `.env`

### 4. Verificar Configuração

Execute o script de verificação:

```bash
php check_config.php
```

Este script verifica se todas as configurações necessárias estão presentes.

## Estrutura do Projeto

```
Painel_Administrativo/
├── assets/                 # Recursos estáticos
│   ├── css/               # Arquivos CSS
│   ├── js/                # Arquivos JavaScript
│   ├── img/               # Imagens e ícones
│   └── scss/              # Arquivos SCSS fonte
├── auth/                  # Arquivos de autenticação OAuth
│   ├── google_login.php
│   ├── google_callback.php
│   ├── github_login.php
│   ├── github_callback.php
│   └── logout.php
├── pages/                 # Páginas da aplicação
│   ├── dashboard.html
│   ├── dashboard_protected.php
│   ├── profile.html
│   ├── billing.html
│   ├── tables.html
│   └── docs/             # Documentação
├── vendor/               # Dependências Composer
├── config.php            # Arquivo de configuração principal
├── login.php             # Página de login
├── check_config.php      # Script de verificação
├── composer.json         # Dependências PHP
├── package.json          # Dependências Node.js
├── env.example.txt       # Exemplo de variáveis de ambiente
└── README.md            # Este arquivo
```

## Uso

### Acessando o Painel

1. Inicie seu servidor web (Apache/Nginx ou XAMPP)
2. Acesse o projeto através do navegador:
   ```
   http://localhost/caminho/para/Painel_Administrativo
   ```
3. Você será redirecionado para a página de login
4. Escolha um método de autenticação (Google ou GitHub)
5. Após autenticação bem-sucedida, você será redirecionado para o dashboard

### Funcionalidades Disponíveis

- **Dashboard**: Visão geral do sistema
- **Perfil**: Gerenciamento de perfil de usuário
- **Billing**: Informações de cobrança
- **Tabelas**: Visualização de dados em formato tabular
- **Documentação**: Acesso à documentação do sistema

### Logout

Para fazer logout, acesse o endpoint de logout ou use a funcionalidade disponível na interface.

## Desenvolvimento

### Ambiente de Desenvolvimento

Para trabalhar com os assets (CSS/JS), você precisará do Node.js e das dependências instaladas:

```bash
npm install
```

### Compilar Assets

Usando Gulp para compilar SCSS e processar assets:

```bash
npm run watch    # Modo watch para desenvolvimento
npm start        # Abrir aplicação
```

### Estrutura de Código

- Mantenha arquivos PHP organizados e bem documentados
- Siga os padrões PSR-4 para autoloading
- Use variáveis de ambiente para configurações sensíveis
- Não commite arquivos `.env` no repositório

### Boas Práticas

- Sempre verifique autenticação em páginas protegidas usando `requireAuth()`
- Use as funções auxiliares em `config.php` para gerenciar sessões
- Mantenha as credenciais OAuth seguras e nunca as exponha no código
- Teste em ambiente de desenvolvimento antes de fazer deploy

## Documentação

A documentação completa do sistema está disponível em:

```
pages/docs/
```

Acesse através da interface do painel ou diretamente em:

```
http://seu-dominio/pages/docs/docs.html
```

### Documentação Disponível

- Guia de Instalação
- Guia de Uso
- Referência da API
- FAQ
- Histórico de Mudanças
- Termos de Uso
- Política de Privacidade

## Licença

Este projeto está licenciado sob a MIT License.

### Licença MIT

```
MIT License

Copyright (c) 2024 PromoPing

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Dependências e Templates

Este projeto utiliza o template Soft UI Dashboard da Creative Tim, que também está licenciado sob MIT License.

As dependências podem ter licenças diferentes. Consulte os arquivos de licença individuais em `vendor/` para mais detalhes sobre cada dependência utilizada.

## Suporte

Para questões, problemas ou sugestões:

1. Consulte a documentação em `pages/docs/`
2. Verifique o FAQ em `pages/docs/faq.html`
3. Entre em contato através do sistema de suporte em `pages/docs/support.html`

## Contribuindo

Ao contribuir com este projeto:

1. Mantenha o código limpo e bem documentado
2. Siga os padrões de código existentes
3. Teste suas alterações antes de submeter
4. Documente mudanças significativas

---

Desenvolvido para PromoPing
