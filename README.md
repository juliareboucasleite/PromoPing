# PromoPing - Monitor de Preços

# PromoPing - Monitor de Preços

[PromoPing Logo](https://raw.githubusercontent.com/juliareboucasleite/PromoPing/main/docs/logo.png)

[![version](https://img.shields.io/badge/version-Pap-blue.svg)](https://github.com/juliareboucasleite/PromoPing)
[![LICENSE](https://img.shields.io/badge/LICENSE-PromoPing-orange?link=https%3A%2F%2Fpromoping.gitbook.io%2Fpromoping-docs)](https://promoping.gitbook.io/promoping-docs)
[![node.js](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org)
[![Site](https://img.shields.io/badge/site-promoping.pt-brightgreen?logo=Google-Chrome&logoColor=white&label=Site)](https://promoping.pt)



Sistema de monitoramento de preços para consumidores portugueses. O PromoPing permite acompanhar produtos em múltiplas lojas online portuguesas e receber notificações automáticas quando os preços baixam, ajudando os utilizadores a poupar dinheiro nas suas compras.

## Funcionalidades

### **Interface Web Avançada**
- **Dashboard Responsivo** - Interface moderna e intuitiva com design adaptável
- **Histórico de Preços Detalhado** - Gráficos interativos e análise temporal
- **Gestão Completa de Produtos** - Adicionar, editar e remover produtos monitorizados
- **Sistema de Alertas Personalizados** - Configuração flexível de notificações
- **Estatísticas de Economia** - Relatórios detalhados de poupanças
- **Filtros Avançados** - Busca e filtragem inteligente de produtos
- **Interface Acessível** - Design inclusivo seguindo padrões WCAG

### **Sistema de Utilizador Robusto**
- **Autenticação Segura** - JWT com refresh tokens e validação robusta
- **Perfil Personalizável** - Configurações detalhadas de preferências
- **Verificação de Email** - Sistema completo de validação de conta
- **Login Social** - Integração com Google OAuth e Discord
- **Gestão de Conta** - Atualização de dados pessoais e segurança
- **Sistema de Planos** - Free, Basic, Standard e Premium com diferentes limites

### **Sistema de Notificações Multi-Canal**
- **Discord Bot** - Notificações em tempo real com Rich Presence
- **Email Transacional** - Notificações por correio eletrónico com templates
- **Configuração Personalizada** - Frequência e tipos de alertas personalizáveis
- **Histórico Completo** - Log detalhado de todas as notificações enviadas

### **Lojas Suportadas (20+ Lojas)**
**Principais Lojas Portuguesas:**
- **Worten** - Eletrónica e eletrodomésticos
- **FNAC** - Livros, música e tecnologia
- **Continente** - Supermercado e produtos gerais
- **Pingo Doce** - Alimentação e produtos domésticos
- **IKEA** - Móveis e decoração
- **Radio Popular** - Eletrónica e informática
- **Auchan** - Hipermercado e produtos diversos
- **PcDiga** - Informática e tecnologia

**Lojas Internacionais:**
- **Amazon** - Marketplace global com bypass de cookies
- **Outras lojas** - Sistema genérico para detecção automática

### **Funcionalidades Avançadas**
- **Detecção Automática de Loja** - Identificação inteligente a partir da URL
- **Preço Alvo Personalizado** - Definição de metas de preço flexíveis
- **Alertas por Percentagem** - Notificações baseadas em descontos
- **Comparação de Preços** - Análise entre diferentes lojas
- **Exportação de Dados** - Excel e PDF com relatórios detalhados
- **Sistema de Planos** - Limites diferenciados por subscrição
- **Períodos de Graça** - Gestão automática de trial periods
- **Rate Limiting** - Proteção contra abuso e DDoS

## Arquitetura do Sistema

### **Arquitetura Microserviços**
O PromoPing utiliza uma arquitetura modular composta por múltiplos componentes independentes:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │  Python Scraper │
│   (HTML/CSS/JS) │◄──►│   (Node.js)     │◄──►│   (Selenium)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   MySQL DB      │◄─────────────┘
         │              │   (Dados)       │
         │              └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Notificações   │
│ (Discord/Email) │
└─────────────────┘
```

### **Componentes Principais**

**Frontend (Interface Web)**
- **Tecnologia**: HTML5, CSS3, JavaScript ES6+
- **Arquitetura**: SPA (Single Page Application) com módulos
- **Características**: Responsivo, acessível, otimizado para performance
- **Localização**: `frontend/` - Páginas estáticas servidas pelo Express

**Backend (API REST)**
- **Tecnologia**: Node.js + Express.js
- **Arquitetura**: API RESTful com middleware modular
- **Características**: Rate limiting, CORS seguro, autenticação JWT
- **Localização**: `backend/` - Servidor principal e rotas

**Python Scraper (Monitorização)**
- **Tecnologia**: Python + Selenium + BeautifulSoup
- **Arquitetura**: Processo independente com scheduler
- **Características**: Scraping inteligente, bypass de proteções, logs detalhados
- **Localização**: `python-scraper/` - Sistema de monitorização de preços

**Base de Dados**
- **Tecnologia**: MySQL 8.0+ com Sequelize ORM
- **Arquitetura**: Relacional com tabelas normalizadas
- **Características**: Índices otimizados, prepared statements, migrações automáticas
- **Localização**: `backend/database/` - Modelos e configurações

**Sistema de Notificações**
- **Discord**: Bot com Rich Presence e comandos slash
- **Email**: Nodemailer com templates personalizados
- **SMS**: Twilio para notificações móveis (opcional)
- **Localização**: `backend/services/` - Serviços de notificação

### **Fluxo de Dados**

1. **Utilizador** adiciona produto via interface web
2. **Backend** valida dados e armazena na base de dados
3. **Python Scraper** monitoriza preços periodicamente
4. **Sistema de Notificações** envia alertas quando metas são atingidas
5. **Frontend** atualiza interface com novos dados

### **Segurança e Performance**

- **Autenticação**: JWT com refresh tokens e validação robusta
- **Rate Limiting**: Proteção contra DDoS e abuso de API
- **CORS**: Configuração segura com validação de origens
- **SQL Injection**: Prepared statements em todas as queries
- **XSS Protection**: Sanitização de entradas e escape de HTML
- **Logs**: Sistema completo de auditoria e monitorização

## Instalação

**Pré-requisitos**
- Node.js 18+ (recomendado LTS)
- MySQL 8.0+ ou MariaDB 10.3+
- npm ou yarn
- Git

**Configuração do Ambiente**
Antes de iniciar, certifique-se de ter configurado as variáveis de ambiente necessárias no arquivo `.env`:

```env
# Base de Dados
DB_HOST=localhost
DB_USER=promoping_user
DB_PASSWORD=sua_password
DB_NAME=promoping

# Autenticação
JWT_SECRET=seu_jwt_secret_aqui
GOOGLE_CLIENT_ID=seu_google_client_id
GOOGLE_CLIENT_SECRET=seu_google_client_secret

# Bots
DISCORD_TOKEN=seu_discord_bot_token
TELEGRAM_TOKEN=seu_telegram_bot_token

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_app
```

**Instalação Local**
```bash
# Clonar o repositório
git clone https://github.com/juliareboucasleite/PromoPing.git
cd PromoPing

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar o arquivo .env com suas configurações

# Configurar base de dados
npm run migrate

# Iniciar o servidor
npm start
```

**Docker (Recomendado)**
```bash
# Desenvolvimento
npm run docker:dev

# Produção
npm run docker:prod

# Parar containers
npm run docker:stop
```

## Tecnologias

### **Backend (Node.js)**
- **Node.js 18+** - Runtime JavaScript assíncrono e não-bloqueante
- **Express.js 5.x** - Framework web minimalista com middleware robusto
- **MySQL 8.0+** - Base de dados relacional com performance otimizada
- **Sequelize ORM** - Mapeamento objeto-relacional com migrações automáticas
- **JWT (jsonwebtoken)** - Autenticação stateless com refresh tokens
- **bcrypt** - Hashing seguro de passwords com salt rounds
- **express-rate-limit** - Rate limiting para proteção contra DDoS
- **cors** - Configuração segura de Cross-Origin Resource Sharing
- **cookie-parser** - Gestão de cookies para sessões
- **dotenv** - Gestão de variáveis de ambiente

### **Sistema de Notificações**
- **Discord.js 14.x** - Bot Discord com Rich Presence e comandos slash
- **Telegraf** - Framework para bots do Telegram
- **Twilio** - API para envio de SMS e WhatsApp
- **Nodemailer** - Envio de emails transacionais com templates
- **Passport.js** - Autenticação social (Google OAuth, Discord)

### **Frontend (Web)**
- **HTML5** - Estrutura semântica e acessível
- **CSS3** - Estilização moderna com Flexbox e Grid
- **JavaScript ES6+** - Lógica de interface com módulos ES6
- **Chart.js** - Visualização de dados e gráficos interativos
- **Responsive Design** - Interface adaptável (mobile-first)
- **Progressive Web App** - Funcionalidades offline e instalação

### **Python Scraper**
- **Python 3.8+** - Linguagem principal do scraper
- **Selenium WebDriver** - Automação de navegador para scraping
- **BeautifulSoup4** - Parsing de HTML e extração de dados
- **Requests** - HTTP client para requisições web
- **Pandas** - Manipulação e análise de dados
- **Schedule** - Agendamento de tarefas periódicas

### **Base de Dados**
- **MySQL 8.0** - Sistema de gestão de base de dados relacional
- **Índices Otimizados** - Performance melhorada para queries complexas
- **Prepared Statements** - Proteção contra SQL injection
- **Transações ACID** - Consistência e integridade dos dados
- **Backup Automático** - Estratégias de backup e recuperação

### **DevOps e Infraestrutura**
- **Docker & Docker Compose** - Containerização para desenvolvimento e produção
- **PM2** - Gestão de processos Node.js com auto-restart
- **Nginx** - Servidor web e proxy reverso com load balancing
- **Git** - Controlo de versões distribuído com branching
- **GitHub Actions** - CI/CD para testes e deployment automático
- **Supervisor** - Gestão de processos em containers

### **Segurança e Monitorização**
- **Helmet.js** - Headers de segurança HTTP
- **Express-validator** - Validação e sanitização de dados
- **Winston** - Sistema de logging estruturado
- **Morgan** - Logger de requisições HTTP
- **Rate Limiting** - Proteção contra abuso e DDoS
- **CORS** - Configuração segura de origens permitidas

### **Integrações Externas**
- **Stripe** - Processamento de pagamentos e subscrições
- **Google OAuth 2.0** - Autenticação social com Google
- **Discord API** - Integração com Discord para notificações
- **Twilio API** - Serviços de SMS e comunicação
- **SMTP** - Envio de emails via Gmail/Outlook

## Segurança

### **Análise de Segurança Completa**
O PromoPing 2.1.2 passou por uma auditoria de segurança completa, identificando e corrigindo **5 vulnerabilidades críticas**:

| Vulnerabilidade | Status | Severidade | Correção |
|----------------|--------|------------|----------|
| JWT Secret Hardcoded | OK **CORRIGIDO** | Crítica | Variáveis de ambiente obrigatórias |
| XSS na Barra de Pesquisa | OK **CORRIGIDO** | Alta | Sanitização robusta de entradas |
| CORS Mal Configurado | OK **CORRIGIDO** | Alta | Validação dinâmica de origens |
| SQL Injection Potencial | OK **CORRIGIDO** | Média | Validação completa de timestamps |
| Falta de Rate Limiting | OK **CORRIGIDO** | Média | Rate limiting em todas as APIs |

### **Medidas de Segurança Implementadas**

**Proteção Frontend**
- **Sanitização de Entrada** - Remoção de caracteres perigosos
- **Escape HTML** - Uso de `textContent` para evitar XSS
- **Validação de Comprimento** - Limites de tamanho para entradas
- **Prevenção ReDoS** - Limitação de complexidade de regex
- **Tratamento de Erros** - Try-catch para operações perigosas

**Proteção Backend**
- **Autenticação JWT** - Validação obrigatória de variáveis de ambiente
- **Rate Limiting** - Limitação de requisições por IP (100/15min)
- **Validação de Entrada** - Sanitização de parâmetros
- **CORS Seguro** - Validação dinâmica de origens
- **Prepared Statements** - Prevenção de SQL injection
- **Logs de Segurança** - Registro de tentativas suspeitas

**Configurações de Segurança**
- **Variáveis de Ambiente** - Secrets não expostos no código
- **Headers de Segurança** - CORS configurado adequadamente
- **Validação de Dados** - Múltiplas camadas de validação
- **Tratamento de Erros** - Respostas informativas sem vazamento de dados

### **Rate Limiting Configurado**
```javascript
// Rate limiting geral: 500 requisições por IP a cada 15 minutos
// Rate limiting de autenticação: 50 tentativas por IP a cada 15 minutos
// Rate limiting de produtos: 100 requisições por IP por minuto
// Rate limiting OAuth: 100 tentativas por IP a cada 15 minutos
```

### **Status de Segurança**
- **Nível de Risco**: **BAIXO** OK
- **Vulnerabilidades Ativas**: **0** OK
- **Conformidade**: **Adequado para produção** OK
- **Próxima Auditoria**: **3 meses**

##  Sistema Python Scraper

### **Arquitetura do Scraper**
O PromoPing inclui um sistema de monitorização de preços desenvolvido em Python que funciona de forma independente do backend Node.js:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Scheduler     │    │   Web Scraper   │    │   Price Checker │
│   (Schedule)    │───►│   (Selenium)    │───►│   (BeautifulSoup)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   Store Detector│              │
         │              │   (Worten/FNAC) │              │
         │              └─────────────────┘              │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MySQL DB      │◄───│   Price Update  │◄───│   Notification  │
│   (Shared)      │    │   (Database)    │    │   (Discord/Email)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Funcionalidades do Scraper**

**Lojas Suportadas**
- **Worten** - Eletrónica e eletrodomésticos (scraper otimizado)
- **FNAC** - Livros, música e tecnologia (sistema complexo de cookies)
- **Amazon** - Marketplace global (bypass de cookies)
- **Sistema Genérico** - Fallback para outras lojas

**Características Técnicas**
- **Selenium WebDriver** - Automação de navegador Chrome
- **BeautifulSoup4** - Parsing inteligente de HTML
- **Sistema de Cookies** - Bypass de proteções anti-bot
- **User-Agent Rotação** - Evitar detecção de scraping
- **Timeouts Inteligentes** - Adaptação a diferentes velocidades de carregamento
- **Logs Detalhados** - Monitorização completa de operações

**Sistema de Planos Integrado**
```python
# Intervalos de verificação por plano
PLAN_INTERVALS = {
    'free': 24 * 60 * 60,      # 24 horas
    'basic': 4 * 60 * 60,      # 4 horas  
    'standard': 30 * 60,       # 30 minutos
    'premium': 5 * 60          # 5 minutos
}
```

**Monitorização Inteligente**
- **Detecção de Metas** - Alertas automáticos quando preços atingem metas
- **Histórico de Preços** - Armazenamento temporal de variações
- **Análise de Tendências** - Identificação de padrões de preços
- **Reinicialização Automática** - Recuperação de erros sem intervenção manual

### **Configuração e Execução**

**Instalação Rápida**
```bash
# Instalar dependências
pip install -r python-scraper/requirements-simple.txt

# Configurar ambiente unificado
copy python-scraper/env-unified.txt .env

# Executar scraper
cd python-scraper
python start.py --test  # Teste rápido
python start.py         # Execução completa
```

**Configurações Principais**
```env
# Intervalo entre ciclos (segundos)
CYCLE_INTERVAL=120

# Modo headless (True/False)
HEADLESS=False

# Tempo máximo de espera (segundos)
MAX_WAIT=10

# User Agent personalizado
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
```

### **Integração com Backend**
- **Base de Dados Compartilhada** - Usa as mesmas tabelas MySQL
- **Configuração Unificada** - Arquivo `.env` compartilhado
- **Execução Independente** - Pode rodar simultaneamente com Node.js
- **Não Interferência** - Operações isoladas e seguras

## Docker e Deployment

### **Containerização Completa**
O PromoPing oferece suporte completo ao Docker para desenvolvimento e produção:

**Desenvolvimento**
```bash
# Iniciar ambiente de desenvolvimento
npm run docker:dev

# Ou diretamente com Docker Compose
docker-compose -f docker-files/docker-compose.dev.yml up --build
```

**Produção**
```bash
# Deploy em produção
npm run docker:prod

# Ou diretamente com Docker Compose
docker-compose -f docker-files/docker-compose.yml up --build
```

### **Arquitetura de Containers**

```yaml
# docker-compose.yml (Produção)
services:
  promoping:
    build: .
    ports:
      - "80:80"      # Nginx
      - "3000:3000"  # Node.js
    environment:
      - NODE_ENV=production
      - DB_HOST=mysql
    depends_on:
      - mysql
      - redis

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_DATABASE=promoping
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

### **Serviços Incluídos**

**Aplicação Principal**
- **Node.js** - Backend API e frontend
- **Nginx** - Servidor web e proxy reverso
- **Supervisor** - Gestão de processos
- **PM2** - Process manager para Node.js

**Base de Dados**
- **MySQL 8.0** - Base de dados principal
- **Redis** - Cache e sessões
- **Volumes Persistentes** - Dados preservados entre restarts

**Ferramentas de Desenvolvimento**
- **Hot Reload** - Recarregamento automático em desenvolvimento
- **Logs Centralizados** - Todos os logs em `/var/log/supervisor`
- **Debug Mode** - Configurações específicas para desenvolvimento

### **Configuração de Produção**

**Variáveis de Ambiente**
```env
NODE_ENV=production
DB_HOST=mysql
DB_USER=promoping
DB_PASSWORD=promoping_password
DB_NAME=promoping
REDIS_HOST=redis
REDIS_PORT=6379
```

**Volumes Persistentes**
- `mysql_data` - Dados da base de dados MySQL
- `redis_data` - Cache e sessões Redis
- `./logs` - Logs da aplicação
- `./uploads` - Ficheiros carregados

**Portas Expostas**
- **80** - Nginx (HTTP)
- **443** - Nginx (HTTPS) - configurável
- **3000** - Node.js (desenvolvimento)
- **3306** - MySQL (acesso direto)
- **6379** - Redis (acesso direto)

### **Scripts de Deployment**

**Deploy Automático**
```bash
# Script de deploy incluído
./deploy-files/deploy.sh

# Ou usando npm
npm run docker:prod
```

**Gestão de Containers**
```bash
# Parar todos os serviços
npm run docker:stop

# Ver logs
docker-compose logs -f

# Aceder ao container
docker-compose exec promoping bash
```

### **Monitorização e Logs**

**Logs Centralizados**
- **Aplicação**: `/var/log/supervisor/promoping.log`
- **Nginx**: `/var/log/nginx/access.log`
- **MySQL**: `/var/log/mysql/error.log`
- **Redis**: `/var/log/redis/redis.log`

**Health Checks**
- **API Health**: `GET /api/health`
- **Database**: Verificação automática de conectividade
- **Redis**: Ping automático para verificar disponibilidade

## API REST

A API do PromoPing é RESTful e utiliza JSON para comunicação. Todos os endpoints requerem autenticação via JWT, exceto os de registo e login.

### **Autenticação e Utilizadores**

**Registo e Login**
- `POST /api/auth/register` - Registro de novo utilizador
- `POST /api/auth/login` - Autenticação com email/password
- `POST /api/auth/google` - Login social com Google OAuth
- `POST /api/auth/discord` - Login social com Discord OAuth
- `GET /api/auth/verify` - Verificação de email
- `POST /api/auth/refresh` - Renovar token de acesso
- `POST /api/auth/logout` - Logout e invalidação de token

**Gestão de Utilizador**
- `GET /api/user/me` - Obter dados do utilizador atual
- `PUT /api/user/profile` - Atualizar perfil do utilizador
- `PUT /api/user/password` - Alterar password
- `DELETE /api/user/account` - Eliminar conta do utilizador

### **Gestão de Produtos**

**CRUD de Produtos**
- `GET /api/produtos` - Listar produtos do utilizador (com paginação)
- `POST /api/produtos` - Adicionar novo produto para monitoramento
- `GET /api/produtos/:id` - Obter detalhes de um produto específico
- `PUT /api/produtos/:id` - Atualizar configurações do produto
- `DELETE /api/produtos/:id` - Remover produto do monitoramento
- `GET /api/produtos/:id/historico` - Obter histórico de preços

**Filtros e Busca**
- `GET /api/produtos/search?q=termo` - Buscar produtos por nome
- `GET /api/produtos/filter?loja=worten` - Filtrar por loja
- `GET /api/produtos/sort?by=preco&order=asc` - Ordenar produtos

### **Sistema de Notificações**

**Gestão de Notificações**
- `GET /api/notificacoes` - Listar notificações do utilizador
- `GET /api/notificacoes/unread` - Notificações não lidas
- `POST /api/notificacoes` - Enviar notificação manual
- `PUT /api/notificacoes/:id` - Marcar notificação como lida
- `DELETE /api/notificacoes/:id` - Eliminar notificação
- `PUT /api/notificacoes/mark-all-read` - Marcar todas como lidas

**Preferências de Notificação**
- `GET /api/notificacoes/preferencias` - Obter preferências de notificação
- `PUT /api/notificacoes/preferencias` - Atualizar preferências
- `POST /api/notificacoes/test` - Enviar notificação de teste

### **Sistema de Pagamentos**

**Planos e Subscrições**
- `GET /api/payment/plans` - Listar planos disponíveis
- `POST /api/payment/subscribe` - Criar subscrição
- `GET /api/payment/subscription` - Obter detalhes da subscrição
- `PUT /api/payment/subscription` - Atualizar subscrição
- `DELETE /api/payment/subscription` - Cancelar subscrição

**Gestão de Pagamentos**
- `GET /api/payment/invoices` - Listar faturas
- `GET /api/payment/invoices/:id` - Obter fatura específica
- `POST /api/payment/webhook` - Webhook do Stripe

### **Estatísticas e Relatórios**

**Estatísticas do Utilizador**
- `GET /api/stats/economia` - Estatísticas de economia do utilizador
- `GET /api/stats/produtos` - Estatísticas de produtos monitorizados
- `GET /api/stats/notificacoes` - Estatísticas de notificações
- `GET /api/stats/atividade` - Atividade recente do utilizador

**Exportação de Dados**
- `GET /api/export/excel` - Exportar dados em Excel
- `GET /api/export/pdf` - Exportar relatório em PDF
- `GET /api/export/csv` - Exportar dados em CSV
- `POST /api/export/custom` - Exportação personalizada

### **Configurações e Preferências**

**Configurações do Sistema**
- `GET /api/config` - Obter configurações do sistema
- `PUT /api/config` - Atualizar configurações
- `GET /api/config/lojas` - Listar lojas suportadas
- `GET /api/config/planos` - Obter detalhes dos planos

**Preferências do Utilizador**
- `GET /api/user/preferences` - Obter preferências do utilizador
- `PUT /api/user/preferences` - Atualizar preferências
- `GET /api/user/preferences/notifications` - Preferências de notificação
- `PUT /api/user/preferences/notifications` - Atualizar preferências de notificação

### **Status e Monitorização**

**Status do Sistema**
- `GET /api/status` - Status geral do sistema
- `GET /api/health` - Health check da API
- `GET /api/status/uptime` - Tempo de atividade do servidor
- `GET /api/status/database` - Status da base de dados
- `GET /api/status/redis` - Status do Redis

**Logs e Debugging**
- `GET /api/logs` - Obter logs do sistema (admin)
- `GET /api/logs/errors` - Logs de erro
- `GET /api/logs/access` - Logs de acesso

### **Endpoints Especiais**

**Notificações Diretas**
- `POST /notify` - Enviar notificação direta (email/SMS)

**Frontend Includes**
- `GET /inc/header.html` - Header do site
- `GET /inc/footer.html` - Footer do site
- `GET /inc/load-includes.js` - Script de carregamento

**Redirecionamentos**
- `GET /redirect` - Redirecionamento baseado em configuração
- `GET /auth/discord` - Redirecionamento para Discord OAuth

## Monitorização e Logs

### **Sistema de Logging Estruturado**

O PromoPing implementa um sistema completo de logging para monitorização e debugging:

**Níveis de Log**
- **ERROR** - Erros críticos que requerem atenção imediata
- **WARN** - Avisos sobre situações anómalas
- **INFO** - Informações gerais sobre operações
- **DEBUG** - Detalhes técnicos para debugging
- **HTTP** - Logs de requisições HTTP (Morgan)

**Categorias de Logs**
```javascript
// Logs de aplicação
console.log("OK Produto adicionado:", produto);
console.warn(" Rate limit atingido:", ip);
console.error("Erro na base de dados:", error);

// Logs de segurança
console.warn("Tentativa de acesso CORS não autorizada:", origin);
console.log("Login bem-sucedido:", email);
console.error("Tentativa de login suspeita:", ip);

// Logs de scraping
console.log("Iniciando ciclo de scraping");
console.log("OK Preço atualizado:", produto, preco);
console.warn(" Erro no scraping:", loja, error);
```

### **Monitorização em Tempo Real**

**Health Checks Automáticos**
- **API Status**: `GET /api/health` - Verificação de saúde da API
- **Database**: Ping automático à base de dados MySQL
- **Redis**: Verificação de conectividade do cache
- **External APIs**: Monitorização de serviços externos (Stripe, Discord)

**Métricas de Performance**
- **Response Time** - Tempo de resposta das APIs
- **Memory Usage** - Uso de memória do Node.js
- **CPU Usage** - Utilização do processador
- **Database Connections** - Pool de conexões MySQL
- **Rate Limiting** - Estatísticas de rate limiting

### **Sistema de Alertas**

**Alertas Automáticos**
- **Sistema Down** - Quando a API não responde
- **Database Error** - Erros críticos na base de dados
- **High Memory Usage** - Uso excessivo de memória
- **Rate Limit Exceeded** - Tentativas de abuso
- **Scraping Failures** - Falhas no sistema de scraping

**Canais de Notificação**
- **Discord** - Alertas em tempo real no servidor
- **Email** - Notificações por correio eletrónico
- **Log Files** - Registro em ficheiros de log
- **Console** - Output direto no terminal

### **Logs por Componente**

**Backend (Node.js)**
```
/var/log/supervisor/promoping.log
- Requisições HTTP
- Erros de aplicação
- Operações de base de dados
- Autenticação e autorização
```

**Python Scraper**
```
python-scraper/scraper.log
- Ciclos de scraping
- Preços atualizados
- Erros de scraping
- Metas atingidas
```

**Nginx (Web Server)**
```
/var/log/nginx/access.log
- Requisições HTTP
- Status codes
- Response times
- User agents
```

**MySQL (Database)**
```
/var/log/mysql/error.log
- Erros de base de dados
- Queries lentas
- Conexões perdidas
- Deadlocks
```

### **Ferramentas de Monitorização**

**Logs Centralizados**
```bash
# Ver todos os logs em tempo real
docker-compose logs -f

# Logs específicos
docker-compose logs -f promoping
docker-compose logs -f mysql
docker-compose logs -f redis

# Filtrar por nível
docker-compose logs | grep ERROR
docker-compose logs | grep WARN
```

**Análise de Logs**
```bash
# Contar erros por tipo
grep "ERROR" /var/log/supervisor/promoping.log | wc -l

# Top IPs com mais requisições
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr

# Queries mais lentas
grep "slow query" /var/log/mysql/error.log
```

### **Dashboard de Monitorização**

**Métricas em Tempo Real**
- **Uptime** - Tempo de atividade do sistema
- **Active Users** - Utilizadores ativos
- **Products Monitored** - Produtos em monitorização
- **Notifications Sent** - Notificações enviadas
- **API Calls** - Chamadas à API por minuto

**Gráficos e Estatísticas**
- **Response Time Chart** - Gráfico de tempos de resposta
- **Error Rate** - Taxa de erros por hora
- **Memory Usage** - Uso de memória ao longo do tempo
- **Database Performance** - Performance da base de dados

### **Manutenção e Debugging**

**Comandos Úteis**
```bash
# Verificar status dos serviços
docker-compose ps

# Reiniciar um serviço específico
docker-compose restart promoping

# Aceder ao container para debugging
docker-compose exec promoping bash

# Ver logs de erro específicos
docker-compose logs --tail=100 promoping | grep ERROR
```

**Limpeza de Logs**
```bash
# Limpar logs antigos (manter últimos 7 dias)
find /var/log -name "*.log" -mtime +7 -delete

# Comprimir logs antigos
gzip /var/log/supervisor/promoping.log.1
```

## Contribuição

O PromoPing é um projeto open-source e aceita contribuições da comunidade. Se quiser contribuir:

1. **Fork do repositório** - Crie um fork do projeto no GitHub
2. **Clone local** - `git clone https://github.com/SEU_USERNAME/PromoPing.git`
3. **Crie uma branch** - `git checkout -b feature/SuaFeature`
4. **Desenvolva** - Implemente a sua funcionalidade ou correção
5. **Teste** - Certifique-se de que os testes passam
6. **Commit** - `git commit -m 'Adiciona feature: descrição'`
7. **Push** - `git push origin feature/SuaFeature`
8. **Pull Request** - Abra um PR no repositório original

**Diretrizes de Contribuição**
- Siga as convenções de código existentes
- Adicione testes para novas funcionalidades
- Documente alterações significativas
- Mantenha commits pequenos e focados
- Use mensagens de commit descritivas

## Licença

Este projeto está licenciado sob a Licença . Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## Suporte

**Canais de Suporte**
- **Email**: corporation.promoping@gmail.com
- **GitHub Issues**: Para reportar bugs e solicitar funcionalidades
- **Discord**: [Servidor da comunidade](https://discord.gg/PXBXKXmfph)

**Documentação**
- [Guia de Instalação](frontend/pages/docs/installation.html)
- [API Reference](frontend/pages/docs/api-reference.html)
- [FAQ](frontend/pages/docs/faq.html)
- [Changelog](frontend/pages/docs/changelog.html)

**Roadmap**
- Suporte a mais lojas online
- Integração com redes sociais
- App mobile nativo
- Sistema de recomendações
- API pública para desenvolvedores
