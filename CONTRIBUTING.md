# Contributing to PromoPing
Thank you for considering contributing to PromoPing! The PromoPing community uses GitHub to receive contributions through issues and pull requests.
To report bugs or suggest improvements, use the [GitHub Issues](https://github.com/juliareboucasleite/PromoPing/issues). Check if a similar issue already exists before creating a new one. For bugs, include a descriptive title, detailed description, steps to reproduce, expected vs. current behaviour, screenshots (if applicable), and environment information.
To contribute code, fork the repository, clone your fork, install dependencies (npm install for backend, pip install -r requirements.txt for Python scraper), configure environment variables and the database. Create a branch for your feature or fix, follow the project's code standards (JavaScript/Node.js with ESLint, Python following PEP 8, HTML/CSS with consistent indentation), test your changes, and open a Pull Request with a clear description of the changes.
If you find a bug, check if it has already been reported in the [GitHub Issues](https://github.com/juliareboucasleite/PromoPing/issues). If it hasn't been reported, create a new issue with a clear title, detailed description of the problem, steps to reproduce, expected vs. current behaviour, screenshots (if applicable), and environment details (OS, Node.js version, Python, etc.).
Suggestions are always welcome! Check if a similar suggestion already exists in the Issues. Create an issue with the `enhancement` or `feature request` tag, clearly describing the problem the improvement solves, how you imagine it would work, and the benefits for users.

## Contributing Code
**Development Environment Setup**: Fork the repository, clone your fork, install dependencies (npm install for backend, pip install -r requirements.txt for the Python scraper), configure environment variables (copy .env.example to .env if it exists), and configure the database (execute the SQL scripts in sql/).

**Development Process**: Create a branch for your feature/fix (feature/feature-name or fix/bug-name), follow code standards (JavaScript/Node.js with ESLint, Python following PEP 8, HTML/CSS with consistent indentation), write clean code (small, focused functions, descriptive names, comments when necessary, avoid duplication), test your changes manually and verify you haven't broken existing functionality. Make commits following the convention (feat, fix, docs, style, refactor, test, chore), push to your fork, and open a Pull Request with a clear description of the changes, related issues (if any), screenshots (if applicable), and verification checklist.
To better understand how the PromoPing project is managed and how to collaborate, we recommend reviewing [README.md](README.md) and the submission guidelines.

## Code Standards
**JavaScript/Node.js**: Use const by default, let when necessary, avoid var. Use arrow functions when appropriate. Prefer async/await. Variables and functions in camelCase; classes in PascalCase. Semicolon at the end of lines. Indentation: 2 spaces.
**Python**: Follow PEP 8. Use type hints when possible. Docstrings for functions and classes. snake_case for functions/variables, PascalCase for classes. Indentation: 4 spaces.
**HTML/CSS**: Consistent indentation (2 spaces). Use semantic attributes. Comment complex sections. Use descriptive classes (BEM when appropriate).

## Project Structure

```text
PromoPing/
├── backend/                    # Node.js/Express API
│   ├── config/                 # Configuration (Stripe, etc.)
│   ├── controllers/            # Controllers (export, etc.)
│   ├── database/               # Database
│   │   ├── migrations/         # SQL migrations
│   │   ├── models/            # Data models
│   │   ├── db.js              # DB connection
│   │   └── tableManager.js    # Table manager
│   ├── discord-bot/            # Discord Bot
│   │   ├── comandos/          # Bot commands
│   │   ├── bot.js             # Main bot logic
│   │   └── run.js             # Execution script
│   ├── middleware/             # Middlewares (auth, plan verification)
│   ├── routes/                 # API routes
│   │   ├── admin.js           # Administrative routes
│   │   ├── auth.js            # Authentication
│   │   ├── produtos.js        # Products
│   │   ├── user.js            # Users
│   │   └── ...
│   ├── scripts/                # Utility scripts
│   ├── services/               # Business services
│   │   ├── autoSupport.js     # Auto support
│   │   ├── alerts.js          # Alerts
│   │   ├── notify.js          # Notifications
│   │   └── ...
│   ├── utils/                  # Utilities
│   │   ├── gerarExcel.js      # Excel export
│   │   ├── gerarPDF.js        # PDF export
│   │   └── ...
│   └── server.js              # Main server
├── painel-suporte-corporacao/  # Painéis de suporte e corporação
│   ├── pages/                  # Admin HTML pages
│   ├── script/                 # Admin JavaScript scripts
│   ├── css/                    # CSS styles
│   └── assets/                 # Resources (images, etc.)
├── frontend/                   # Public web interface
│   └── pages/                  # HTML pages
│       ├── build/              # Production build
│       │   ├── dashboard/      # User dashboard
│       │   ├── About/          # About pages
│       │   ├── docs/            # Documentation
│       │   └── assets/         # Resources (CSS, JS, images)
│       └── *.md                # Markdown documentation
├── python-scraper/             # Python scraper
│   ├── scraper.py              # Main scraping logic
│   ├── scheduler.py            # Task scheduler
│   ├── product_search.py       # Product search
│   ├── product_comparison.py    # Product comparison
│   ├── notifications.py        # Notifications
│   └── start.py                # Initialisation script
├── scripts/                    # Setup and maintenance scripts
│   ├── setup.js                # Initial setup
│   ├── migrate-db.js           # Database migration
│   ├── create-admin-user.js    # Create admin user
│   └── ...
├── config-files/               # Configuration files
│   ├── discord-config.js       # Discord config
│   └── nginx-promoping.pt.conf # Nginx config
├── deploy-files/               # Deploy scripts
├── docker-files/               # Docker configuration
│   ├── Dockerfile              # Production Dockerfile
│   ├── Dockerfile.dev          # Development Dockerfile
│   └── docker-compose.yml      # Docker Compose
├── sql/                        # SQL scripts
│   └── pap (1).sql            # Database dump
├── docs/                       # Additional documentation
└── openapi.yaml                # OpenAPI specification
```

## Pull Request Checklist
Before submitting a PR, verify: code follows project standards, functionality tested manually, no lint/console errors, documentation updated (if necessary), commits follow the convention, branch is up to date with main/master, PR has a clear description and screenshots (if applicable).

## Review Process
Maintainers will review your PR by checking if the code follows standards, testing the changes, and suggesting improvements if necessary. Respond to comments, make requested changes, and update the PR as needed. After approval, the PR will be merged and you will be credited as a contributor.

## Questions?
If you have questions about how to contribute, open an issue with the `question` tag or contact us at <corporation.promoping@gmail.com>
Your friendly PromoPing community!
Thank you for contributing to make PromoPing better!
