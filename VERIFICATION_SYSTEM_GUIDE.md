# 🔐 Sistema de Verificação e Recuperação de Senha

Este guia explica o sistema completo de verificação de email/telefone e recuperação de senha implementado no PromoPing.

## 🏗️ Estrutura do Banco de Dados

### Tabela Utilizadores (Estrutura Existente)
```sql
-- Campos já existentes no banco:
Email VARCHAR(255)
CodigoEmail VARCHAR(6) NULL
EmailVerificado TINYINT(1) DEFAULT 0
Telefone VARCHAR(20) NULL
CodigoTelefone VARCHAR(6) NULL
SenhaHash VARCHAR(255)
```

### Tabela codigossms (Existente)
```sql
-- Tabela para códigos SMS já existe:
Telefone VARCHAR(20)
Codigo VARCHAR(6)
ExpiraEm DATETIME
```

## 🔄 Fluxos Implementados

### 1. **Registro com Verificação**

#### Fluxo:
1. Usuário se registra com email, senha e telefone (opcional)
2. Sistema gera código de 6 dígitos
3. Código é enviado por **email** (obrigatório)
4. Se telefone fornecido, também envia por **WhatsApp**
5. Usuário deve verificar email antes de fazer login

#### Endpoint:
```http
POST /auth/register
Content-Type: application/json

{
  "nome": "João Silva",
  "email": "joao@email.com",
  "password": "123456",
  "telefone": "351912345678"  // Opcional
}
```

#### Resposta:
```json
{
  "status": "ok",
  "message": "Conta criada com sucesso! Verifique seu email (e WhatsApp se fornecido) para ativar a conta.",
  "codigo": "123456"  // Apenas em desenvolvimento
}
```

### 2. **Login com Verificação**

#### Fluxo:
1. Usuário tenta fazer login
2. Sistema verifica se email está verificado
3. Se não verificado, bloqueia login e solicita verificação

#### Endpoint:
```http
POST /auth/login
Content-Type: application/json

{
  "email": "joao@email.com",
  "password": "123456"
}
```

#### Resposta (Email não verificado):
```json
{
  "status": "error",
  "error": "Email não verificado. Verifique seu email antes de fazer login.",
  "needsVerification": true,
  "email": "joao@email.com"
}
```

### 3. **Verificação de Email**

#### Endpoint:
```http
POST /auth/verificar-codigo
Content-Type: application/json

{
  "email": "joao@email.com",
  "codigo": "123456"
}
```

#### Resposta:
```json
{
  "status": "ok",
  "message": "Email verificado com sucesso!",
  "token": "jwt_token_aqui",
  "user": {
    "id": 1,
    "email": "joao@email.com",
    "nome": "João Silva"
  }
}
```

### 4. **Reenvio de Código**

#### Endpoint:
```http
POST /auth/reenviar-codigo
Content-Type: application/json

{
  "email": "joao@email.com"
}
```

### 5. **Verificação de Telefone (Usuário Logado)**

#### Endpoint:
```http
POST /auth/verificar/telefone
Authorization: Bearer <token>
```

#### Resposta:
```json
{
  "status": "ok",
  "message": "Código enviado para WhatsApp!"
}
```

### 6. **Verificação de Email (Usuário Logado)**

#### Endpoint:
```http
POST /auth/verificar/email
Authorization: Bearer <token>
```

### 7. **Validar Código (Usuário Logado)**

#### Endpoint:
```http
POST /auth/verificar/validar
Authorization: Bearer <token>
Content-Type: application/json

{
  "codigo": "123456",
  "tipo": "email"  // ou "telefone"
}
```

### 8. **Recuperação de Senha**

#### Passo 1 - Solicitar Recuperação:
```http
POST /auth/esqueci-senha
Content-Type: application/json

{
  "emailOuTelefone": "joao@email.com"  // ou "351912345678"
}
```

#### Resposta:
```json
{
  "status": "ok",
  "message": "Código enviado por email!"  // ou "WhatsApp"
}
```

#### Passo 2 - Resetar Senha:
```http
POST /auth/resetar-senha
Content-Type: application/json

{
  "emailOuTelefone": "joao@email.com",
  "codigo": "123456",
  "novaSenha": "novaSenha123"
}
```

## 📱 Integração WhatsApp

### Configuração
```javascript
// auth-whatsApp.js
import { enviarWhatsApp } from './auth-whatsApp.js';

// Uso automático nas rotas de verificação
await enviarWhatsApp(telefone, `🔐 Seu código é: ${codigo}`);
```

### Mensagens Enviadas:
- **Verificação**: `🔐 Seu código de verificação é: 123456`
- **Recuperação**: `🔑 Seu código de recuperação é: 123456`
- **Produtos**: `📢 Nome do Produto: €99.99`

