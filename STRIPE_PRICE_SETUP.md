# 🔧 Configuração dos Preços no Stripe

## ❌ Problema Atual
Erro: "No such price: 'prod_T9kvcrl8P30gjt'"

**Causa**: Você está usando IDs de **produto** (`prod_`) em vez de IDs de **preço** (`price_`)

## ✅ Solução

### 1. Acesse o Dashboard do Stripe
- Vá para: https://dashboard.stripe.com/products
- Faça login na sua conta

### 2. Crie os Produtos e Preços

#### Para o Plano BASIC (€9.99/mês):
1. Clique em "Add product"
2. **Nome**: "PromoPing Basic"
3. **Descrição**: "Plano Basic - Até 25 produtos, verificação a cada 4h"
4. **Preço**: €9.99
5. **Cobrança**: Recurring (mensal)
6. Clique em "Save product"
7. **COPIE o Price ID** (começa com `price_`)

#### Para o Plano PREMIUM (€9.99/mês):
1. Clique em "Add product"
2. **Nome**: "PromoPing Premium"
3. **Descrição**: "Plano Premium - Produtos ilimitados, verificação contínua"
4. **Preço**: €9.99
5. **Cobrança**: Recurring (mensal)
6. Clique em "Save product"
7. **COPIE o Price ID** (começa com `price_`)

### 3. Atualize o arquivo .env
```bash
# Substitua pelos Price IDs corretos (que começam com price_)
STRIPE_BASIC_PRICE_ID=price_XXXXXXXXXXXXXX
STRIPE_PREMIUM_PRICE_ID=price_YYYYYYYYYYYYYY
```

### 4. Reinicie o servidor
```bash
# Pare o servidor (Ctrl+C) e inicie novamente
cd backend
node server.js
```

## 🎯 Resultado Esperado
- Os Price IDs devem começar com `price_`
- Não devem começar com `prod_`
- O modal deve redirecionar para o checkout do Stripe

## 📝 Exemplo de Price ID Correto
```
STRIPE_BASIC_PRICE_ID=price_1ABC123def456GHI
STRIPE_PREMIUM_PRICE_ID=price_1XYZ789ghi012JKL
```
