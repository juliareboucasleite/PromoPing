# Guia de Contribuição para o PromoPing

Obrigado por considerar contribuir para o PromoPing! Este documento fornece diretrizes para contribuir com o projeto.

## Como Posso Contribuir?

### Reportar Bugs

Se encontrar um bug, verifique se já foi reportado nas [Issues do GitHub](https://github.com/juliareboucasleite/PromoPing/issues). Se não foi reportado, crie uma nova issue com: título descritivo e claro, descrição detalhada do problema, passos para reproduzir o bug, comportamento esperado vs. comportamento atual, screenshots (se aplicável) e ambiente (OS, versão do Node.js, Python, etc.).

### Sugerir Melhorias

Sugestões são sempre bem-vindas! Verifique se já existe uma sugestão similar nas Issues. Crie uma issue com a tag `enhancement` ou `feature request` descrevendo claramente o problema que a melhoria resolve, como você imagina que funcionaria e os benefícios para os utilizadores.

### Contribuir com Código

**Configuração do Ambiente de Desenvolvimento**: Fork o repositório no GitHub, clone o seu fork, instale as dependências (npm install para backend, pip install -r requirements.txt para Python scraper), configure as variáveis de ambiente (copie .env.example para .env se existir) e configure o banco de dados (execute os scripts SQL em sql/).

**Processo de Desenvolvimento**: Crie uma branch para sua feature/correção (feature/nome-da-feature ou fix/nome-do-bug), siga os padrões de código (JavaScript/Node.js com ESLint, Python seguindo PEP 8, HTML/CSS com indentação consistente), escreva código limpo (funções pequenas e focadas, nomes descritivos, comentários quando necessário, evite código duplicado), teste suas mudanças manualmente e verifique se não quebrou funcionalidades existentes, faça commit seguindo a convenção (feat: nova funcionalidade, fix: correção de bug, docs: mudanças na documentação, style: formatação, refactor: refatoração, test: testes, chore: manutenção), faça push para o seu fork e abra um Pull Request com descrição clara das mudanças, issue relacionada (se houver), screenshots (se aplicável) e checklist de verificação.

## Padrões de Código

**JavaScript/Node.js**: Use const por padrão, let quando necessário, evite var. Use arrow functions quando apropriado. Use async/await em vez de callbacks quando possível. Nomes de variáveis e funções em camelCase, classes em PascalCase. Use ponto e vírgula no final das linhas. Indentação: 2 espaços.

**Python**: Siga PEP 8. Use type hints quando possível. Docstrings para funções e classes. Nomes de variáveis e funções em snake_case, classes em PascalCase. Indentação: 4 espaços.

**HTML/CSS**: Use indentação consistente (2 espaços). Use atributos semânticos. Comente seções complexas. Use classes descritivas (BEM quando apropriado).

## Estrutura do Projeto

```
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

Se tiver dúvidas sobre como contribuir, abra uma issue com a tag `question` ou entre em contato: **corporation.promoping@gmail.com**

Obrigado por contribuir para tornar o PromoPing melhor!

**Última atualização**: Novembro 2025
