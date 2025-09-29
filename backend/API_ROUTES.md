# API Routes - PromoPing Backend

## Rotas de Perfil e Estatísticas

### 1. Perfil do Utilizador

#### GET `/api/user/profile`
Retorna o perfil completo do utilizador logado.

**Resposta:**
```json
{
  "status": "ok",
  "profile": {
    "nome": "João Silva",
    "email": "joao@example.com",
    "telefone": "+351912345678",
    "contas_conectadas": [
      { "Tipo": "google", "Conectado": true },
      { "Tipo": "discord", "Conectado": false },
      { "Tipo": "telefone", "Conectado": true }
    ],
    "preferencias": [
      { "Tipo": "email", "Ativo": 1 },
      { "Tipo": "sms", "Ativo": 0 }
    ]
  }
}
```

#### PUT `/api/user/profile`
Atualiza os dados do perfil do utilizador.

**Body:**
```json
{
  "nome": "João Silva",
  "email": "joao@example.com",
  "telefone": "+351912345678"
}
```

**Resposta:**
```json
{
  "status": "ok"
}
```

### 2. Estatísticas do Utilizador

#### GET `/api/user/stats`
Retorna estatísticas do utilizador.

**Resposta:**
```json
{
  "status": "ok",
  "stats": {
    "produtos_total": 15,
    "notificacoes_total": 42,
    "dinheiro_poupado": 125.50
  }
}
```

### 3. Preferências de Notificação

#### GET `/api/user/preferences`
Retorna as preferências de notificação do utilizador.

**Resposta:**
```json
{
  "status": "ok",
  "preferences": [
    { "Tipo": "email", "Ativo": 1 },
    { "Tipo": "sms", "Ativo": 0 },
    { "Tipo": "push", "Ativo": 1 }
  ]
}
```

#### PUT `/api/user/preferences`
Atualiza as preferências de notificação.

**Body:**
```json
{
  "preferences": [
    { "tipo": "email", "ativo": true },
    { "tipo": "sms", "ativo": false },
    { "tipo": "push", "ativo": true }
  ]
}
```

**Resposta:**
```json
{
  "status": "ok"
}
```

### 4. Notificações

#### GET `/api/notificacoes`
Retorna as notificações do utilizador.

**Query Parameters:**
- `limit` (opcional): Número máximo de notificações (padrão: 20)

**Resposta:**
```json
{
  "status": "ok",
  "notificacoes": [
    {
      "id": 1,
      "produto_id": 5,
      "tipo": "preco_baixou",
      "mensagem": "O preço do produto X baixou para €25.99",
      "enviada": true,
      "data_envio": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### PUT `/api/notificacoes/:id/lida`
Marca uma notificação como lida.

**Resposta:**
```json
{
  "status": "ok",
  "message": "Notificação marcada como lida"
}
```

## Autenticação

Todas as rotas (exceto as de autenticação) requerem um token JWT válido no header:

```
Authorization: Bearer <token>
```

## Estrutura das Tabelas Esperadas

### Utilizadores
- `Id` (PK)
- `Nome`
- `Email`
- `Telefone`
- `GoogleId` (opcional)
- `DiscordId` (opcional)

### PreferenciasNotificacao
- `UserId` (FK)
- `Tipo` (email, sms, push)
- `Ativo` (0 ou 1)

### Produtos
- `Id` (PK)
- `UserId` (FK)
- `Nome`
- `URL`
- `PrecoAtual`

### Notificacoes
- `Id` (PK)
- `UserId` (FK)
- `ProdutoId` (FK)
- `Tipo`
- `Mensagem`
- `Enviada` (0 ou 1)
- `DataEnvio`
- `ValorPoupado` (opcional)
