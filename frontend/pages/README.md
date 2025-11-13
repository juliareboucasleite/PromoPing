# Api reference

Documentação da API PromoPing

## URL Base

https://api.promoping.com

## Autenticação

Todos os endpoints da API (exceto autenticação) requerem um token JWT válido no cabeçalho Authorization:

Authorization: Bearer \<your\_jwt\_token>

{% hint style="info" %}
Inclua sempre o cabeçalho Authorization nas requisições aos endpoints protegidos.
{% endhint %}

***

## Perfil do Utilizador e Estatísticas

### Obter Perfil do Utilizador

GET /api/user/profile

Retorna o perfil completo do utilizador autenticado.

Resposta (exemplo):

{% code title="Resposta (JSON)" %}
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
{% endcode %}

### Actualizar Perfil do Utilizador

PUT /api/user/profile

Actualiza os dados do perfil do utilizador.

Corpo da Requisição (exemplo):

{% code title="Corpo (JSON)" %}
```json
{
  "nome": "João Silva",
  "email": "joao@example.com",
  "telefone": "+351912345678"
}
```
{% endcode %}

***

### Obter Estatísticas do Utilizador

GET /api/user/stats

Retorna estatísticas do utilizador incluindo total de produtos, notificações e dinheiro poupado.

Resposta (exemplo):

{% code title="Resposta (JSON)" %}
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
{% endcode %}

***

## Preferências de Notificação

### Obter Preferências de Notificação

GET /api/user/preferences

Retorna as preferências de notificação do utilizador.

Resposta (exemplo):

{% code title="Resposta (JSON)" %}
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
{% endcode %}

### Actualizar Preferências de Notificação

PUT /api/user/preferences

Actualiza as preferências de notificação do utilizador.

Corpo da Requisição (exemplo):

{% code title="Corpo (JSON)" %}
```json
{
  "preferences": [
    { "tipo": "email", "ativo": true },
    { "tipo": "sms", "ativo": false },
    { "tipo": "push", "ativo": true }
  ]
}
```
{% endcode %}

***

## Notificações

### Obter Notificações

GET /api/notificacoes

Retorna as notificações do utilizador.

Parâmetros de Consulta

* `limit` (opcional): Número máximo de notificações (predefinido: 20)

Resposta (exemplo):

{% code title="Resposta (JSON)" %}
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
{% endcode %}

### Marcar Notificação como Lida

PUT /api/notificacoes/:id/lida

Marca uma notificação como lida.

Resposta (exemplo):

{% code title="Resposta (JSON)" %}
```json
{
  "status": "ok",
  "message": "Notificação marcada como lida"
}
```
{% endcode %}

***

## Respostas de Erro

Todos os endpoints podem retornar respostas de erro com a seguinte estrutura.

<details>

<summary>Erro de Autenticação</summary>

```json
{
  "status": "error",
  "message": "Token inválido ou expirado",
  "code": 401
}
```

</details>

<details>

<summary>Erro de Validação</summary>

```json
{
  "status": "error",
  "message": "Dados inválidos",
  "code": 400,
  "errors": [
    "Email é obrigatório",
    "Telefone deve ter formato válido"
  ]
}
```

</details>

***

## Limitação de Taxa

A API implementa limitação de taxa para garantir uso justo:

* Free: 100 pedidos por hora
* Basic: 500 pedidos por hora
* Standard: 1000 pedidos por hora
* Premium: 2000 pedidos por hora

***

## Exemplos de SDK

{% tabs %}
{% tab title="JavaScript/Node.js" %}
{% code title="Exemplo (Node.js)" %}
```javascript
const axios = require('axios');
const api = axios.create({
  baseURL: 'https://api.promoping.com',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Get user profile
const profile = await api.get('/api/user/profile');

// Update preferences
await api.put('/api/user/preferences', {
  preferences: [
    { tipo: 'email', ativo: true }
  ]
});
```
{% endcode %}
{% endtab %}

{% tab title="Python" %}
{% code title="Exemplo (Python)" %}
```python
import requests

headers = {
  'Authorization': f'Bearer {token}'
}

# Get user stats
response = requests.get(
  'https://api.promoping.com/api/user/stats',
  headers=headers
)
stats = response.json()
```
{% endcode %}
{% endtab %}
{% endtabs %}

***

Última actualização há 1 ano
