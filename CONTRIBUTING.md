# Contribuindo para o PromoPing
Obrigado por considerar contribuir para o PromoPing! A comunidade do PromoPing utiliza o GitHub para receber contribuições através de issues e pull requests.
Para reportar bugs ou sugerir melhorias, utilize as [Issues do GitHub](https://github.com/juliareboucasleite/PromoPing/issues). Verifique se já existe uma issue similar antes de criar uma nova. Para bugs, inclua título descritivo, descrição detalhada, passos para reproduzir, comportamento esperado vs. atual, screenshots (se aplicável) e informações do ambiente.
Para contribuir com código, faça fork do repositório, clone o seu fork, instale as dependências (npm install para backend, pip install -r requirements.txt para Python scraper), configure as variáveis de ambiente e o banco de dados. Crie uma branch para sua feature ou correção, siga os padrões de código do projeto (JavaScript/Node.js com ESLint, Python seguindo PEP 8, HTML/CSS com indentação consistente), teste suas mudanças e abra um Pull Request com descrição clara das mudanças.
Se encontrar um bug, verifique se já foi reportado nas [Issues do GitHub](https://github.com/juliareboucasleite/PromoPing/issues). Se não foi reportado, crie uma nova issue com um título claro, descrição detalhada do problema, passos para reproduzir, comportamento esperado vs. atual, screenshots (se aplicável) e detalhes do ambiente (SO, versão do Node.js, Python, etc.).
Sugestões são sempre bem-vindas! Verifique se já existe uma sugestão similar nas Issues. Crie uma issue com a tag `enhancement` ou `feature request`, descrevendo claramente o problema que a melhoria resolve, como você imagina que funcionaria e os benefícios para os usuários.

## Contribuir com Código
**Configuração do Ambiente de Desenvolvimento**: Faça fork do repositório, clone o seu fork, instale as dependências (npm install para backend, pip install -r requirements.txt para o scraper Python), configure as variáveis de ambiente (copie .env.example para .env se existir) e configure o banco de dados (execute os scripts SQL em sql/).

**Processo de Desenvolvimento**: Crie uma branch para sua feature/correção (feature/nome-da-feature ou fix/nome-do-bug), siga os padrões de código (JavaScript/Node.js com ESLint, Python seguindo PEP 8, HTML/CSS com indentação consistente), escreva código limpo (funções pequenas e focadas, nomes descritivos, comentários quando necessário, evite duplicidade), teste suas mudanças manualmente e verifique se não quebrou funcionalidades existentes. Faça commit seguindo a convenção (feat, fix, docs, style, refactor, test, chore), faça push para seu fork e abra um Pull Request com descrição clara das mudanças, issues relacionadas (se houver), screenshots (se aplicável) e checklist de verificação.
Para entender melhor como o projeto PromoPing é gerido e como colaborar, recomendamos revisar o [README.md](README.md) e as diretrizes de submissão.

## Padrões de Código
**JavaScript/Node.js**: Use const por padrão, let quando necessário, evite var. Use arrow functions quando apropriado. Prefira async/await. Variáveis e funções em camelCase; classes em PascalCase. Ponto e vírgula ao final das linhas. Indentação: 2 espaços.
**Python**: Siga PEP 8. Use type hints quando possível. Docstrings para funções e classes. snake_case para funções/variáveis, PascalCase para classes. Indentação: 4 espaços.
**HTML/CSS**: Indentação consistente (2 espaços). Use atributos semânticos. Comente seções complexas. Use classes descritivas (BEM quando apropriado).

## Estrutura do Projeto

```text
PromoPing/
├── backend/           # API Node.js/Express
│   ├── routes/        # Rotas da API
│   ├── middleware/    # Middlewares
│   ├── services/      # Serviços de negócio
│   └── database/      # Modelos e conexão DB
├── frontend/          # Interface web
│   └── pages/         # Páginas HTML
├── python-scraper/    # Scraper Python
│   ├── scraper.py     # Lógica principal
│   └── scheduler.py   # Agendador
├── sql/               # Scripts SQL
└── docs/              # Documentação
```

## Checklist para Pull Requests
Antes de submeter um PR, verifique: código segue os padrões do projeto, funcionalidade testada manualmente, não há erros de lint/console, documentação atualizada (se necessário), commits seguem a convenção, branch está atualizada com main/master, PR tem descrição clara e screenshots (se aplicável).

## Processo de Revisão
Mantenedores revisarão seu PR verificando se o código segue os padrões, testando as mudanças e sugerindo melhorias se necessário. Responda aos comentários, faça as alterações solicitadas e atualize o PR conforme necessário. Após aprovação, o PR será mergeado e você será creditado como contribuidor.

## Perguntas?
Se tiver dúvidas sobre como contribuir, abra uma issue com a tag `question` ou entre em contato através de <corporation.promoping@gmail.com>
Sua simpática comunidade PromoPing!
Obrigado por contribuir para tornar o PromoPing melhor!
