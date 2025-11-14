# PromoPing - Monitor de Preços

[![version](https://img.shields.io/badge/version-Pap-blue.svg)](https://github.com/juliareboucasleite/PromoPing)
[![LICENSE](https://img.shields.io/badge/LICENSE-PromoPing-orange?link=https%3A%2F%2Fpromoping.gitbook.io%2Fpromoping-docs)](https://promoping.gitbook.io/promoping-docs)
[![node.js](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org)
[![Site](https://img.shields.io/badge/site-promoping.pt-brightgreen?logo=Google-Chrome&logoColor=white&label=Site)](http://promoping.pt/)

## Sobre o PromoPing

O PromoPing é um sistema avançado de monitoramento de preços desenvolvido especificamente para consumidores portugueses. A plataforma permite acompanhar produtos em múltiplas lojas online e receber notificações automáticas quando os preços atingem metas definidas, ajudando os utilizadores a tomar decisões de compra informadas e a economizar dinheiro.

## Funcionalidades Principais

### Interface Web Avançada

O PromoPing oferece uma interface web moderna e intuitiva, totalmente responsiva e otimizada para diferentes dispositivos. O dashboard proporciona uma visão completa dos produtos monitorizados, com gráficos interativos que mostram a evolução dos preços ao longo do tempo. A plataforma inclui ferramentas avançadas de busca e filtragem, permitindo aos utilizadores encontrar rapidamente os produtos que procuram.

### Sistema de Utilizador Robusto

A plataforma implementa um sistema de autenticação seguro utilizando JWT com refresh tokens, garantindo a segurança das sessões dos utilizadores. O sistema suporta login social através de Google OAuth e Discord, facilitando o acesso à plataforma. Os utilizadores podem personalizar completamente o seu perfil e preferências, incluindo configurações detalhadas de notificações.

### Sistema de Notificações Multi-Canal

O PromoPing envia notificações através de múltiplos canais, incluindo Discord Bot com Rich Presence, emails transacionais com templates personalizados, e suporte opcional para SMS. Os utilizadores podem configurar a frequência e os tipos de alertas que desejam receber, garantindo que sejam informados apenas sobre as informações mais relevantes.

### Lojas Suportadas

A plataforma suporta mais de 20 lojas online, incluindo as principais lojas portuguesas como Worten, FNAC, Continente, Pingo Doce, IKEA, Radio Popular, Auchan e PcDiga. O sistema também inclui suporte para lojas internacionais como Amazon, com detecção automática de loja a partir da URL do produto.

### Funcionalidades Avançadas

O PromoPing oferece detecção automática de loja, permitindo que os utilizadores adicionem produtos simplesmente fornecendo a URL. Os utilizadores podem definir preços alvo personalizados e receber alertas quando esses valores são atingidos. O sistema também envia notificações quando há variações significativas de preço, permitindo aos utilizadores aproveitar oportunidades de economia.

A plataforma inclui funcionalidades de comparação de preços entre diferentes lojas, exportação de dados em múltiplos formatos (Excel, PDF, CSV), e um sistema de planos diferenciados que oferece diferentes limites e funcionalidades conforme a subscrição escolhida.

## Arquitetura do Sistema

O PromoPing utiliza uma arquitetura modular baseada em microserviços, composta por três componentes principais que trabalham de forma independente e coordenada.

### Frontend

A interface web é desenvolvida utilizando tecnologias modernas como HTML5, CSS3 e JavaScript ES6+, seguindo uma arquitetura de Single Page Application (SPA) com módulos modulares. O design é totalmente responsivo, acessível e otimizado para performance, garantindo uma experiência de utilizador excecional em qualquer dispositivo.

### Backend

O backend é construído com Node.js e Express.js, fornecendo uma API RESTful completa com middleware modular. O sistema implementa rate limiting para proteção contra abuso, configuração segura de CORS, e autenticação robusta através de JWT. Todas as operações são protegidas contra vulnerabilidades comuns através de validação de entrada, sanitização de dados e prepared statements.

### Sistema de Monitorização

O sistema de monitorização de preços é desenvolvido em Python e funciona de forma independente do backend. Utiliza Selenium WebDriver para automação de navegador e BeautifulSoup para parsing inteligente de HTML. O sistema implementa técnicas avançadas de scraping, incluindo bypass de proteções anti-bot, rotação de User-Agent, e timeouts inteligentes que se adaptam a diferentes velocidades de carregamento.

### Base de Dados

A base de dados utiliza MySQL 8.0+ com arquitetura relacional e tabelas normalizadas. O sistema implementa índices otimizados para melhorar a performance de queries complexas, prepared statements para proteção contra SQL injection, e transações ACID para garantir consistência e integridade dos dados.

## Segurança

O PromoPing passou por uma auditoria de segurança completa, identificando e corrigindo todas as vulnerabilidades críticas. O sistema implementa múltiplas camadas de proteção, incluindo:

- Autenticação JWT com refresh tokens e validação robusta
- Rate limiting configurado para proteção contra DDoS e abuso de API
- Configuração segura de CORS com validação dinâmica de origens
- Sanitização completa de entradas para prevenção de XSS
- Prepared statements em todas as queries para prevenção de SQL injection
- Sistema completo de auditoria e monitorização através de logs estruturados

O nível de risco do sistema é considerado baixo, com zero vulnerabilidades ativas e adequado para ambiente de produção.

## Tecnologias Utilizadas

### Backend

O backend utiliza Node.js 18+ como runtime, Express.js 5.x como framework web, MySQL 8.0+ como base de dados relacional, e Sequelize ORM para mapeamento objeto-relacional. O sistema de autenticação utiliza JWT (jsonwebtoken) e bcrypt para hashing seguro de passwords.

### Sistema de Notificações

O sistema de notificações integra Discord.js 14.x para bots Discord, Nodemailer para envio de emails transacionais, e suporte opcional para Twilio para SMS e WhatsApp. A autenticação social é implementada através de Passport.js com suporte para Google OAuth e Discord.

### Frontend

O frontend utiliza HTML5 para estrutura semântica, CSS3 com Flexbox e Grid para estilização moderna, e JavaScript ES6+ com módulos. A visualização de dados é realizada através de Chart.js, e o design segue princípios de Progressive Web App para funcionalidades offline.

### Python Scraper

O sistema de scraping utiliza Python 3.8+, Selenium WebDriver para automação de navegador, BeautifulSoup4 para parsing de HTML, e Schedule para agendamento de tarefas periódicas. O sistema implementa monitorização inteligente com detecção automática de metas, histórico de preços, e análise de tendências.

### DevOps e Infraestrutura

A plataforma oferece suporte completo para Docker e Docker Compose, permitindo containerização para desenvolvimento e produção. O sistema utiliza PM2 para gestão de processos Node.js, Nginx como servidor web e proxy reverso, e GitHub Actions para CI/CD automatizado.

## Sistema de Planos

O PromoPing oferece quatro planos diferentes, cada um com limites e funcionalidades específicas:

- **Free**: Plano gratuito com funcionalidades básicas e limites reduzidos
- **Basic**: Plano básico com intervalos de verificação de 4 horas
- **Standard**: Plano standard com intervalos de verificação de 30 minutos
- **Premium**: Plano premium com intervalos de verificação de 5 minutos e acesso a todas as funcionalidades

Cada plano oferece diferentes limites de produtos monitorizados, frequências de verificação, e canais de notificação disponíveis.

## API REST

O PromoPing fornece uma API RESTful completa que utiliza JSON para comunicação. A API inclui endpoints para autenticação e gestão de utilizadores, gestão completa de produtos com CRUD completo, sistema de notificações com preferências personalizáveis, sistema de pagamentos integrado com Stripe, estatísticas e relatórios detalhados, e exportação de dados em múltiplos formatos.

Todos os endpoints requerem autenticação via JWT, exceto os endpoints de registo e login. A API implementa rate limiting diferenciado por tipo de operação, garantindo segurança e performance adequadas.

## Monitorização e Logs

O PromoPing implementa um sistema completo de logging estruturado para monitorização e debugging. O sistema registra logs em múltiplos níveis (ERROR, WARN, INFO, DEBUG, HTTP) e categoriza os logs por componente (aplicação, segurança, scraping).

A plataforma inclui health checks automáticos para API, base de dados, Redis e APIs externas. O sistema monitoriza métricas de performance incluindo tempo de resposta, uso de memória, utilização de CPU, e estatísticas de rate limiting.

## Contribuição

O PromoPing é um projeto open-source que aceita contribuições da comunidade. Para contribuir, é necessário fazer fork do repositório, criar uma branch para a funcionalidade, desenvolver e testar as alterações, e abrir um Pull Request no repositório original.

As diretrizes de contribuição incluem seguir as convenções de código existentes, adicionar testes para novas funcionalidades, documentar alterações significativas, manter commits pequenos e focados, e usar mensagens de commit descritivas.

## Licença

Este projeto está licenciado sob a Licença PromoPing. Veja o arquivo LICENSE para mais detalhes.

## Suporte

### Canais de Suporte

- **Email**: corporation.promoping@gmail.com
- **GitHub Issues**: Para reportar bugs e solicitar funcionalidades
- **Discord**: [Servidor da comunidade](https://discord.gg/PXBXKXmfph)

### Documentação

A documentação completa está disponível no [GitBook do PromoPing](https://promoping.gitbook.io/promoping-docs), incluindo guias, FAQ e changelog.

## Roadmap

Os próximos passos planejados para o PromoPing incluem:

- Expansão do suporte a lojas online portuguesas e internacionais
- Integração com redes sociais para facilitar o compartilhamento de ofertas
- Desenvolvimento de aplicativo móvel nativo para iOS e Android
- Implementação de sistema de recomendações personalizadas com base no histórico de compras dos usuários
- Lançamento de uma API pública para desenvolvedores de terceiros

---

**PromoPing** - Economize mais, compre melhor.
