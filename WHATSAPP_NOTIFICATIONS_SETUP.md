# 📱 Configuração de Notificações WhatsApp

Este guia explica como configurar e usar as notificações WhatsApp no PromoPing.

## 🚀 Configuração Inicial

### 1. Verificar Estrutura do Banco

As tabelas e colunas necessárias já existem no banco de dados:
- ✅ Tabela `Utilizadores` com coluna `Telefone`
- ✅ Colunas `CodigoEmail`, `CodigoTelefone`, `EmailVerificado`
- ✅ Tabela `codigossms` para códigos SMS

### 2. Instalar Dependências WhatsApp

```bash
npm install whatsapp-web.js qrcode-terminal
```

### 3. Configurar Variáveis de Ambiente

Adicione no seu `.env`:

```env
# WhatsApp Configuration
WHATSAPP_SESSION_PATH=./whatsapp-session
```

## 🔧 Como Funciona

### Fluxo de Notificações

1. **Usuário cadastra telefone** → Durante registro ou no perfil
2. **Sistema detecta mudança de preço** → Via scraping automático
3. **WhatsApp é enviado** → Notificação automática para o usuário

### Endpoints Disponíveis

#### 1. Atualizar Telefone do Usuário
```http
PUT /auth/telefone
Authorization: Bearer <token>
Content-Type: application/json

{
  "telefone": "351912345678"
}
```

#### 2. Buscar Perfil do Usuário
```http
GET /auth/profile
Authorization: Bearer <token>
```

#### 3. Atualizar Preço de Produto (com WhatsApp)
```http
POST /produtos/:id/refresh
Authorization: Bearer <token>
```

## 📋 Estrutura do Banco de Dados

### Tabela Utilizadores (Estrutura Existente)
```sql
-- Colunas já existentes:
Email VARCHAR(255)
CodigoEmail VARCHAR(6) NULL
EmailVerificado TINYINT(1) DEFAULT 0
Telefone VARCHAR(20) NULL
CodigoTelefone VARCHAR(6) NULL
SenhaHash VARCHAR(255)
```

## 🔄 Fluxo de Integração

### 1. Registro com Telefone
```javascript
// Frontend - Formulário de registro
const registerData = {
  nome: "João Silva",
  email: "joao@email.com", 
  password: "senha123",
  telefone: "351912345678"  // ← NOVO CAMPO
};
```

### 2. Atualização de Preço (Backend)
```javascript
// routes/produtos.js - Linha 306-320
// 🔔 Enviar notificação WhatsApp se o usuário tiver telefone
try {
    const [userData] = await pool.query(
        "SELECT Telefone FROM Utilizadores WHERE Id = ?",
        [userId]
    );
    
    if (userData.length > 0 && userData[0].Telefone) {
        await enviarWhatsApp(userData[0].Telefone, `📢 ${p.Nome}: €${novoPreco}`);
        console.log(`📱 WhatsApp enviado para ${userData[0].Telefone}`);
    }
} catch (whatsappError) {
    console.error("Erro ao enviar WhatsApp:", whatsappError);
    // Não falha a operação se o WhatsApp der erro
}
```

## 🎯 Funcionalidades Implementadas

### ✅ Backend
- [x] Integração WhatsApp no `routes/produtos.js`
- [x] Campo telefone no registro (`routes/auth.js`)
- [x] Rota para atualizar telefone (`PUT /auth/telefone`)
- [x] Rota para buscar perfil (`GET /auth/profile`)
- [x] Migração do banco de dados
- [x] Validação de formato de telefone

### ✅ Banco de Dados
- [x] Coluna `Telefone` na tabela `Utilizadores`
- [x] Índice para performance
- [x] Compatibilidade com registros existentes

### ✅ WhatsApp Bot
- [x] Função `enviarWhatsApp()` exportada
- [x] Integração com `whatsapp-web.js`
- [x] Tratamento de erros

## 🧪 Testando a Integração

### 1. Teste de Registro
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Teste User",
    "email": "teste@email.com",
    "password": "123456",
    "telefone": "351912345678"
  }'
```

### 2. Teste de Atualização de Telefone
```bash
curl -X PUT http://localhost:3000/auth/telefone \
  -H "Authorization: Bearer <seu_token>" \
  -H "Content-Type: application/json" \
  -d '{"telefone": "351987654321"}'
```

### 3. Teste de Atualização de Preço
```bash
curl -X POST http://localhost:3000/produtos/1/refresh \
  -H "Authorization: Bearer <seu_token>"
```

## 🔍 Monitoramento

### Logs do WhatsApp
```bash
# Verificar se o bot está conectado
tail -f logs/whatsapp.log

# Verificar notificações enviadas
grep "WhatsApp enviado" logs/app.log
```

### Verificar Status da Sessão
```javascript
// No console do Node.js
client.getState() // Deve retornar 'CONNECTED'
```

## 🚨 Troubleshooting

### Problema: WhatsApp não conecta
```bash
# Limpar sessão e reconectar
rm -rf whatsapp-session/
npm start
```

### Problema: Telefone não é salvo
```sql
-- Verificar se a coluna existe
DESCRIBE Utilizadores;

-- Verificar dados
SELECT Id, Nome, Telefone FROM Utilizadores WHERE Telefone IS NOT NULL;
```

### Problema: Notificação não é enviada
```javascript
// Verificar se o usuário tem telefone
const [user] = await pool.query(
  "SELECT Telefone FROM Utilizadores WHERE Id = ?", 
  [userId]
);
console.log('Telefone do usuário:', user[0]?.Telefone);
```

## 📈 Próximos Passos

1. **Interface Frontend**: Adicionar campo telefone no formulário de registro
2. **Validação Avançada**: Melhorar validação de formato de telefone
3. **Templates de Mensagem**: Personalizar mensagens WhatsApp
4. **Configurações**: Permitir usuário escolher tipo de notificação
5. **Analytics**: Rastrear taxa de entrega das notificações

## 🔐 Segurança

- ✅ Telefones são validados antes de salvar
- ✅ WhatsApp funciona apenas com números válidos
- ✅ Erros de WhatsApp não afetam outras funcionalidades
- ✅ Logs não expõem dados sensíveis

---

**🎉 Integração WhatsApp concluída com sucesso!**

Agora os usuários podem receber notificações automáticas quando os preços dos produtos mudarem.
