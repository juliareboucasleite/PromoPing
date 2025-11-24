[![Version](https://img.shields.io/badge/Version-Pap-blue.svg)](https://github.com/juliareboucasleite/PromoPing)
[![LICENSE](https://img.shields.io/badge/LICENSE-GPL--2.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Site](https://img.shields.io/badge/site-Promoping.pt-brightgreen?logo=Google-Chrome&logoColor=white&label=Site)](http://promoping.pt/)

# PromoPing
O PromoPing é um sistema de monitoramento de preços para consumidores portugueses e futuramente para todo mundo. Permite acompanhar produtos em diversas lojas online e receber notificações automáticas quando os preços atingem metas definidas. Inicialmente a ideia surgiu como apenas "Bot Fiscal de preço" e o nome “PromoPing” apareceu num daqueles momentos em que o desespero e criatividade forçada onde se busca nomes no ChatGpt. Parece significar “ping de promoções” e até soa profissional. Nos dias normais, lembra mais “pinga promoções”, porque resolve disparar alertas todos de uma vez. E quando alguma loja muda o HTML sem avisar, o nome transforma-se facilmente em “programa maldito que só pinga quando quer”. No fim, ficou porque funciona… e porque nenhum nome melhor surgiu antes da paciência acabar.


O sistema inclui uma interface web responsiva com gráficos de evolução de preços, um mecanismo de autenticação seguro via JWT, Google OAuth e Discord, e notificações automáticas enviadas por email e Discord Bot. Conta ainda com monitorização contínua para mais de vinte lojas online, planos de subscrição com diferentes intervalos de verificação e uma API RESTful que permite integração e gestão completa dos produtos monitorizados.

> **Nota:** O PromoPing monitora produtos escolhidos pelo utilizador e não compara preços entre lojas.

A Arquitetura do PromoPing foi pensada usando essas linguagens: 
HTML5, CSS3, JavaScript ES6+ (SPA responsiva)
Node.js 18+, Express.js 5.x, MySQL 8.0+
Python 3.8+, Selenium WebDriver, BeautifulSoup4
Docker, PM2, Nginx, GitHub Actions

O sistema implementa múltiplas camadas de proteção:
Autenticação JWT com refresh tokens
Rate limiting e CORS configurado
Sanitização de entradas e prepared statements
Logging estruturado e auditoria completa

Questões que são relevantes para a segurança devem ser divulgadas de forma privada contacte corporation.promoping@gmail.com e para reportar vulnerabilidades, consulte [SECURITY.md](SECURITY.md).

Contribuições são bem-vindas mediante contato por email. Consulte [CONTRIBUTING.md](CONTRIBUTING.md) e [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) para diretrizes.
Este projeto está licenciado sob a **GNU General Public License v2.0 (GPL-2.0)**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

Para suporte, dúvidas, envio de sugestões ou reporte de problemas, o projeto disponibiliza vários canais oficiais. O contacto direto pode ser feito através do email corporation.promoping@gmail.com . Questões técnicas, bugs ou pedidos de funcionalidades devem ser encaminhados pela página de Issues no GitHub. A comunidade também pode interagir e acompanhar novidades por meio do servidor oficial no Discord. A documentação completa, incluindo guias e referências do sistema, encontra-se disponível no GitBook do PromoPing.


