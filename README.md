# PromoPing - Monitor de Preços

[![Version](https://img.shields.io/badge/version-2.0.1-blue.svg)](https://github.com/juliareboucasleite/PromoPing)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)

Sistema de monitoramento de preços para consumidores portugueses. O PromoPing permite acompanhar produtos em múltiplas lojas online portuguesas e receber notificações automáticas quando os preços baixam, ajudando os utilizadores a poupar dinheiro nas suas compras.

## Funcionalidades

**Interface Web**
- Dashboard responsivo com histórico de preços detalhado
- Gestão completa de produtos e alertas personalizados
- Estatísticas de economia e gráficos de evolução de preços
- Sistema de filtros avançados para produtos
- Interface intuitiva e acessível

**Sistema de Utilizador**
- Registro e login seguros com autenticação JWT
- Perfil personalizável com preferências de notificação
- Sistema de verificação de email
- Login social com Google OAuth
- Gestão de conta e dados pessoais

**Sistema de Notificações**
- **Discord Bot** - Notificações em tempo real no Discord
- **Email** - Notificações por correio eletrónico
- Configuração personalizada de frequência de alertas
- Histórico completo de notificações enviadas

**Lojas Suportadas**
O PromoPing suporta monitoramento em todas as principais lojas online portuguesas: Worten, IKEA, Pingo Doce, Continente, FNAC, Amazon, Radio Popular, Auchan, PcDiga e muitas outras.

**Funcionalidades Avançadas**
- Detecção automática de loja a partir da URL do produto
- Configuração de preço alvo personalizado
- Alertas por percentagem de desconto
- Comparação de preços entre lojas
- Exportação de dados em Excel e PDF

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

**Backend**
- **Node.js** - Runtime JavaScript para servidor
- **Express.js** - Framework web minimalista e flexível
- **MySQL** - Base de dados relacional para persistência
- **JWT** - Autenticação stateless segura
- **Discord.js** - Integração com API do Discord
- **Telegram Bot API** - Integração com bots do Telegram
- **Nodemailer** - Envio de emails transacionais

**Frontend**
- **HTML5/CSS3** - Estrutura e estilização moderna
- **JavaScript ES6+** - Lógica de interface e interatividade
- **Chart.js** - Visualização de dados e gráficos de preços
- **Responsive Design** - Interface adaptável a todos os dispositivos

**DevOps e Infraestrutura**
- **Docker** - Containerização para desenvolvimento e produção
- **PM2** - Gestão de processos Node.js em produção
- **Nginx** - Servidor web e proxy reverso
- **Git** - Controlo de versões distribuído

## API

A API do PromoPing é RESTful e utiliza JSON para comunicação. Todos os endpoints requerem autenticação via JWT, exceto os de registo e login.

**Autenticação**
- `POST /api/auth/register` - Registro de novo utilizador
- `POST /api/auth/login` - Autenticação com email/password
- `POST /api/auth/google` - Login social com Google OAuth
- `GET /api/auth/verify` - Verificação de email
- `POST /api/auth/refresh` - Renovar token de acesso

**Gestão de Produtos**
- `GET /api/produtos` - Listar produtos do utilizador
- `POST /api/produtos` - Adicionar novo produto para monitoramento
- `PUT /api/produtos/:id` - Atualizar configurações do produto
- `DELETE /api/produtos/:id` - Remover produto do monitoramento
- `GET /api/produtos/:id/historico` - Obter histórico de preços

**Sistema de Notificações**
- `GET /api/notificacoes` - Listar notificações do utilizador
- `POST /api/notificacoes` - Enviar notificação manual
- `PUT /api/notificacoes/:id` - Marcar notificação como lida
- `GET /api/notificacoes/preferencias` - Obter preferências de notificação
- `PUT /api/notificacoes/preferencias` - Atualizar preferências

**Estatísticas e Relatórios**
- `GET /api/stats/economia` - Estatísticas de economia do utilizador
- `GET /api/stats/produtos` - Estatísticas de produtos monitorizados
- `GET /api/export/excel` - Exportar dados em Excel
- `GET /api/export/pdf` - Exportar relatório em PDF

**Status do Sistema**
- `GET /api/status` - Status geral do sistema
- `GET /api/status/health` - Health check da API
- `GET /api/status/uptime` - Tempo de atividade do servidor

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
- **Email**: juliareboucasleite@gmail.com
- **GitHub Issues**: Para reportar bugs e solicitar funcionalidades
- **Discord**: Servidor da comunidade (link no site)

**Documentação**
- [Guia de Instalação](docs/installation.md)
- [API Reference](docs/api-reference.md)
- [FAQ](docs/faq.md)
- [Changelog](CHANGELOG.md)

**Roadmap**
- Suporte a mais lojas online
- Integração com redes sociais
- App mobile nativo
- Sistema de recomendações
- API pública para desenvolvedores
