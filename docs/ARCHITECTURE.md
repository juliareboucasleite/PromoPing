# 🏗️ Arquitetura do PromoPing

## 📋 Visão Geral

O PromoPing é um sistema de monitoramento de preços que combina **PHP** para operações de base de dados e **Node.js** para bots e APIs avançadas.

## 🎯 Estrutura do Projeto

```
📦 PromoPing/
├── 🎨 frontend/                 # Interface do usuário
│   ├── pages/                   # Páginas HTML
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── dashboard.html
│   │   ├── produtos.html
│   │   └── perfil.html
│   ├── assets/
│   │   ├── images/              # Imagens e ícones
│   │   ├── styles/              # CSS
│   │   └── scripts/             # JavaScript
│   └── components/              # Componentes reutilizáveis
├── 🐘 php/                      # Backend PHP (Base de dados)
│   ├── api/
│   │   ├── auth/                # Autenticação
│   │   └── produtos/            # Gestão de produtos
│   └── includes/                # Funções e configurações
├── 🟢 backend/                  # Backend Node.js (Bots & API)
│   ├── bots/                    # Bots Discord, Telegram, etc
│   ├── routes/                  # Rotas da API
│   └── middleware/              # Middleware de autenticação
├── ⚙️ config/                   # Configurações centralizadas
│   ├── database.php
│   ├── app.php
│   ├── bots.js
│   └── env.example
├── 📚 docs/                     # Documentação
└── 🗄️ sql/                      # Scripts de base de dados
```

## 🔄 Fluxo de Dados

### 1. **Autenticação**
```
Frontend → PHP API → MySQL → JWT Token → Frontend
```

### 2. **Gestão de Produtos**
```
Frontend → PHP API → MySQL → Frontend
```

### 3. **Notificações**
```
Node.js Bots → Discord/Telegram/WhatsApp → Usuário
```

### 4. **Scraping de Preços**
```
Node.js Scheduler → Scraping → MySQL → Notificações
```

## 🛠️ Tecnologias Utilizadas

### **Frontend**
- **HTML5** - Estrutura das páginas
- **CSS3** - Estilos e design responsivo
- **JavaScript (Vanilla)** - Interatividade
- **Design System** - Componentes reutilizáveis

### **Backend PHP**
- **PHP 8+** - Lógica de negócio
- **MySQLi** - Conexão com base de dados
- **JWT** - Autenticação
- **Validação** - Sanitização de dados

### **Backend Node.js**
- **Express.js** - Servidor web
- **Discord.js** - Bot Discord
- **Telegraf** - Bot Telegram
- **Twilio** - WhatsApp/SMS
- **Puppeteer** - Web scraping

### **Base de Dados**
- **MySQL** - Dados principais
- **Estrutura normalizada** - Relacionamentos

## 🔐 Segurança

### **Autenticação**
- JWT tokens com expiração
- Hash de senhas com `password_hash()`
- Rate limiting por IP
- Validação de entrada

### **Proteção de Dados**
- Sanitização de inputs
- Prepared statements
- CORS configurado
- Headers de segurança

## 📊 Base de Dados

### **Tabelas Principais**
```sql
usuarios          # Dados dos usuários
produtos          # Produtos monitorizados
precos_historico  # Histórico de preços
notificacoes      # Log de notificações
activity_logs     # Log de atividades
```

## 🚀 Deploy e Configuração

### **Ambiente de Desenvolvimento**
1. Clone o repositório
2. Configure o `.env` baseado no `config/env.example`
3. Execute `npm install`
4. Configure a base de dados MySQL
5. Execute `node server.js`

### **Ambiente de Produção**
1. Configure variáveis de ambiente
2. Use HTTPS
3. Configure proxy reverso (Nginx)
4. Configure SSL/TLS
5. Configure backup automático

## 🔧 Configurações

### **Variáveis de Ambiente**
```env
# Aplicação
APP_ENV=production
APP_DEBUG=false
APP_URL=https://promoping.com

# Base de dados
DB_HOST=localhost
DB_USER=promoping_user
DB_PASS=secure_password
DB_NAME=promoping

# Bots
DISCORD_TOKEN=your_token
TELEGRAM_TOKEN=your_token
TWILIO_ACCOUNT_SID=your_sid
```

## 📈 Monitoramento

### **Logs**
- **PHP**: `logs/error.log`
- **Node.js**: Console + arquivo
- **Atividades**: Tabela `activity_logs`

### **Métricas**
- Produtos monitorizados
- Notificações enviadas
- Erros de scraping
- Performance da API

## 🔄 Manutenção

### **Backup**
- Base de dados diário
- Arquivos de configuração
- Logs importantes

### **Atualizações**
- Dependências Node.js
- Bibliotecas PHP
- Segurança

## 🎯 Próximos Passos

1. **Implementar cache** (Redis)
2. **Adicionar mais lojas** para scraping
3. **Implementar gráficos** de preços
4. **Adicionar API REST** completa
5. **Implementar testes** automatizados
6. **Adicionar CI/CD** pipeline

## 📞 Suporte

Para dúvidas ou problemas:
- **Documentação**: `/docs/`
- **Issues**: GitHub Issues
- **Email**: suporte@promoping.com
