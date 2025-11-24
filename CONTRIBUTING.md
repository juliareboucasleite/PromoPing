# Guia de Contribuição para o PromoPing

Obrigado por considerar contribuir para o PromoPing! Este documento fornece diretrizes para contribuir com o projeto.

## Como Posso Contribuir?

### Reportar Bugs

Se encontrar um bug, por favor:

1. **Verifique se o bug já foi reportado** nas [Issues do GitHub](https://github.com/juliareboucasleite/PromoPing/issues)
2. Se não foi reportado, **crie uma nova issue** com:
   - Título descritivo e claro
   - Descrição detalhada do problema
   - Passos para reproduzir o bug
   - Comportamento esperado vs. comportamento atual
   - Screenshots (se aplicável)
   - Ambiente (OS, versão do Node.js, Python, etc.)

### Sugerir Melhorias

Sugestões são sempre bem-vindas! Para sugerir uma melhoria:

1. **Verifique se já existe uma sugestão similar** nas Issues
2. Crie uma issue com a tag `enhancement` ou `feature request`
3. Descreva claramente:
   - O problema que a melhoria resolve
   - Como você imagina que funcionaria
   - Benefícios para os utilizadores

### Contribuir com Código

#### Configuração do Ambiente de Desenvolvimento

1. **Fork o repositório** no GitHub
2. **Clone o seu fork**:
   ```bash
   git clone https://github.com/SEU_USUARIO/PromoPing.git
   cd PromoPing
   ```

3. **Instale as dependências**:
   ```bash
   # Backend (Node.js)
   npm install
   
   # Python Scraper
   cd python-scraper
   pip install -r requirements.txt
   ```

4. **Configure as variáveis de ambiente**:
   - Copie `.env.example` para `.env` (se existir)
   - Configure as variáveis necessárias

5. **Configure o banco de dados**:
   - Execute os scripts SQL em `sql/`
   - Configure as credenciais no `.env`

#### Processo de Desenvolvimento

1. **Crie uma branch** para sua feature/correção:
   ```bash
   git checkout -b feature/nome-da-feature
   # ou
   git checkout -b fix/nome-do-bug
   ```

2. **Siga os padrões de código**:
   - **JavaScript/Node.js**: Use ESLint, siga o estilo existente
   - **Python**: Siga PEP 8, use type hints quando possível
   - **HTML/CSS**: Use indentação consistente, comentários claros

3. **Escreva código limpo**:
   - Funções pequenas e focadas
   - Nomes descritivos para variáveis e funções
   - Comentários quando necessário
   - Evite código duplicado

4. **Teste suas mudanças**:
   - Teste manualmente todas as funcionalidades afetadas
   - Verifique se não quebrou funcionalidades existentes
   - Teste em diferentes navegadores (se for frontend)

5. **Commit suas mudanças**:
   ```bash
   git add .
   git commit -m "feat: adiciona funcionalidade X"
   # ou
   git commit -m "fix: corrige bug Y"
   ```

   **Convenção de Commits**:
   - `feat:` Nova funcionalidade
   - `fix:` Correção de bug
   - `docs:` Mudanças na documentação
   - `style:` Formatação, espaços, etc. (não afeta código)
   - `refactor:` Refatoração de código
   - `test:` Adição ou correção de testes
   - `chore:` Tarefas de manutenção

6. **Push para o seu fork**:
   ```bash
   git push origin feature/nome-da-feature
   ```

7. **Abra um Pull Request**:
   - Vá para o repositório original no GitHub
   - Clique em "New Pull Request"
   - Selecione sua branch
   - Preencha o template do PR com:
     - Descrição clara das mudanças
     - Issue relacionada (se houver)
     - Screenshots (se aplicável)
     - Checklist de verificação

## Padrões de Código

### JavaScript/Node.js

- Use `const` por padrão, `let` quando necessário, evite `var`
- Use arrow functions quando apropriado
- Use async/await em vez de callbacks quando possível
- Nomes de variáveis e funções em camelCase
- Nomes de classes em PascalCase
- Use ponto e vírgula no final das linhas
- Indentação: 2 espaços

```javascript
// ✅ Bom
const fetchUser = async (userId) => {
  const user = await db.getUser(userId);
  return user;
};

// ❌ Evitar
function fetchUser(userId) {
  return db.getUser(userId).then(user => user);
}
```

### Python

- Siga PEP 8
- Use type hints quando possível
- Docstrings para funções e classes
- Nomes de variáveis e funções em snake_case
- Nomes de classes em PascalCase
- Indentação: 4 espaços

```python
# ✅ Bom
def extract_price(driver: WebDriver, url: str) -> tuple[str, float | None, None]:
    """Extrai preço de qualquer loja.
    
    Args:
        driver: Instância do WebDriver
        url: URL do produto
        
    Returns:
        Tupla com (loja, preço, flag)
    """
    # código aqui
    pass
```

### HTML/CSS

- Use indentação consistente (2 espaços)
- Use atributos semânticos
- Comente seções complexas
- Use classes descritivas (BEM quando apropriado)

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

Antes de submeter um PR, verifique:

- [ ] Código segue os padrões do projeto
- [ ] Funcionalidade testada manualmente
- [ ] Não há erros de lint/console
- [ ] Documentação atualizada (se necessário)
- [ ] Commits seguem a convenção
- [ ] Branch está atualizada com `main`/`master`
- [ ] PR tem descrição clara e screenshots (se aplicável)

## Processo de Revisão

1. **Mantenedores revisarão seu PR**:
   - Verificarão se o código segue os padrões
   - Testarão as mudanças
   - Sugerirão melhorias se necessário

2. **Feedback e Iteração**:
   - Responda aos comentários
   - Faça as alterações solicitadas
   - Atualize o PR conforme necessário

3. **Aprovação e Merge**:
   - Após aprovação, o PR será mergeado
   - Você será creditado como contribuidor

## Perguntas?

Se tiver dúvidas sobre como contribuir:

- Abra uma issue com a tag `question`
- Entre em contato: **corporation.promoping@gmail.com**

## Agradecimentos

Obrigado por contribuir para tornar o PromoPing melhor! 🎉

---

**Última atualização**: Novembro 2025

