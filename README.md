# PromoPing - Monitor de Preços Inteligente

[![Version](https://img.shields.io/badge/version-2.0.1-blue.svg)](https://github.com/juliareboucasleite/PromoPing)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)

Sistema inteligente de monitoramento de preços para o consumidor português. O PromoPing é uma plataforma completa que permite monitorar preços de produtos em lojas online portuguesas e receber notificações automáticas quando os preços baixam.

## Funcionalidades Principais

### Interface Moderna
- Dashboard responsivo e intuitivo
- Design system consistente
- Navegação fluida entre páginas
- Cards de produtos com histórico visual

### Sistema de Utilizador
- Registro e login seguros
- Perfil personalizável
- Preferências de notificação
- Estatísticas de economia

### Gestão de Produtos
- Adição de produtos via URL
- Detecção automática de loja
- Configuração de preço alvo
- Histórico de preços detalhado
- Filtros avançados

### Sistema de Notificações
- **Discord Bot** - Notificações em tempo real
- **Telegram Bot** - Mensagens diretas
- **Email** - Notificações por correio eletrónico

### Lojas Suportadas
- Worten
- IKEA
- Pingo Doce
- Continente
- FNAC
- Amazon
- Radio Popular
- Auchan
- PcDiga

## Instalação e Configuração

### Pré-requisitos
- Node.js 18+ 
- MySQL 8.0+
- npm ou yarn

### Instalação Local
```bash
# Clonar o repositório
git clone https://github.com/juliareboucasleite/PromoPing.git
cd PromoPing

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar o arquivo .env com suas configurações

# Iniciar o servidor
npm start
```

### Instalação com Docker
```bash
# Desenvolvimento
npm run docker:dev

# Produção
npm run docker:prod
```

## Estrutura do Projeto

```
PromoPing-2.0.1/
├── backend/                 # Servidor Node.js/Express
│   ├── controllers/        # Controladores da API
│   ├── database/          # Configuração e modelos do banco
│   ├── middleware/         # Middlewares de autenticação
│   ├── routes/            # Rotas da API
│   ├── services/          # Serviços de negócio
│   └── utils/             # Utilitários
├── frontend/              # Interface web
├── config-files/          # Arquivos de configuração
├── docker-files/          # Configurações Docker
├── deploy-files/          # Scripts de deploy
└── docs/                  # Documentação
```

## Tecnologias Utilizadas

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **MySQL** - Base de dados
- **JWT** - Autenticação
- **Discord.js** - Bot Discord
- **Telegram Bot API** - Bot Telegram

### Frontend
- **HTML5/CSS3** - Interface web
- **JavaScript** - Interatividade
- **Chart.js** - Gráficos de preços

### DevOps
- **Docker** - Containerização
- **PM2** - Gestão de processos
- **Nginx** - Servidor web

## API Endpoints

### Autenticação
- `POST /api/auth/register` - Registro de utilizador
- `POST /api/auth/login` - Login
- `POST /api/auth/google` - Login com Google
- `GET /api/auth/verify` - Verificação de email

### Produtos
- `GET /api/produtos` - Listar produtos
- `POST /api/produtos` - Adicionar produto
- `PUT /api/produtos/:id` - Atualizar produto
- `DELETE /api/produtos/:id` - Remover produto

### Notificações
- `GET /api/notificacoes` - Listar notificações
- `POST /api/notificacoes` - Enviar notificação
- `PUT /api/notificacoes/:id` - Marcar como lida

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## Suporte

Para suporte, envie um email para suporte@promoping.pt ou abra uma issue no GitHub.