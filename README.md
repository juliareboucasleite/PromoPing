# 🎯 PromoPing - Monitor de Preços Inteligente

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/julia/PromoPing)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)

> **Sistema inteligente de monitoramento de preços para o consumidor português**

O PromoPing é uma plataforma completa que permite monitorar preços de produtos em lojas online portuguesas e receber notificações automáticas quando os preços baixam. Economize dinheiro de forma inteligente! 💰

## ✨ Funcionalidades Principais

### 🎨 **Interface Moderna**
- Dashboard responsivo e intuitivo
- Design system consistente
- Navegação fluida entre páginas
- Cards de produtos com histórico visual

### 👤 **Sistema de Utilizador**
- Registro e login seguros
- Perfil personalizável
- Preferências de notificação
- Estatísticas de economia

### 📦 **Gestão de Produtos**
- Adição de produtos via URL
- Detecção automática de loja
- Configuração de preço alvo
- Histórico de preços detalhado
- Filtros avançados

### 🔔 **Sistema de Notificações**
- **Discord Bot** - Notificações em tempo real
- **Telegram Bot** - Mensagens diretas
- **WhatsApp** - Via Twilio

### 🏪 **Lojas Suportadas**
- Worten
- IKEA
- Pingo Doce
- Continente
- FNAC
- Amazon

## 🏗️ Arquitetura

### **Frontend** (HTML/CSS/JS)
```
frontend/
├── pages/          # Páginas HTML
└── assets/
    ├── images/     # Imagens e ícones
    ├── styles/     # CSS organizado
    └── scripts/    # JavaScript modular
```

### **Backend Node.js** (API, Bots e Serviços)
```
backend/
├── routes/         # Rotas da API (auth, produtos, user, config)
├── services/       # Integrações (Discord, Telegram, Twilio, scraping)
├── middleware/     # Autenticação e outros middlewares
├── db.js           # Conexão com MySQL
└── server.js       # Servidor Express
```

## 🚀 Instalação Super Rápida

### **Método 1: Execução Automática (Recomendado)**
```bash
# Clone o repositório
git clone https://github.com/julia/PromoPing.git
cd PromoPing

# Execute tudo automaticamente
node run.js
```

### **Método 2: Com Docker (Mais Fácil)**
```bash
# Clone e execute com Docker
git clone https://github.com/julia/PromoPing.git
cd PromoPing
npm run docker:dev
```

### **Método 3: Setup Manual**
```bash
# 1. Clone o repositório
git clone https://github.com/julia/PromoPing.git
cd PromoPing

# 2. Setup automático
npm run setup

# 3. Instalar dependências
npm install

# 4. Iniciar
npm run dev
```

### **Pré-requisitos (Apenas para método manual)**
- Node.js 18+
- MySQL 8.0+

> **💡 Dica:** O script `run.js` detecta automaticamente se você tem Docker e escolhe o melhor método!

## ⚙️ Configuração

### **Variáveis de Ambiente**
```env
# Aplicação
APP_ENV=development
APP_URL=http://localhost:3000
JWT_SECRET=your_jwt_secret

# Base de Dados
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=promoping

# Bots
DISCORD_TOKEN=your_discord_token
TELEGRAM_TOKEN=your_telegram_token
TWILIO_ACCOUNT_SID=your_twilio_sid
```

### **Configuração dos Bots**

#### **Discord Bot**
1. Crie uma aplicação no [Discord Developer Portal](https://discord.com/developers/applications)
2. Copie o token para `DISCORD_TOKEN`
3. Configure as permissões necessárias

#### **Telegram Bot**
1. Fale com [@BotFather](https://t.me/botfather)
2. Crie um novo bot
3. Copie o token para `TELEGRAM_TOKEN`

#### **WhatsApp (Twilio)**
1. Crie uma conta no [Twilio](https://www.twilio.com/)
2. Configure o WhatsApp Sandbox
3. Copie as credenciais

## 📊 Tecnologias

### **Frontend**
- **HTML5** - Estrutura semântica
- **CSS3** - Design responsivo e moderno
- **JavaScript** - Interatividade e APIs
- **Design System** - Componentes reutilizáveis

### **Backend**
- **Node.js** - API e bots
- **Express.js** - Servidor web
- **MySQL** - Base de dados relacional
- **JWT** - Autenticação
- **bcrypt** - Hash de senhas

### **Bots & Integrações**
- **Discord.js** - Bot Discord
- **Telegraf** - Bot Telegram
- **Twilio** - WhatsApp/SMS
- **Puppeteer** - Web scraping

### **Ferramentas**
- **Git** - Controle de versão
- **ESLint** - Qualidade de código
- **Prettier** - Formatação
- **JWT** - Autenticação

## 🔐 Segurança

- ✅ **JWT Tokens** com expiração
- ✅ **Hash de senhas** com `bcrypt`
- ✅ **Rate limiting** por IP
- ✅ **Validação de entrada** rigorosa
- ✅ **Prepared statements** contra SQL injection
- ✅ **CORS** configurado
- ✅ **Headers de segurança**

## 📈 Roadmap

### **v1.1** - Próximas Funcionalidades
- [ ] Gráficos de histórico de preços
- [ ] API REST completa
- [ ] Cache com Redis
- [ ] Testes automatizados

### **v1.2** - Expansão
- [ ] Mais lojas portuguesas
- [ ] App mobile
- [ ] Notificações push
- [ ] Comparador de preços

### **v2.0** - Avançado
- [ ] IA para previsão de preços
- [ ] Integração com cashback
- [ ] API pública
- [ ] Dashboard analytics

## 🤝 Contribuição

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

- **Documentação**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/julia/PromoPing/issues)
- **Email**: suporte@promoping.com

## 🙏 Agradecimentos

- Comunidade Discord.js
- Equipe do Telegraf
- Twilio pela API de WhatsApp
- Todos os contribuidores

---

**Feito com ❤️ por Julia & Lucas** 🇵🇹