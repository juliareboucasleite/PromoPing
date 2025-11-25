const PromoPingBot = require('./bot');
const express = require('express');
const http = require('http');

// Verificar se as variáveis de ambiente estão configuradas
if (!process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN === 'SEU_TOKEN_AQUI') {
    console.error('[DISCORD] DISCORD_BOT_TOKEN não configurado no arquivo .env');
    process.exit(1);
}

// Criar e iniciar o bot
const bot = new PromoPingBot();

// Exportar instância globalmente para acesso de outros módulos
global.discordBotInstance = bot;

// Criar servidor HTTP interno para comunicação com o servidor Express
const internalApp = express();
internalApp.use(express.json());

// Endpoint para enviar mensagens via Discord (usado pelo servidor Express)
internalApp.post('/internal/send-message', async (req, res) => {
    try {
        const { channelId, embed } = req.body;
        
        if (!channelId || !embed) {
            return res.status(400).json({ error: 'channelId e embed são obrigatórios' });
        }
        
        if (!bot.client || !bot.client.isReady()) {
            return res.status(503).json({ error: 'Bot não está pronto' });
        }
        
        const channel = await bot.client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            return res.status(404).json({ error: 'Canal não encontrado' });
        }
        
        await channel.send({ embeds: [embed] });
        
        res.json({ success: true, message: 'Mensagem enviada' });
    } catch (error) {
        console.error('[DISCORD INTERNAL] Erro ao enviar mensagem:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para verificar status do bot
internalApp.get('/internal/status', (req, res) => {
    res.json({
        ready: bot.client?.isReady() || false,
        available: !!bot.client
    });
});

// Iniciar servidor HTTP interno na porta 3001
const internalServer = http.createServer(internalApp);
internalServer.listen(3001, '127.0.0.1', () => {
    console.log('[DISCORD] Servidor interno de comunicação iniciado na porta 3001');
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('[DISCORD] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('[DISCORD] Uncaught Exception:', error);
    process.exit(1);
});

// Iniciar o bot
async function startBot() {
    try {
        console.log('Iniciando bot Discord...');
        await bot.connect();
        console.log('Bot Discord conectado com sucesso!');
    } catch (error) {
        console.error('Falha ao iniciar bot:', error);
        process.exit(1);
    }
}

// Tratamento de sinais para shutdown graceful
process.on('SIGINT', async () => {
    await bot.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await bot.disconnect();
    process.exit(0);
});

// Iniciar
startBot();
