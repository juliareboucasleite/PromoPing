# 📚 Guia de Integração - API de Suporte/Mensagens PromoPing

Este guia explica como integrar outro projeto à API de suporte e mensagens do PromoPing.

## 🔗 Endpoints Disponíveis

### Base URL

- **API Node.js PromoPing**: `http://127.0.0.1:3000/api/support`
- **API PHP (Painel Administrativo)**: `http://localhost/Painel_Administrativo/Painel_Administrativo/api/support`

### Endpoints Node.js (PromoPing)

#### 1. Listar Threads/Conversas

```
GET /api/support/messages?limit=20
Headers: Authorization: Bearer <token>
```

**Resposta:**

```json
{
  "items": [
    {
      "id": 1,
      "threadId": 1,
      "message": "Mensagem inicial...",
      "senderType": "user",
      "createdAt": "2024-11-04T15:30:00.000Z",
      "replyCount": 2,
      "lastReplyAt": "2024-11-04T15:35:00.000Z"
    }
  ]
}
```

#### 2. Buscar Mensagens de uma Thread

```
GET /api/support/messages?threadId=1
Headers: Authorization: Bearer <token>
```

**Resposta:**

```json
{
  "items": [
    {
      "id": 1,
      "threadId": 1,
      "message": "Mensagem inicial...",
      "senderType": "user",
      "replyTo": null,
      "createdAt": "2024-11-04T15:30:00.000Z"
    },
    {
      "id": 2,
      "threadId": 1,
      "message": "Resposta do suporte...",
      "senderType": "support",
      "replyTo": 1,
      "createdAt": "2024-11-04T15:35:00.000Z"
    }
  ]
}
```

#### 3. Criar Nova Mensagem

```
POST /api/support/messages
Headers: 
  Authorization: Bearer <token>
  Content-Type: application/json

Body:
{
  "message": "Texto da mensagem"
}
```

**Resposta:**

```json
{
  "id": 3,
  "threadId": 3,
  "message": "Texto da mensagem",
  "senderType": "user"
}
```

#### 4. Responder a uma Mensagem

```
POST /api/support/messages/:id/reply
Headers: 
  Authorization: Bearer <token>
  Content-Type: application/json

Body:
{
  "message": "Texto da resposta",
  "senderType": "user"  // ou "support"
}
```

**Resposta:**

```json
{
  "id": 4,
  "threadId": 1,
  "message": "Texto da resposta",
  "senderType": "user",
  "replyTo": 1
}
```

## 💻 Código JavaScript para Integração

### Função Base para Requisições (Node.js)

```javascript
/**
 * Configuração da API PromoPing
 */
const API_CONFIG = {
  baseURL: 'http://127.0.0.1:3000/api',
  // Ou se estiver em produção:
  // baseURL: 'https://seu-dominio.com/api'
};

/**
 * Função para fazer requisições à API com autenticação
 */
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_CONFIG.baseURL}${endpoint}`;
  
  // Obter token do localStorage ou de onde você armazena
  const token = localStorage.getItem('token') || '';
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  };
  
  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (response.status === 401) {
      // Token inválido ou expirado
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Não autenticado');
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erro na requisição API:', error);
    throw error;
  }
}

/**
 * Listar conversas/threads
 */
async function listConversations(limit = 20) {
  try {
    const data = await fetchAPI(`/support/messages?limit=${limit}`);
    return data.items || [];
  } catch (error) {
    console.error('Erro ao listar conversas:', error);
    return [];
  }
}

/**
 * Buscar mensagens de uma thread
 */
async function getThreadMessages(threadId) {
  try {
    const data = await fetchAPI(`/support/messages?threadId=${threadId}`);
    return data.items || [];
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    return [];
  }
}

/**
 * Criar nova mensagem
 */
