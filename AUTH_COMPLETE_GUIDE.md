# 🔐 Sistema de Autenticação Completo - PromoPing

Este guia explica como usar o sistema completo de autenticação com SMS/WhatsApp e Email.

## 🚀 Funcionalidades Implementadas

### ✅ **Registro e Login**
- **Registro por Email** → Verificação por email
- **Registro por Telefone** → Verificação por WhatsApp
- **Login Google** → OAuth integrado
- **Login Email/Senha** → Autenticação tradicional

### ✅ **Recuperação de Senha**
- **Por Email** → Código enviado por email
- **Por Telefone** → Código enviado por WhatsApp
- **Reset de Senha** → Nova senha com validação de código

### ✅ **Verificação Multi-Canal**
- **Email** → Códigos por email
- **WhatsApp** → Códigos por WhatsApp
- **Flexibilidade** → Usuário escolhe o canal

## 📋 Endpoints Disponíveis

### **1. Registro por Telefone (SMS/WhatsApp)**
```http
POST /auth/register-sms
Content-Type: application/json

{
  "telefone": "351933992199",
  "nome": "Julia" // opcional
}
```

**Resposta:**
```json
{
  "status": "ok",
  "message": "Código enviado para WhatsApp!",
  "telefone": "351933992199"
}
```

### **2. Validar Código SMS/WhatsApp**
```http
POST /auth/validar-sms
Content-Type: application/json

{
  "telefone": "351933992199",
  "codigo": "123456"
}
```

**Resposta:**
```json
{
  "status": "ok",
  "message": "Conta criada e validada com sucesso!",
  "token": "jwt_token_aqui",
  "user": {
    "id": 1,
    "telefone": "351933992199",
    "nome": "Julia"
  }
}
```

### **3. Registro por Email**
```http
POST /auth/register
Content-Type: application/json

{
  "nome": "Julia",
  "email": "julia@email.com",
  "password": "123456",
  "telefone": "351933992199" // opcional
}
```

### **4. Login por Email/Senha**
```http
POST /auth/login
Content-Type: application/json

{
  "email": "julia@email.com",
  "password": "123456"
}
```

### **5. Recuperação de Senha**
```http
POST /auth/esqueci-senha
Content-Type: application/json

{
  "emailOuTelefone": "julia@email.com" // ou "351933992199"
}
```

**Resposta:**
```json
{
  "status": "ok",
  "message": "Código enviado por email!", // ou "WhatsApp"
  "canal": "email" // ou "whatsapp"
}
```

### **6. Reset de Senha**
```http
POST /auth/resetar-senha
Content-Type: application/json

{
  "emailOuTelefone": "julia@email.com", // ou "351933992199"
  "codigo": "123456",
  "novaSenha": "novaSenha123"
}
```

### **7. Verificação de Email (Usuário Logado)**
```http
POST /auth/verificar/email
Authorization: Bearer <token>
```

### **8. Verificação de Telefone (Usuário Logado)**
```http
POST /auth/verificar/telefone
Authorization: Bearer <token>
```

### **9. Validar Código (Usuário Logado)**
```http
POST /auth/verificar/validar
Authorization: Bearer <token>
Content-Type: application/json

{
  "codigo": "123456",
  "tipo": "email" // ou "telefone"
}
```

## 🔄 Fluxos de Uso

### **Fluxo 1: Registro por Telefone**
1. **Usuário fornece telefone** → `POST /auth/register-sms`
2. **Sistema envia WhatsApp** → Código de 6 dígitos
3. **Usuário informa código** → `POST /auth/validar-sms`
4. **Conta ativada** → Token JWT gerado
5. **Login automático** → Usuário logado

### **Fluxo 2: Registro por Email**
1. **Usuário fornece email** → `POST /auth/register`
2. **Sistema envia email** → Código de verificação
3. **Usuário verifica código** → `POST /auth/verificar-codigo`
4. **Conta ativada** → Token JWT gerado
5. **Login automático** → Usuário logado

### **Fluxo 3: Recuperação de Senha**
1. **Usuário esquece senha** → `POST /auth/esqueci-senha`
2. **Escolhe canal** → Email ou telefone
3. **Sistema envia código** → Pelo canal escolhido
4. **Usuário informa código** → `POST /auth/resetar-senha`
5. **Senha alterada** → Login liberado

