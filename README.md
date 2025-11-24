[![Version](https://img.shields.io/badge/Version-Pap-blue.svg)](https://github.com/juliareboucasleite/PromoPing)
[![LICENSE](https://img.shields.io/badge/LICENSE-GPL--2.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Site](https://img.shields.io/badge/site-Promoping.pt-brightgreen?logo=Google-Chrome&logoColor=white&label=Site)](http://promoping.pt/)

# PromoPing
O PromoPing é um sistema de monitoramento de preços para consumidores portugueses. Permite acompanhar produtos em diversas lojas online e receber notificações automáticas quando os preços atingem metas definidas.

Algumas funcionalidades é a
**Interface Web**: Dashboard responsivo com gráficos interativos de evolução de preços
**Autenticação**: Sistema seguro com JWT, suporte para Google OAuth e Discord
**Notificações**: Alertas via Discord Bot e email transacional
**Monitorização Automática**: Suporte para mais de 20 lojas online (Worten, FNAC, Amazon, etc.)
**Planos de Subscrição**: Free, Basic, Standard e Premium com diferentes intervalos de verificação
**API RESTful**: API completa para integração e gestão de produtos

> **Nota:** O PromoPing monitora produtos escolhidos pelo utilizador e não compara preços entre lojas.

A Arquitetura do PromoPing foi pensada usando essas linguagens: 
HTML5, CSS3, JavaScript ES6+ (SPA responsiva)
ode.js 18+, Express.js 5.x, MySQL 8.0+
Python 3.8+, Selenium WebDriver, BeautifulSoup4
Docker, PM2, Nginx, GitHub Actions

O sistema implementa múltiplas camadas de proteção:
Autenticação JWT com refresh tokens
Rate limiting e CORS configurado
Sanitização de entradas e prepared statements
Logging estruturado e auditoria completa

Para reportar vulnerabilidades, consulte [SECURITY.md](SECURITY.md).

Contribuições são bem-vindas mediante contato por email. Consulte [CONTRIBUTING.md](CONTRIBUTING.md) e [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) para diretrizes.
Este projeto está licenciado sob a **GNU General Public License v2.0 (GPL-2.0)**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

### Suporte
**Email**: corporation.promoping@gmail.com
**GitHub Issues**: [Reportar bugs e solicitar funcionalidades](https://github.com/juliareboucasleite/PromoPing/issues)
**Discord**: [Servidor da comunidade](https://discord.gg/PXBXKXmfph)
**Documentação**: [GitBook do PromoPing](https://promoping.gitbook.io/promoping-docs)
