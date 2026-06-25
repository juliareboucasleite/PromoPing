const { Agent, setGlobalDispatcher } = require('undici');
const dns = require('dns');
const express = require('express');
const http = require('http');

dns.setDefaultResultOrder('ipv4first');
setGlobalDispatcher(new Agent({
    connect: {
        autoSelectFamily: true,
        timeout: 20000
    },
    keepAliveTimeout: 30000
}));

const PromoPingBot = require('./bot');
const INTERNAL_BOT_HOST = process.env.INTERNAL_BOT_HOST || '127.0.0.1';
const INTERNAL_BOT_PORT = parseInt(process.env.INTERNAL_BOT_PORT || '3001', 10);

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

/**
 * Cria categoria "Tickets" (se não existir) e um canal por ticket (estilo ticket automático).
 * Body: { threadId, message, userName?, userEmail? }
 * Retorna: { channelId } para o backend guardar e enviar mensagens ao vivo.
 */
internalApp.post('/internal/create-support-ticket', async (req, res) => {
    try {
        const { ChannelType, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const ticketHelpers = require('./utils/ticketHelpers');
        const ticketConfig = require('./config/ticketConfig');
        const { threadId, message, userName, userEmail, transcript, escalationReason } = req.body || {};
        console.log('[DISCORD] create-support-ticket recebido, threadId:', threadId);
        if (!threadId || !message) {
            return res.status(400).json({ error: 'threadId e message são obrigatórios' });
        }
        if (!bot.client || !bot.client.isReady()) {
            console.warn('[DISCORD] create-support-ticket: bot ainda não está pronto');
            return res.status(503).json({ error: 'Bot não está pronto' });
        }
        const guildId = process.env.DISCORD_GUILD_ID || bot.client.guilds.cache.first()?.id;
        if (!guildId) {
            console.error('[DISCORD] create-support-ticket: nenhum servidor (guild). Defina DISCORD_GUILD_ID no .env ou adicione o bot a um servidor.');
            return res.status(503).json({ error: 'Nenhum servidor (guild) disponível. Defina DISCORD_GUILD_ID no .env.' });
        }
        const guild = await bot.client.guilds.fetch(guildId).catch((err) => {
            console.error('[DISCORD] create-support-ticket: falha ao obter guild:', err.message);
            return null;
        });
        if (!guild) {
            return res.status(503).json({ error: 'Servidor não encontrado' });
        }
        console.log('[DISCORD] Usando servidor:', guild.name, '(' + guildId + ')');

        let category = guild.channels.cache.find(
            ch => ch.name === 'Tickets' && ch.type === ChannelType.GuildCategory
        );
        if (!category) {
            console.log('[DISCORD] A criar categoria "Tickets"...');
            category = await guild.channels.create({
                name: 'Tickets',
                type: ChannelType.GuildCategory
            });
            console.log('[DISCORD] Categoria "Tickets" criada, id:', category.id);
        } else {
            console.log('[DISCORD] Categoria "Tickets" já existe, id:', category.id);
        }

        const channelName = 'ticket-' + String(threadId).replace(/\s/g, '-').substring(0, 80);
        const overwrites = [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: bot.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }
        ];
        for (const roleId of ticketConfig.getStaffRoleIds()) {
            overwrites.push({
                id: roleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
            });
        }
        console.log('[DISCORD] A criar canal', channelName, 'na categoria Tickets...');
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: overwrites
        });
        console.log('[DISCORD] Canal criado, id:', channel.id);

        const fields = [];
        if (userName && String(userName).trim()) {
            fields.push({ name: 'Name', value: String(userName).trim().substring(0, 256), inline: true });
        }
        if (userEmail && String(userEmail).trim()) {
            fields.push({ name: 'Email', value: String(userEmail).trim().substring(0, 256), inline: true });
        }
        if (escalationReason && String(escalationReason).trim()) {
            fields.push({ name: 'Escalation reason', value: String(escalationReason).trim().substring(0, 256), inline: false });
        }
        fields.push({ name: 'Message', value: (message || '').substring(0, 1024) || '(empty)', inline: false });

        const embed = new EmbedBuilder()
            .setTitle('Support & Help')
            .setDescription('Support request escalated from the website. A staff member will assist shortly.')
            .setColor(0xed4245)
            .setTimestamp()
            .addFields(fields)
            .setFooter({ text: `PromoPing | Ticket #${threadId}` });

        const row = ticketHelpers.buildTicketActionRow(channel.id, `widget-${threadId}`);
        const mentionText = ticketHelpers.buildStaffMention();
        const welcomeMsg = await channel.send({ content: mentionText, embeds: [embed], components: [row] });
        await welcomeMsg.pin().catch(() => {});

        if (bot.ticketMeta) {
            bot.ticketMeta.set(channel.id, {
                ownerId: `widget-${threadId}`,
                openedAt: new Date(),
                claimedBy: null,
                panelName: 'Support & Help',
                category: 'Website escalation',
                welcomeMessageId: welcomeMsg.id,
            });
        }
        const transcriptText = typeof transcript === 'string' ? transcript.trim() : '';
        if (transcriptText) {
            const prefix = '**Conversation history**\n';
            const chunkSize = 1800;
            for (let i = 0; i < transcriptText.length; i += chunkSize) {
                const chunk = transcriptText.slice(i, i + chunkSize).replace(/```/g, '``` ');
                await channel.send({ content: `${i === 0 ? prefix : ''}\`\`\`\n${chunk}\n\`\`\`` });
            }
        }
        console.log('[DISCORD] Ticket #' + threadId + ' enviado para o canal', channel.name);

        res.json({ channelId: channel.id });
    } catch (error) {
        console.error('[DISCORD INTERNAL] Erro ao criar ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para enviar notificação de preço por DM (chamado pelo backend conforme preferências do utilizador)
internalApp.post('/internal/send-price-dm', async (req, res) => {
    try {
        const { discordId, product } = req.body;
        if (!discordId || !product || !product.Nome) {
            return res.status(400).json({ error: 'discordId e product (com Nome) são obrigatórios' });
        }
        if (!bot.client || !bot.client.isReady()) {
            return res.status(503).json({ error: 'Bot não está pronto' });
        }
        const payload = { ...product, DiscordId: discordId };
        await bot.sendPriceNotification(payload);
        res.json({ success: true });
    } catch (err) {
        console.error('[DISCORD INTERNAL] Erro send-price-dm:', err);
        res.status(500).json({ error: err.message });
    }
});

// Enviar DM genérico (ex.: parabéns de aniversário)
internalApp.post('/internal/send-dm', async (req, res) => {
    try {
        const { discordUserId, text, embed } = req.body;
        if (!discordUserId || (!text && !embed)) {
            return res.status(400).json({ error: 'discordUserId e (text ou embed) são obrigatórios' });
        }
        if (!bot.client || !bot.client.isReady()) {
            return res.status(503).json({ error: 'Bot não está pronto' });
        }
        const user = await bot.client.users.fetch(String(discordUserId)).catch(() => null);
        if (!user) {
            return res.status(404).json({ error: 'Utilizador Discord não encontrado' });
        }
        const dmChannel = await user.createDM().catch(() => null);
        if (!dmChannel) {
            return res.status(500).json({ error: 'Não foi possível abrir DM com o utilizador' });
        }
        if (embed) {
            const { EmbedBuilder } = require('discord.js');
            const discordEmbed = new EmbedBuilder();
            if (embed.title) discordEmbed.setTitle(embed.title);
            if (embed.description) discordEmbed.setDescription(embed.description);
            if (embed.color) discordEmbed.setColor(embed.color);
            if (embed.timestamp) discordEmbed.setTimestamp(new Date(embed.timestamp));
            if (embed.footer) discordEmbed.setFooter(embed.footer);
            if (embed.fields && Array.isArray(embed.fields) && embed.fields.length > 0) {
                discordEmbed.addFields(embed.fields);
            }
            await dmChannel.send({ embeds: [discordEmbed] });
        } else {
            await dmChannel.send({ content: text });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('[DISCORD INTERNAL] Erro send-dm:', error);
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

// Servidor HTTP interno só inicia DEPOIS do bot estar conectado (para tickets funcionarem)
const internalServer = http.createServer(internalApp);

async function getExistingInternalBotStatus() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    try {
        const response = await fetch(`http://${INTERNAL_BOT_HOST}:${INTERNAL_BOT_PORT}/internal/status`, {
            signal: controller.signal
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

function startInternalServer() {
    return new Promise((resolve, reject) => {
        const handleError = (error) => {
            internalServer.off('listening', handleListening);
            reject(error);
        };

        const handleListening = () => {
            internalServer.off('error', handleError);
            console.log(`[DISCORD] Servidor interno de comunicação iniciado na porta ${INTERNAL_BOT_PORT} (tickets/suporte)`);
            resolve();
        };

        internalServer.once('error', handleError);
        internalServer.once('listening', handleListening);
        internalServer.listen(INTERNAL_BOT_PORT, INTERNAL_BOT_HOST);
    });
}

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
    const existingStatus = await getExistingInternalBotStatus();
    if (existingStatus && existingStatus.available) {
        console.warn(
            `[DISCORD] Já existe uma instância do bot ativa em http://${INTERNAL_BOT_HOST}:${INTERNAL_BOT_PORT}. ` +
            'A nova instância será encerrada para evitar conflito.'
        );
        return;
    }

    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
        try {
            console.log(`[DISCORD] Tentando iniciar bot Discord... (tentativa ${retries + 1}/${maxRetries})`);
            await bot.connect();
            console.log('[DISCORD] Bot Discord conectado com sucesso!');
            await startInternalServer(); // Só agora abrir porta 3001 para tickets/suporte
            return; // Sucesso, sair do loop
        } catch (error) {
            if (error && error.code === 'EADDRINUSE') {
                const status = await getExistingInternalBotStatus();
                if (status && status.available) {
                    console.warn(
                        `[DISCORD] A porta ${INTERNAL_BOT_PORT} já está ocupada por outra instância saudável do bot. ` +
                        'Esta instância será encerrada sem erro.'
                    );
                    await bot.disconnect();
                    return;
                }
            }

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
