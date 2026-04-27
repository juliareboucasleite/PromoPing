[![Version](https://img.shields.io/badge/Version-Pap-blue.svg)](https://github.com/juliareboucasleite/PromoPing)
[![LICENSE](https://img.shields.io/badge/LICENSE-GPL--2.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Site](https://img.shields.io/badge/site-Promoping.pt-brightgreen?logo=Google-Chrome&logoColor=white&label=Site)](http://promoping.pt/)
[![Canva Presentation](https://img.shields.io/badge/Presentation-Canva-blueviolet?logo=Canva&logoColor=white)](https://www.canva.com/design/DAG9u04cSXY/S5BJ6T8clNUSVyWbkucElg/view?utm_content=DAG9u04cSXY&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h52d685fdd2)

# PromoPing
PromoPing is a price monitoring system for Portuguese consumers and, in the future, for everyone. It allows users to track products across various online shops and receive automatic notifications when prices reach defined targets. Initially, the idea emerged as simply "Price Fiscal Bot" and the name "PromoPing" appeared during one of those moments of desperation and forced creativity when searching for names on ChatGPT. It seems to mean "promotion ping" and even sounds professional. On normal days, it's more reminiscent of "drops promotions", because it resolves to fire alerts all at once. And when some shop changes the HTML without warning, the name easily transforms into "cursed programme that only pings when it wants to". In the end, it stuck because it works… and because no better name came up before patience ran out.

The system includes a responsive web interface with price evolution charts, a secure authentication mechanism via JWT, Google OAuth and Discord, and automatic notifications sent via email and Discord Bot. It also features continuous monitoring for over twenty online shops, subscription plans with different verification intervals, and a RESTful API that allows integration and complete management of monitored products.

> **Note:** PromoPing monitors products chosen by the user and does not compare prices between shops.

## Architecture
PromoPing's Architecture was designed using these technologies: 
HTML5, CSS3, JavaScript ES6+ (responsive SPA)
Node.js 18+, Express.js 5.x, PostgreSQL 14+
Python 3.8+, Selenium WebDriver, BeautifulSoup4
Docker, PM2, Nginx, GitHub Actions

## Security
The system implements multiple layers of protection:
JWT authentication with refresh tokens
Rate limiting and configured CORS
Input sanitisation and prepared statements
Structured logging and complete auditing

Security-related matters should be disclosed privately by contacting <corporation.promoping@gmail.com> and to report vulnerabilities, please consult [SECURITY.md](SECURITY.md).

Contributions are welcome via email contact. Please consult [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for guidelines.
This project is licensed under the **GNU General Public License v2.0 (GPL-2.0)**. See the [LICENSE](LICENSE) file for more details.

For support, questions, suggestions, or problem reports, the project provides several official channels. Direct contact can be made via email <corporation.promoping@gmail.com>. Technical questions, bugs, or feature requests should be submitted through the Issues page on GitHub. The community can also interact and follow news through the official Discord server. Complete documentation, including system guides and references, is available on PromoPing's GitBook.
