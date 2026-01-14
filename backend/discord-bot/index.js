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
        
        // Converter embed JSON para EmbedBuilder do Discord.js
        const { EmbedBuilder } = require('discord.js');
        const discordEmbed = new EmbedBuilder();
        
        if (embed.title) discordEmbed.setTitle(embed.title);
        if (embed.description) discordEmbed.setDescription(embed.description);
        if (embed.url) discordEmbed.setURL(embed.url);
        if (embed.color) discordEmbed.setColor(embed.color);
        if (embed.timestamp) discordEmbed.setTimestamp(new Date(embed.timestamp));
        if (embed.footer) discordEmbed.setFooter(embed.footer);
        if (embed.author) discordEmbed.setAuthor(embed.author);
        if (embed.thumbnail) discordEmbed.setThumbnail(embed.thumbnail.url);
        if (embed.image) discordEmbed.setImage(embed.image.url);
        if (embed.fields && Array.isArray(embed.fields)) {
            discordEmbed.addFields(embed.fields);
        }
        
        await channel.send({ embeds: [discordEmbed] });
        
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

// Iniciar o bot com retry
async function startBot() {
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
        try {
            console.log(`[DISCORD] Tentando iniciar bot Discord... (tentativa ${retries + 1}/${maxRetries})`);
            await bot.connect();
            console.log('[DISCORD] Bot Discord conectado com sucesso!');
            return; // Sucesso, sair do loop
        } catch (error) {
            retries++;
            console.error(`[DISCORD] Falha ao iniciar bot (tentativa ${retries}/${maxRetries}):`, error.message);
            
            if (retries >= maxRetries) {
                console.error('[DISCORD] Número máximo de tentativas atingido. Verifique:');
                console.error('  1. Se o DISCORD_BOT_TOKEN está correto no arquivo .env');
                console.error('  2. Se há problemas de conexão com a internet');
                console.error('  3. Se há firewall bloqueando conexões WebSocket');
                console.error('  4. Se o bot está sendo executado em outro processo');
                process.exit(1);
            }
            
            // Aguardar antes de tentar novamente
            const delay = 10000 * retries; // 10s, 20s, 30s
            console.log(`[DISCORD] Aguardando ${delay/1000} segundos antes de tentar novamente...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
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