async function createMessage(message) {
  try {
    const response = await fetchAPI('/support/messages', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    
    return response;
  } catch (error) {
    console.error('Erro ao criar mensagem:', error);
    throw error;
  }
}

/**
 * Responder a uma mensagem
 */
async function replyToMessage(messageId, message, senderType = 'user') {
  try {
    const response = await fetchAPI(`/support/messages/${messageId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ 
        message, 
        senderType 
      })
    });
    
    return response;
  } catch (error) {
    console.error('Erro ao responder mensagem:', error);
    throw error;
  }
}
```

### Exemplo de Uso Completo

```javascript
// Exemplo 1: Listar todas as conversas
async function exemploListarConversas() {
  const conversas = await listConversations();
  console.log('Conversas:', conversas);
  
  conversas.forEach(conversa => {
    console.log(`Thread #${conversa.id}: ${conversa.message}`);
    console.log(`Respostas: ${conversa.replyCount || 0}`);
  });
}

// Exemplo 2: Buscar mensagens de uma thread específica
async function exemploBuscarMensagens(threadId) {
  const mensagens = await getThreadMessages(threadId);
  console.log('Mensagens da thread:', mensagens);
  
  mensagens.forEach(msg => {
    const tipo = msg.senderType === 'user' ? 'Usuário' : 'Suporte';
    console.log(`[${tipo}] ${msg.message}`);
    console.log(`Data: ${msg.createdAt}`);
  });
}

// Exemplo 3: Criar nova mensagem
async function exemploCriarMensagem() {
  const novaMensagem = await createMessage('Olá, preciso de ajuda!');
  
  console.log('Mensagem criada:', novaMensagem);
  console.log(`Thread ID: ${novaMensagem.threadId}`);
}

// Exemplo 4: Responder a uma mensagem
async function exemploResponder(threadId) {
  // Primeiro, buscar a última mensagem da thread
  const mensagens = await getThreadMessages(threadId);
  const ultimaMensagem = mensagens[mensagens.length - 1];
  
  // Responder
  const resposta = await replyToMessage(
    ultimaMensagem.id,
    'Olá! Como posso ajudar?',
    'user'
  );
  
  console.log('Resposta enviada:', resposta);
}

// Exemplo 5: Polling para atualizar mensagens automaticamente
function iniciarPollingMensagens(threadId, callback) {
  let ultimaAtualizacao = Date.now();
  
  const intervalId = setInterval(async () => {
    try {
      const mensagens = await getThreadMessages(threadId);
      
      // Verificar se há mensagens novas
      const novasMensagens = mensagens.filter(msg => {
        const msgTime = new Date(msg.createdAt).getTime();
        return msgTime > ultimaAtualizacao;
      });
      
      if (novasMensagens.length > 0) {
        ultimaAtualizacao = Date.now();
        callback(novasMensagens);
      }
    } catch (error) {
      console.error('Erro no polling:', error);
    }
  }, 3000); // Verificar a cada 3 segundos
  
  // Retornar função para parar o polling
  return () => clearInterval(intervalId);
}

// Uso do polling
const pararPolling = iniciarPollingMensagens(1, (novasMensagens) => {
  console.log('Novas mensagens recebidas:', novasMensagens);
  // Atualizar interface aqui
});

// Para parar o polling:
// pararPolling();
```

## 🔄 Integração com API PHP (Painel Administrativo)

Se você precisar se conectar à API PHP do Painel Administrativo, use estas funções:

```javascript
/**
 * Configuração da API PHP
 */
const API_PHP_CONFIG = {
  baseURL: 'http://localhost/Painel_Administrativo/Painel_Administrativo'
};

/**
 * Função para fazer requisições à API PHP (sem autenticação JWT)
 */
async function fetchPHPAPI(endpoint, options = {}) {
  const url = `${API_PHP_CONFIG.baseURL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erro na requisição API PHP:', error);
    throw error;
  }
}

/**
 * Listar conversas da API PHP
 */
async function listConversationsPHP(limit = 20) {
  try {
    const data = await fetchPHPAPI(`/api/support/messages.php?limit=${limit}`);
    return data.items || [];
  } catch (error) {
    console.error('Erro ao listar conversas:', error);
    return [];
  }
}

/**
 * Criar mensagem na API PHP
 */
async function createMessagePHP(message, userId = null, senderType = 'user') {
  try {
    const body = { message, senderType };
    if (userId) body.userId = userId;
    
    return await fetchPHPAPI('/api/support/messages.php', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.error('Erro ao criar mensagem:', error);
    throw error;
  }
}

/**
 * Responder mensagem na API PHP
 */
async function replyToMessagePHP(messageId, message, senderType = 'support', userId = null) {
  try {
    const body = { message, senderType };
    if (userId) body.userId = userId;
    
    return await fetchPHPAPI(`/api/support/messages_reply.php?id=${messageId}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.error('Erro ao responder mensagem:', error);
    throw error;
  }
}
```

## 📋 Estrutura de Dados

### Mensagem (Node.js)

```typescript
interface Message {
  id: number;
  threadId: number;
  message: string;
  senderType: 'user' | 'support';
  replyTo: number | null;
  userId: number;
  createdAt: string; // ISO 8601 format
}
```

### Thread/Conversa

```typescript
interface Thread {
  id: number;
  threadId: number;
  message: string;
  senderType: 'user' | 'support';
  createdAt: string;
  replyCount: number;
  lastReplyAt: string | null;
}
```

## 🔐 Autenticação

A API Node.js do PromoPing requer autenticação JWT:

1. **Login**: Faça login para obter o token
   ```
   POST /api/auth/login
   Body: { email, password }
   Response: { token, user }
   ```

2. **Armazenar token**: Salve o token no localStorage ou cookie
   ```javascript
   localStorage.setItem('token', token);
   ```

3. **Usar token**: Inclua o token no header de todas as requisições
   ```javascript
   headers: {
     'Authorization': `Bearer ${token}`
   }
   ```

## 🛠️ Troubleshooting

### Erro 401 - Não autenticado
- Verifique se o token está sendo enviado no header
- Verifique se o token não expirou (tokens expiram em 7 dias)
- Faça login novamente para obter um novo token

### Erro 404 - Endpoint não encontrado
- Verifique se o servidor Node.js está rodando na porta 3000
- Verifique se o caminho base está correto: `/api/support`

### Erro 500 - Erro interno
- Verifique a conexão com a base de dados MySQL
- Verifique se a tabela `SupportMessages` existe
- Verifique os logs do servidor Node.js

### Mensagens não aparecem
- Verifique se o `threadId` está correto
- Certifique-se de que o polling está ativo
- Verifique o console do navegador para erros
- Verifique se o token de autenticação é válido

## 📊 Estrutura da Tabela MySQL

A tabela `SupportMessages` deve ter estas colunas:

- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `userId` (INT, NOT NULL)
- `message` (TEXT, NOT NULL)
- `senderType` (ENUM('user', 'support'), DEFAULT 'user')
- `replyTo` (INT, NULL)
- `threadId` (INT, NULL)
- `createdAt` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

## 📝 Notas Importantes

1. **Autenticação**: A API Node.js requer autenticação JWT, enquanto a API PHP pode não requerer (dependendo da configuração)

2. **CORS**: Se estiver chamando de outro domínio, verifique as configurações CORS no servidor

3. **Rate Limiting**: O servidor pode ter rate limiting - verifique os limites

4. **Formato de Data**: 
   - Node.js retorna ISO 8601: `2024-11-04T15:30:00.000Z`
   - PHP pode retornar: `2024-11-04 15:30:00`

## 🔗 Arquivos Relacionados

- `/backend/routes/support.js` - Implementação da API Node.js
- `/frontend/assets/scripts/support-widget.js` - Widget de suporte do frontend
- `/backend/middleware/auth.js` - Middleware de autenticação JWT

