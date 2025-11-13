# Installation

## Pré-requisitos

Antes de instalar o PromoPing, certifique-se de que tem os seguintes requisitos instalados no seu sistema:

**Requisitos Mínimos:**

* **Node.js 18+** (recomendado LTS)
* **MySQL 8.0+** ou MariaDB 10.3+
* **npm** ou yarn
* **Git**
* **Python 3.8+** (para o scraper)

## Instalação Local

{% stepper %}
{% step %}
### Clonar o Repositório

```
git clone https://github.com/juliareboucasleite/PromoPing.git
cd PromoPing
```
{% endstep %}

{% step %}
### Instalar Dependências

```bash
# Instalar dependências do Node.js
npm install

# Instalar dependências do Python Scraper
cd python-scraper
pip install -r requirements-simple.txt
cd ..
```
{% endstep %}

{% step %}
### Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de configuração
cp env-template.txt .env

# Editar o arquivo .env com suas configurações
nano .env
```

{% hint style="info" %}
Importante: Configure todas as variáveis obrigatórias no arquivo `.env` antes de prosseguir.
{% endhint %}
{% endstep %}

{% step %}
### Configurar Base de Dados

```bash
# Executar migrações da base de dados
npm run migrate

# Ou executar setup completo
npm run setup
```
{% endstep %}

{% step %}
### Iniciar o Servidor

```bash
# Iniciar em modo desenvolvimento
npm run dev

# Ou iniciar com execução automática
npm start
```
{% endstep %}
{% endstepper %}

## Instalação com Docker

### Desenvolvimento

```bash
# Iniciar ambiente de desenvolvimento
npm run docker:dev

# Ou diretamente com Docker Compose
docker-compose -f docker-files/docker-compose.dev.yml up --build
```

### Produção

```bash
# Deploy em produção
npm run docker:prod

# Ou diretamente com Docker Compose
docker-compose -f docker-files/docker-compose.yml up --build
```

## Configuração do Python Scraper

{% stepper %}
{% step %}
### Configurar Ambiente Unificado

```bash
# Copiar configuração unificada
copy python-scraper\env-unified.txt .env
```
{% endstep %}

{% step %}
### Executar Scraper

```bash
cd python-scraper

# Teste rápido
python start.py --test

# Iniciar monitorização
python start.py
```
{% endstep %}
{% endstepper %}

## Verificação da Instalação

{% stepper %}
{% step %}
### Verificar API

```bash
# Verificar se a API está funcionando
curl http://localhost:3000/api/health
```
{% endstep %}

{% step %}
### Verificar Frontend

Abra o navegador e acesse: [http://localhost:3000](http://localhost:3000/)
{% endstep %}

{% step %}
### Verificar Base de Dados

```bash
# Verificar conexão com MySQL
mysql -u root -p -e "USE promoping; SHOW TABLES;"
```
{% endstep %}
{% endstepper %}

## Configuração de Produção

### Variáveis de Ambiente Essenciais

```bash
# Base de Dados
DB_HOST=localhost
DB_USER=promoping_user
DB_PASSWORD=sua_password_segura
DB_NAME=promoping

# Autenticação
JWT_SECRET=sua_chave_jwt_muito_segura
GOOGLE_CLIENT_ID=seu_google_client_id
GOOGLE_CLIENT_SECRET=seu_google_client_secret

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_app

# Stripe (opcional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## Resolução de Problemas

<details>

<summary>Erro de Conexão com Base de Dados</summary>

Solução: Verifique se o MySQL está a correr e se as credenciais no `.env` estão corretas.

</details>

<details>

<summary>Erro de Dependências</summary>

Solução: Execute `npm install` novamente e verifique se tem Node.js 18+ instalado.

</details>

<details>

<summary>Erro de Permissões</summary>

Solução: No Linux/Mac, execute `sudo npm install` ou configure permissões adequadas.

</details>
