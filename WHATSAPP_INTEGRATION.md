# 🤖 Integração WhatsApp - PromoPing

## 📋 Visão Geral

O sistema agora inclui notificações automáticas via WhatsApp quando os preços dos produtos são atualizados.

## 🔧 Configuração

### 1. Instalação das Dependências

```bash
npm install whatsapp-web.js qrcode-terminal
```

### 2. Estrutura do Sistema

```
backend/
├── routes/
│   └── auth-whatsApp.js     # Bot WhatsApp principal
└── services/
    └── atualizarPrecos.js   # Integração com notificações
```

## 🚀 Como Funciona

### 1. Inicialização do Bot

O arquivo `auth-whatsApp.js`:
- Inicializa o cliente WhatsApp
- Gera QR Code para autenticação
- Exporta função `enviarWhatsApp()` para uso em outras rotas

### 2. Notificações Automáticas

Quando um preço é atualizado em `atualizarPrecos.js`:
- Busca o número de telefone do utilizador
- Envia mensagem via WhatsApp
- Continua funcionando mesmo se WhatsApp falhar

## 📱 Uso Manual

### Enviar Mensagem Específica

```javascript
const { enviarWhatsApp } = require('./routes/auth-whatsApp');

// Enviar para número específico
await enviarWhatsApp('3519XXXXXXXX', '199.90');
```

### Integração em Outras Rotas

```javascript
import { enviarWhatsApp } from './routes/auth-whatsApp.js';

// Dentro de qualquer rota
router.post('/minha-rota', async (req, res) => {
    // ... lógica da rota ...
    
    // Enviar notificação
    await enviarWhatsApp('3519XXXXXXXX', precoNovo);
    
    res.json({ success: true });
});
```

## 🗄️ Estrutura do Banco de Dados

### Tabela Users
```sql
ALTER TABLE Users ADD COLUMN Telefone VARCHAR(20);
```

### Exemplo de Dados
```sql
UPDATE Users SET Telefone = '351912345678' WHERE Id = 1;
```

## 🔄 Fluxo Completo

1. **Utilizador adiciona produto** → Sistema salva na BD
2. **Sistema atualiza preços** → `atualizarPrecos.js` executa
3. **Preço mudou** → Busca telefone do utilizador
4. **Envia WhatsApp** → `enviarWhatsApp()` notifica
5. **Utilizador recebe** → "📢 Preço atualizado: €199.90"

## ⚙️ Configurações

### Intervalos de Verificação
- **FREE**: 24h
- **BASIC**: 4h  
- **PREMIUM**: Contínuo (intervalo = 0)

### Formato da Mensagem
```
📢 Preço atualizado: €199.90
```

## 🛠️ Troubleshooting

### Bot não conecta
1. Verificar se o QR Code foi escaneado
2. Verificar logs: `console.log('🤖 Bot conectado ao WhatsApp!')`

### Mensagens não chegam
1. Verificar se o número está correto na BD
2. Verificar se o número tem WhatsApp
3. Verificar logs de erro

### Erro de importação
```javascript
// Certificar que o caminho está correto
import { enviarWhatsApp } from './routes/auth-whatsApp.js';
```

## 📊 Monitoramento

### Logs Importantes
- `🤖 Bot conectado ao WhatsApp!` - Bot inicializado
- `Mensagem enviada para 3519XXXXXXXX` - Envio bem-sucedido
- `Erro ao enviar mensagem:` - Falha no envio

### Verificar Status
```javascript
// Verificar se o bot está conectado
client.getState().then(state => {
    console.log('Status WhatsApp:', state);
});
```

## 🔒 Segurança

- Números de telefone são validados antes do envio
- Erros de WhatsApp não afetam o sistema principal
- Logs de erro são capturados e registrados

## 📈 Próximos Passos

1. **Personalizar mensagens** por tipo de produto
2. **Adicionar templates** de mensagem
3. **Implementar agendamento** de envios
4. **Adicionar confirmação** de leitura
5. **Criar dashboard** de notificações
