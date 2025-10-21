# Configuração do Discord OAuth - PromoPing

## Como configurar o Discord OAuth

### 1. Criar uma Aplicação no Discord

1. Acesse o [Portal do Desenvolvedor do Discord](https://discord.com/developers/applications)
2. Faça login com sua conta Discord
3. Clique em "New Application"
4. Dê um nome para sua aplicação (ex: "PromoPing")
5. Clique em "Create"

### 2. Configurar OAuth2

1. Na sua aplicação, vá para a aba "OAuth2"
2. Em "Redirects", adicione: `http://127.0.0.1:3000/auth/discord/callback`
3. Em "Scopes", selecione:
   - `identify` - Para obter informações básicas do usuário
   - `email` - Para obter o email do usuário
4. Copie o "Client ID" e "Client Secret"

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com:

```env
# Discord OAuth
DISCORD_CLIENT_ID=seu_client_id_aqui
DISCORD_CLIENT_SECRET=seu_client_secret_aqui

# Outras variáveis necessárias...
JWT_SECRET=sua_chave_jwt_aqui
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_do_banco
DB_NAME=promoping
```

### 4. Testar a Integração

1. Inicie o servidor: `npm start`
2. Acesse: `http://localhost:3000/register`
3. Clique no botão "Discord"
4. Você será redirecionado para o Discord para autorizar
5. Após autorizar, será redirecionado de volta para o painel

### 5. Como Funciona

- **Registro**: Se o usuário não existir, será criado automaticamente
- **Login**: Se o usuário já existir, será autenticado
- **Dados Salvos**: Nome, email, Discord ID, username e avatar
- **Token**: Um JWT é gerado para manter a sessão

### 6. Estrutura do Banco de Dados

A tabela `Utilizadores` deve ter as colunas:
- `Id` (PRIMARY KEY)
- `Nome` (VARCHAR)
- `Email` (VARCHAR, UNIQUE)
- `DiscordId` (VARCHAR)
- `Username` (VARCHAR)
- `Avatar` (VARCHAR)
- `Ativo` (BOOLEAN)

### 7. Troubleshooting

**Erro: "Discord OAuth não configurado"**
- Verifique se as variáveis DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET estão no .env

**Erro: "Invalid redirect URI"**
- Verifique se a URL de callback está correta no Discord Developer Portal

**Erro: "Invalid client"**
- Verifique se o Client ID está correto

**Erro de banco de dados**
- Verifique se a tabela Utilizadores existe e tem as colunas necessárias