## 🧪 Testando o Sistema

### **Teste 1: Registro por Telefone**
```bash
# 1. Registrar com telefone
curl -X POST http://localhost:3000/auth/register-sms \
  -H "Content-Type: application/json" \
  -d '{
    "telefone": "351933992199",
    "nome": "Julia"
  }'

# 2. Verificar WhatsApp - deve receber código

# 3. Validar código
curl -X POST http://localhost:3000/auth/validar-sms \
  -H "Content-Type: application/json" \
  -d '{
    "telefone": "351933992199",
    "codigo": "123456"
  }'
```

### **Teste 2: Recuperação por Email**
```bash
# 1. Solicitar recuperação
curl -X POST http://localhost:3000/auth/esqueci-senha \
  -H "Content-Type: application/json" \
  -d '{"emailOuTelefone": "julia@email.com"}'

# 2. Verificar email - deve receber código

# 3. Resetar senha
curl -X POST http://localhost:3000/auth/resetar-senha \
  -H "Content-Type: application/json" \
  -d '{
    "emailOuTelefone": "julia@email.com",
    "codigo": "123456",
    "novaSenha": "novaSenha123"
  }'
```

### **Teste 3: Recuperação por Telefone**
```bash
# 1. Solicitar recuperação
curl -X POST http://localhost:3000/auth/esqueci-senha \
  -H "Content-Type: application/json" \
  -d '{"emailOuTelefone": "351933992199"}'

# 2. Verificar WhatsApp - deve receber código

# 3. Resetar senha
curl -X POST http://localhost:3000/auth/resetar-senha \
  -H "Content-Type: application/json" \
  -d '{
    "emailOuTelefone": "351933992199",
    "codigo": "123456",
    "novaSenha": "novaSenha123"
  }'
```

## 📱 Mensagens WhatsApp

### **Registro:**
```
📢 Seu código PromoPing é: 123456

Use este código para ativar sua conta.

Se não foi você, ignore esta mensagem.
```

### **Recuperação:**
```
🔑 Seu código de recuperação é: 123456

Este código expira em 10 minutos.

Se não foi você, ignore esta mensagem.
```

### **Notificações de Produtos:**
```
📢 Nome do Produto: €99.99
```

## 📧 Mensagens Email

### **Registro:**
```
Assunto: PromoPing - Verificação de conta

Olá Julia!

Obrigado por se registrar no PromoPing!

Use o código abaixo para verificar sua conta:
123456

Este código expira em 10 minutos.
Se não foi você, ignore este e-mail.

© 2025 PromoPing
```

### **Recuperação:**
```
Assunto: PromoPing - Recuperação de senha

Olá Julia!

Você solicitou a recuperação de senha.

Seu código é: 123456

Este código expira em 10 minutos.
Se não foi você, ignore este e-mail.

PromoPing
```

## 🔍 Logs do Sistema

### **Logs de Registro:**
```bash
📱 Código SMS enviado para 351933992199: 123456
✅ Conta SMS ativada com sucesso para usuário 1
```

### **Logs de Recuperação:**
```bash
📧 Código de recuperação enviado para julia@email.com: 123456
📱 Código de recuperação enviado para 351933992199: 123456
✅ Senha redefinida com sucesso para usuário 1 via email
```

### **Logs de WhatsApp:**
```bash
🤖 Bot conectado ao WhatsApp!
📱 Tentando enviar mensagem para: 351933992199@c.us
✅ Mensagem enviada com sucesso para 351933992199
```

## 🎯 Benefícios do Sistema

### **✅ Flexibilidade**
- Usuário escolhe canal preferido
- Email ou telefone para recuperação
- Múltiplas formas de autenticação

### **✅ Segurança**
- Códigos de 6 dígitos
- Expiração em 10 minutos
- Verificação obrigatória

### **✅ UX Melhorada**
- WhatsApp instantâneo
- Email confiável
- Processo simples

### **✅ Escalabilidade**
- Fácil adicionar novos canais
- Sistema modular
- Logs detalhados

---

**🎉 Sistema de autenticação completo implementado!**

Agora os usuários podem se registrar e recuperar senhas tanto por email quanto por WhatsApp, com total flexibilidade e segurança.
