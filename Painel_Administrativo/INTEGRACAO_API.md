# Guia de Integração - API de Suporte/Mensagens

Este guia explica como conectar outro projeto à API de suporte e mensagens do Painel Administrativo.

## Endpoints Disponíveis

### Base URL
- **PHP API (mesmo domínio)**: `http://localhost/Painel_Administrativo/Painel_Administrativo`
- **Node.js API (fallback)**: `http://localhost:3000`

### Endpoints

#### 1. Listar Threads/Conversas
```
GET /api/support/messages.php?limit=20
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
      "userId": 123,
      "userName": "Nome do Usuário",
      "userEmail": "email@example.com",
      "createdAt": "2024-11-04 15:30:00",
      "replyCount": 2
    }
  ],
  "total": 1
}
```

#### 2. Buscar Mensagens de uma Thread
```
GET /api/support/messages.php?threadId=1
```

**Resposta:**
```json
[
  {
    "id": 1,
    "threadId": 1,
    "message": "Mensagem inicial...",
    "senderType": "user",
    "userId": 123,
    "userName": "Nome do Usuário",
    "userEmail": "email@example.com",
    "createdAt": "2024-11-04 15:30:00",
    "timestamp": 1699112400
  },
  {
    "id": 2,
    "threadId": 1,
    "message": "Resposta do suporte...",
    "senderType": "support",
    "userId": null,
    "userName": "Suporte",
    "createdAt": "2024-11-04 15:35:00"
  }
]
```

#### 3. Criar Nova Mensagem
```
POST /api/support/messages.php
Content-Type: application/json

{
  "message": "Texto da mensagem",
  "userId": 123,  // Opcional: se não enviar, usa da sessão
  "senderType": "user"  // "user" ou "support"
}
```

**Resposta:**
```json
{
  "id": 3,
  "threadId": 1,
  "message": "Texto da mensagem",
  "senderType": "user",
  "userId": 123,
  "userName": "Nome do Usuário",
  "createdAt": "2024-11-04 15:40:00"
}
```

#### 4. Responder a uma Mensagem
```
POST /api/support/messages_reply.php?id=1
Content-Type: application/json

{
  "message": "Texto da resposta",
  "senderType": "support",  // "user" ou "support"
  "userId": null  // Opcional
}
```

**Resposta:**
```json
{
  "id": 4,
  "threadId": 1,
  "message": "Texto da resposta",
  "senderType": "support",
  "userId": null,
  "userName": "Suporte",
  "createdAt": "2024-11-04 15:45:00"
}
```

## Código JavaScript para Integração

### Função Base para Requisições

```javascript
/**
 * Configuração da API
 */
const API_CONFIG = {
  // Se estiver no mesmo domínio, usar o caminho relativo
  baseURL: window.location.origin + '/Painel_Administrativo/Painel_Administrativo',
  // Ou se estiver em outro domínio, usar a URL completa
  // baseURL: 'http://localhost/Painel_Administrativo/Painel_Administrativo'
};

/**
 * Função para fazer requisições à API
 */
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_CONFIG.baseURL}${endpoint}`;
  
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
    console.error('Erro na requisição API:', error);
    throw error;
  }
}

/**
 * Listar conversas/threads
 */
async function listConversations(limit = 20) {
  try {
    const data = await fetchAPI(`/api/support/messages.php?limit=${limit}`);
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
    const messages = await fetchAPI(`/api/support/messages.php?threadId=${threadId}`);
    // A API retorna array direto quando busca por threadId
    return Array.isArray(messages) ? messages : [];
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    return [];
  }
}

/**
 * Criar nova mensagem
 */
