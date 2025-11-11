const PromoPingBot = require('./bot');

// Verificar se as variáveis de ambiente estão configuradas
if (!process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN === 'SEU_TOKEN_AQUI') {
    console.error('[DISCORD] DISCORD_BOT_TOKEN não configurado no arquivo .env');
    process.exit(1);
}

// Criar e iniciar o bot
const bot = new PromoPingBot();

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
        await bot.connect();
    } catch (error) {
        console.error('[DISCORD] Falha ao iniciar bot:', error);
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
