# 🔧 Configuração do Ambiente - PromoPing

## ❌ Problema Identificado
O erro "Unexpected token '<', \"<!DOCTYPE ... is not valid JSON" indica que o servidor backend não está rodando ou não está configurado corretamente.

## ✅ Solução

### 1. Criar arquivo .env na raiz do projeto
```bash
# ================== CONFIGURAÇÕES DO BANCO DE DADOS ==================
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=promoping
DB_PORT=3306

# ================== CONFIGURAÇÕES JWT ==================
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_123456789

# ================== CONFIGURAÇÕES DO STRIPE ==================
# Obtenha essas chaves em: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_sua_chave_secreta_do_stripe_aqui
STRIPE_PUBLISHABLE_KEY=pk_test_sua_chave_publica_do_stripe_aqui

# IDs dos preços dos planos (obtenha em: https://dashboard.stripe.com/products)
STRIPE_BASIC_PRICE_ID=price_sua_basic_price_id_aqui
STRIPE_PREMIUM_PRICE_ID=price_sua_premium_price_id_aqui

# ================== CONFIGURAÇÕES DO FRONTEND ==================
FRONTEND_URL=http://127.0.0.1:3000

# ================== CONFIGURAÇÕES DO SERVIDOR ==================
PORT=3000
NODE_ENV=development
```

### 2. Iniciar o servidor backend
```bash
# No terminal, na pasta do projeto:
cd backend
node server.js
```

### 3. Verificar se o servidor está rodando
- Acesse: http://127.0.0.1:3000
- Deve aparecer uma página ou resposta do servidor

### 4. Configurar Stripe (opcional para teste)
- Acesse: https://dashboard.stripe.com/apikeys
- Copie as chaves de teste
- Cole no arquivo .env

## 🚀 Teste Rápido
1. Abra o console do navegador (F12)
2. Clique em um botão SUBSCRIBE
3. Verifique os logs no console
4. Se aparecer "Erro de conexão", o servidor não está rodando

## 📝 Próximos Passos
1. Configure o arquivo .env
2. Inicie o servidor backend
3. Teste novamente o modal de pagamento