async function createMessage(message, userId = null, senderType = 'user') {
  try {
    const body = {
      message: message,
      senderType: senderType
    };
    
    if (userId) {
      body.userId = userId;
    }
    
    const response = await fetchAPI('/api/support/messages.php', {
      method: 'POST',
      body: JSON.stringify(body)
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
async function replyToMessage(messageId, message, senderType = 'support', userId = null) {
  try {
    const body = {
      message: message,
      senderType: senderType
    };
    
    if (userId) {
      body.userId = userId;
    }
    
    const response = await fetchAPI(`/api/support/messages_reply.php?id=${messageId}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    
    return response;
  } catch (error) {
    console.error('Erro ao responder mensagem:', error);
    throw error;
  }
}
```

## Exemplo de Uso Completo

```javascript
// Exemplo 1: Listar todas as conversas
async function exemploListarConversas() {
  const conversas = await listConversations();
  console.log('Conversas:', conversas);
  
  conversas.forEach(conversa => {
    console.log(`Thread #${conversa.id}: ${conversa.message}`);
    console.log(`Respostas: ${conversa.replyCount}`);
  });
}

// Exemplo 2: Buscar mensagens de uma thread específica
async function exemploBuscarMensagens(threadId) {
  const mensagens = await getThreadMessages(threadId);
  console.log('Mensagens da thread:', mensagens);
  
  mensagens.forEach(msg => {
    const tipo = msg.senderType === 'user' ? 'Usuário' : 'Suporte';
    console.log(`[${tipo}] ${msg.userName}: ${msg.message}`);
    console.log(`Data: ${msg.createdAt}`);
  });
}

// Exemplo 3: Criar nova mensagem
async function exemploCriarMensagem() {
  const novaMensagem = await createMessage(
    'Olá, preciso de ajuda!',
    123,  // ID do usuário
    'user'
  );
  
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
    'support'
  );
  
  console.log('Resposta enviada:', resposta);
}

// Exemplo 5: Polling para atualizar mensagens automaticamente
function iniciarPollingMensagens(threadId, callback) {
  let ultimaAtualizacao = Date.now();
  
  setInterval(async () => {
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
  }, 3000); // Verificar a cada 3 segundos
}

// Uso do polling
iniciarPollingMensagens(1, (novasMensagens) => {
  console.log('Novas mensagens recebidas:', novasMensagens);
  // Atualizar interface aqui
});
```

## Estrutura de Dados

### Mensagem
```typescript
interface Message {
  id: number;
  threadId: number;
  message: string;
  senderType: 'user' | 'support';
  userId: number | null;
  userName: string;
  userEmail: string;
  createdAt: string; // Formato: "YYYY-MM-DD HH:MM:SS"
  timestamp?: number; // Unix timestamp (opcional)
}
```

### Thread/Conversa
```typescript
interface Thread {
  id: number;
  threadId: number;
  message: string;
  senderType: 'user' | 'support';
  userId: number | null;
  userName: string;
  userEmail: string;
  createdAt: string;
  replyCount: number;
}
```

## CORS e Configuração

Se o outro projeto estiver em um domínio/porta diferente, você precisará configurar CORS no servidor PHP. Adicione no início dos arquivos PHP:

```php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
```

**Nota:** Os arquivos já estão configurados com CORS, mas você pode ajustar o `Access-Control-Allow-Origin` para ser mais específico se necessário.

## Autenticação (Opcional)

Atualmente, a API não requer autenticação, mas se você quiser adicionar:

1. Envie um token no header:
```javascript
headers: {
  'Authorization': `Bearer ${seuToken}`
}
```

2. No PHP, verifique o token:
```php
$token = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$token = str_replace('Bearer ', '', $token);
// Validar token aqui
```

## Troubleshooting

### Erro 404 - Endpoint não encontrado
- Verifique se o caminho base está correto
- Certifique-se de que os arquivos PHP estão em `/api/support/`

### Erro 500 - Erro interno
- Verifique a conexão com a base de dados MySQL
- Verifique se a tabela `supportmessages` existe
- Verifique os logs do PHP

### Mensagens não aparecem
- Verifique se o `threadId` está correto
- Certifique-se de que o polling está ativo
- Verifique o console do navegador para erros

## Estrutura da Tabela MySQL

A tabela `supportmessages` deve ter pelo menos estas colunas:
- `Id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `UserId` (INT, NULL)
- `ThreadId` (INT, NULL ou 0)
- `Mensagem` ou `Message` (TEXT)
- `SenderType` (VARCHAR, 'user' ou 'support')
- `DataEnvio` ou `CreatedAt` (DATETIME)

## Suporte

Para mais informações, consulte os arquivos:
- `/api/support/messages.php`
- `/api/support/messages_reply.php`
- `/config.php` (configuração de banco de dados)

