# Configuração de Variáveis de Ambiente - PromoPing

## Variáveis de Redirecionamento

### URLs de Redirecionamento
```env
# URL para redirecionamento após login
AFTER_LOGIN_REDIRECT=/pages/Painel.html

# URL da página de login
LOGIN_URL=/pages/Login.html

# URL do frontend (para CORS)
FRONTEND_URL=http://localhost:3000

# URLs permitidas para CORS (separadas por vírgula)
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# URL para redirecionamento geral
REDIRECT_URL=http://localhost:3000
```

### Configurações Básicas
```env
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
```

### Banco de Dados
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=promoping
DB_PORT=3306
```

### JWT
```env
JWT_SECRET=your_jwt_secret_here
```

### Google OAuth
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Discord
```env
DISCORD_CLIENT_ID=your_discord_client_id
```

### WhatsApp (Twilio)
```env
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

### Telegram
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

### Email
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password
```

### Stripe
```env
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

## Como Usar

1. Copie as variáveis necessárias para seu arquivo `.env`
2. Configure os valores conforme seu ambiente
3. As URLs de redirecionamento serão usadas automaticamente pelo sistema
4. O CORS será configurado automaticamente baseado nas variáveis `FRONTEND_URL` e `ALLOWED_ORIGINS`