## 🎯 Funcionalidades por Endpoint

### **Registro e Login**
- ✅ Registro com verificação automática
- ✅ Login bloqueado para emails não verificados
- ✅ Reenvio de código de verificação
- ✅ Verificação de código sem login

### **Verificação (Usuário Logado)**
- ✅ Verificar telefone via WhatsApp
- ✅ Verificar email via email
- ✅ Validar códigos de verificação
- ✅ Atualizar telefone no perfil

### **Recuperação de Senha**
- ✅ Recuperação por email ou telefone
- ✅ Código enviado por canal escolhido
- ✅ Reset de senha com validação
- ✅ Limpeza automática de códigos

### **Notificações de Produtos**
- ✅ WhatsApp automático em mudanças de preço
- ✅ Integração com sistema de produtos
- ✅ Tratamento de erros sem afetar operação principal

## 🧪 Testando o Sistema

### 1. **Teste de Registro Completo**
```bash
# 1. Registrar usuário
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Teste User",
    "email": "teste@email.com",
    "password": "123456",
    "telefone": "351912345678"
  }'

# 2. Verificar código (usar código do console/email)
curl -X POST http://localhost:3000/auth/verificar-codigo \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@email.com",
    "codigo": "123456"
  }'

# 3. Fazer login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@email.com",
    "password": "123456"
  }'
```

### 2. **Teste de Recuperação de Senha**
```bash
# 1. Solicitar recuperação
curl -X POST http://localhost:3000/auth/esqueci-senha \
  -H "Content-Type: application/json" \
  -d '{"emailOuTelefone": "teste@email.com"}'

# 2. Resetar senha
curl -X POST http://localhost:3000/auth/resetar-senha \
  -H "Content-Type: application/json" \
  -d '{
    "emailOuTelefone": "teste@email.com",
    "codigo": "123456",
    "novaSenha": "novaSenha123"
  }'
```

### 3. **Teste de Verificação de Telefone**
```bash
# 1. Fazer login primeiro
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "teste@email.com", "password": "123456"}' | jq -r '.token')

# 2. Enviar código para WhatsApp
curl -X POST http://localhost:3000/auth/verificar/telefone \
  -H "Authorization: Bearer $TOKEN"

# 3. Validar código
curl -X POST http://localhost:3000/auth/verificar/validar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"codigo": "123456", "tipo": "telefone"}'
```

## 🔍 Monitoramento e Logs

### Logs Importantes:
```bash
# Verificar códigos gerados
grep "Código de verificação enviado" logs/app.log

# Verificar WhatsApp enviados
grep "WhatsApp enviado" logs/app.log

# Verificar verificações bem-sucedidas
grep "verificado com sucesso" logs/app.log
```

### Status do WhatsApp:
```javascript
// Verificar se bot está conectado
client.getState() // Deve retornar 'CONNECTED'
```

## 🚨 Troubleshooting

### Problema: Email não é enviado
```bash
# Verificar configuração do nodemailer
grep "Email não configurado" logs/app.log
```

### Problema: WhatsApp não conecta
```bash
# Limpar sessão e reconectar
rm -rf whatsapp-session/
npm start
```

### Problema: Código não é salvo
```sql
-- Verificar se códigos estão sendo salvos
SELECT Id, Email, CodigoEmail, EmailVerificado FROM Utilizadores WHERE Email = 'teste@email.com';
```

### Problema: Login bloqueado
```sql
-- Verificar status de verificação
SELECT Email, EmailVerificado FROM Utilizadores WHERE Email = 'teste@email.com';
```

## 📊 Estatísticas do Sistema

### Campos de Controle:
- `EmailVerificado`: 0 = não verificado, 1 = verificado
- `CodigoEmail`: Código atual para verificação de email
- `CodigoTelefone`: Código atual para verificação de telefone
- `Telefone`: Número para notificações WhatsApp

### Fluxo de Dados:
1. **Registro** → Gera código → Envia email/WhatsApp
2. **Verificação** → Valida código → Marca como verificado
3. **Login** → Verifica status → Permite/nega acesso
4. **Recuperação** → Gera código → Envia por canal escolhido
5. **Reset** → Valida código → Atualiza senha

## 🎉 Benefícios da Implementação

- ✅ **Segurança**: Email obrigatório verificado
- ✅ **Flexibilidade**: Recuperação por email ou telefone
- ✅ **UX**: Notificações WhatsApp instantâneas
- ✅ **Robustez**: Tratamento de erros completo
- ✅ **Escalabilidade**: Fácil adicionar novos canais
- ✅ **Manutenibilidade**: Código bem estruturado

---

**🔐 Sistema de verificação implementado com sucesso!**

Agora os usuários têm um fluxo completo e seguro de registro, verificação e recuperação de senha.
