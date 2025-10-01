# Configuração do Stripe para Pagamentos

## 1. Criar Conta no Stripe

1. Acesse [stripe.com](https://stripe.com)
2. Crie uma conta (modo de teste para desenvolvimento)
3. Obtenha suas chaves de API

## 2. Configurar Variáveis de Ambiente

Adicione ao seu arquivo `.env`:

```env
# Configuração do Stripe
STRIPE_SECRET_KEY=sk_test_sua_chave_secreta_stripe_aqui
STRIPE_BASIC_PRICE_ID=price_sua_price_id_basic_aqui
STRIPE_PREMIUM_PRICE_ID=price_sua_price_id_premium_aqui
FRONTEND_URL=http://localhost:3000
```

## 3. Criar Produtos e Preços no Stripe

### No Dashboard do Stripe:

1. **Produto Basic (€9.99/mês)**:
   - Nome: "PromoPing Basic"
   - Preço: €9.99
   - Recorrência: Mensal
   - Copie o Price ID (price_xxx)

2. **Produto Premium (€9.99/mês)**:
   - Nome: "PromoPing Premium"
   - Preço: €9.99
   - Recorrência: Mensal
   - Copie o Price ID (price_xxx)

## 4. Configurar Webhooks (Opcional)

Para processar eventos do Stripe automaticamente:

1. No Dashboard do Stripe, vá para "Webhooks"
2. Adicione endpoint: `http://localhost:3000/api/payment/webhook`
3. Selecione eventos: `checkout.session.completed`, `invoice.payment_succeeded`

## 5. Testar Pagamentos

### Cartões de Teste:

- **Sucesso**: 4242 4242 4242 4242
- **Falha**: 4000 0000 0000 0002
- **3D Secure**: 4000 0025 0000 3155

### Códigos de Teste:

- **CVV**: Qualquer 3 dígitos
- **Data**: Qualquer data futura
- **CEP**: Qualquer código postal

## 6. Modo Produção

Para produção:

1. Mude para chaves live no Stripe
2. Atualize `STRIPE_SECRET_KEY` para chave live
3. Configure domínio real no `FRONTEND_URL`
4. Teste com cartões reais (em pequenas quantias)

## 7. Monitoramento

- Dashboard do Stripe para ver pagamentos
- Logs do servidor para debug
- Webhooks para eventos automáticos

## 8. Segurança

- Nunca exponha chaves secretas no frontend
- Use HTTPS em produção
- Valide webhooks com assinatura
- Monitore tentativas de fraude
