const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ApplicationCommandType } = require('discord.js');
const path = require('path');
const http = require('http');
const https = require('https');
const mysql = require('./mysql2-compat');
const setupDatabase = require('./setup-db');
const comandos = require('./comandos');
const YoutubeFeed = require('./comandos/Youtube/youtube-feed');
const ticketConfig = require('./config/ticketConfig');
const ticketHelpers = require('./utils/ticketHelpers');
const productConfig = require('./config/productConfig');
const suggestionPublic = require('./utils/suggestionPublic');
const memeHelpers = require('./utils/memeHelpers');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

class PromoPingBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildPresences
            ],
            partials: ['CHANNEL'],
            // Configurações para melhorar a conexão
            rest: {
                timeout: 30000, // 30 segundos
                retries: 3
            },
            ws: {
                large_threshold: 250,
                compress: false
            }
        });
        
        // Controle de reconexão
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000; // 5 segundos inicial

        // Configurações de banco de dados
        this.dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'papv5',
            port: parseInt(process.env.DB_PORT) || 5432
        };
        this.dbPool = mysql.createPool(this.dbConfig);
        this.prefixCache = new Map();

        // Configurações do bot
        this.prefix = process.env.DISCORD_PREFIX || '!';
        this.checkInterval = parseInt(process.env.BOT_CHECK_INTERVAL) || 5;
        this.isMonitoring = false;
        this.lastCheck = new Date();
        this.lastErrorLog = 0; // Para controlar spam de erros
        
        // Anti-spam para chamar moderador: armazena timestamp por canal
        this.lastModeratorCall = new Map(); // channelId -> timestamp
        this.ticketMeta = new Map(); // channelId -> { ownerId, openedAt, claimedBy, panelName, category, welcomeMessageId }

        // Monitoramento de Twitch
        this.twitchCheckInterval = null;
        this.lastTwitchCheck = new Date();
        this.twitchLiveStatus = new Map(); // channelName -> { isLive: boolean, lastNotification: Date }
        this.twitchAccessToken = null;
        this.twitchTokenExpiresAt = 0;

        // Monitoramento de Notícias
        this.newsCheckInterval = null;
        this.lastNewsCheck = new Date();
        this.newsService = null; // Será carregado dinamicamente

        // Monitoramento de Memes
        this.memeCheckInterval = null;
        this.lastMemeCheck = new Date();
        this.memeService = null;
        this.memeButtonCooldown = new Map();
        this.youtubeCheckInterval = null;
        this.lastYoutubeCheck = new Date();
        this.youtubeFeedService = new YoutubeFeed(this.client, this.dbConfig);
        this.activityInterval = null;
        this.lastActivityErrorLog = 0;

        // IDs de utilizadores com acesso total (fallback)
        this.adminIds = [
            '1448056767253708821' // ID com acesso total
        ];
        // IDs de cargos (roles) que podem usar !helpadmin e comandos de admin
        this.adminRoleIds = process.env.DISCORD_ADMIN_ROLE_ID
            ? process.env.DISCORD_ADMIN_ROLE_ID.split(',').map(s => s.trim()).filter(Boolean)
            : ['1442655668904398980']; // cargo de suporte/admin (ajustar conforme o servidor)

        this.setupEventHandlers();
    }

    /**
     * Verifica se um usuário tem acesso de administrador (permissoes do Discord OU ID na lista)
     * @param {GuildMember} member - Membro do servidor
     * @returns {boolean} - True se tem acesso de admin
     */
    isAdmin(member) {
        if (!member) return false;
        
        // Verificar se tem permissões de administrador no Discord
        if (member.permissions && member.permissions.has(PermissionFlagsBits.Administrator)) {
            return true;
        }
        
        // Verificar se o ID está na lista de administradores
        const userId = member.user ? member.user.id : member.id;
        return this.adminIds.includes(userId);
    }

    async getGuildPrefix(guildId) {
        if (!guildId) {
            return this.prefix;
        }

        if (this.prefixCache.has(guildId)) {
            return this.prefixCache.get(guildId);
        }

        try {
            const [rows] = await this.dbPool.execute(
                "SELECT Prefix FROM discord_guild_settings WHERE GuildId = ? LIMIT 1",
                [guildId]
            );

            const prefix = rows[0]?.Prefix || this.prefix;
            this.prefixCache.set(guildId, prefix);
            return prefix;
        } catch (error) {
            console.error('[DISCORD] Erro ao obter prefixo do servidor:', error.message);
            return this.prefix;
        }
    }

    async setGuildPrefix(guildId, prefix) {
        const normalizedPrefix = String(prefix || '').trim() || this.prefix;

        await this.dbPool.execute(
            `INSERT INTO discord_guild_settings (GuildId, Prefix)
             VALUES (?, ?)
             ON CONFLICT (GuildId)
             DO UPDATE SET Prefix = EXCLUDED.Prefix, UpdatedAt = CURRENT_TIMESTAMP`,
            [guildId, normalizedPrefix]
        );

        this.prefixCache.set(guildId, normalizedPrefix);
        return normalizedPrefix;
    }

    async getWelcomeSettings(guildId) {
        const [rows] = await this.dbPool.execute(
            "SELECT * FROM discord_welcome_settings WHERE GuildId = ? LIMIT 1",
            [guildId]
        );

        if (rows[0]) {
            return rows[0];
        }

        await this.dbPool.execute(
            `INSERT INTO discord_welcome_settings (GuildId, Enabled, MessageTemplate)
             VALUES (?, FALSE, ?)`,
            [guildId, 'Bem-vindo(a) {user} a {guild}!']
        );

        return {
            GuildId: guildId,
            Enabled: false,
            ChannelId: null,
            MessageTemplate: 'Bem-vindo(a) {user} a {guild}!',
            AutoRoleId: null,
        };
    }

    async getVerificationSettings(guildId) {
        const [rows] = await this.dbPool.execute(
            "SELECT * FROM discord_verification_settings WHERE GuildId = ? LIMIT 1",
            [guildId]
        );

        if (rows[0]) {
            return rows[0];
        }

        await this.dbPool.execute(
            `INSERT INTO discord_verification_settings (GuildId, Enabled, MessageText, ButtonLabel)
             VALUES (?, FALSE, ?, ?)`,
            [guildId, 'Clica no botão abaixo para receber acesso ao servidor.', 'Verificar']
        );

        return {
            GuildId: guildId,
            Enabled: false,
            ChannelId: null,
            RoleId: null,
            MessageId: null,
            MessageText: 'Clica no botão abaixo para receber acesso ao servidor.',
            ButtonLabel: 'Verificar',
        };
    }

    renderTemplate(template, member, guild) {
        return String(template || '')
            .replace(/\{user\}/gi, `<@${member.id}>`)
            .replace(/\{username\}/gi, member.user.username)
            .replace(/\{guild\}/gi, guild.name);
    }

    async handleConfiguredWelcome(member) {
        try {
            if (!member?.guild || member.user?.bot) {
                return;
            }

            const settings = await this.getWelcomeSettings(member.guild.id);

            if (settings.AutoRoleId) {
                const role = member.guild.roles.cache.get(settings.AutoRoleId)
                    || await member.guild.roles.fetch(settings.AutoRoleId).catch(() => null);
                if (role && role.editable) {
                    await member.roles.add(role, 'Autorole de boas-vindas do PromoPing').catch(() => {});
                }
            }

            if (!settings.Enabled || !settings.ChannelId) {
                return;
            }

            const channel = member.guild.channels.cache.get(settings.ChannelId)
                || await member.guild.channels.fetch(settings.ChannelId).catch(() => null);
            if (!channel || !channel.isTextBased || !channel.isTextBased()) {
                return;
            }

            const content = this.renderTemplate(
                settings.MessageTemplate || 'Bem-vindo(a) {user} a {guild}!',
                member,
                member.guild
            );

            await channel.send({ content }).catch(() => {});
        } catch (error) {
            console.error('[DISCORD] Erro ao processar welcome:', error.message);
        }
    }

    async sendVerificationPanel(guild, channelId = null) {
        const settings = await this.getVerificationSettings(guild.id);
        const targetChannelId = channelId || settings.ChannelId;
        if (!targetChannelId) {
            throw new Error('Nenhum canal de verificação foi configurado.');
        }
        if (!settings.RoleId) {
            throw new Error('Nenhum cargo de verificação foi configurado.');
        }

        const channel = guild.channels.cache.get(targetChannelId)
            || await guild.channels.fetch(targetChannelId).catch(() => null);
        if (!channel || !channel.isTextBased || !channel.isTextBased()) {
            throw new Error('Canal de verificação inválido.');
        }

        const embed = new EmbedBuilder()
            .setTitle('Server Verification')
            .setDescription(settings.MessageText || 'Click the button below to get access to the server.')
            .setColor(0x5865F2)
            .setTimestamp()
            .setFooter({ text: `${guild.name} • Verification` });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`verify_accept_${guild.id}`)
                .setLabel(settings.ButtonLabel || 'Verify')
                .setStyle(ButtonStyle.Secondary)
        );

        const sent = await channel.send({
            embeds: [embed],
            components: [row],
        });

        await this.dbPool.execute(
            `UPDATE discord_verification_settings
                SET ChannelId = ?, MessageId = ?, Enabled = TRUE, UpdatedAt = CURRENT_TIMESTAMP
              WHERE GuildId = ?`,
            [channel.id, sent.id, guild.id]
        );

        return sent;
    }

    async handleVerificationButton(interaction) {
        try {
            const guild = interaction.guild;
            if (!guild) {
                return await interaction.reply({ content: 'Este botão só funciona num servidor.', ephemeral: true });
            }

            const settings = await this.getVerificationSettings(guild.id);
            if (!settings.Enabled || !settings.RoleId) {
                return await interaction.reply({
                    content: 'A verificação não está configurada neste servidor.',
                    ephemeral: true,
                });
            }

            const member = await guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) {
                return await interaction.reply({ content: 'Não consegui encontrar o teu perfil neste servidor.', ephemeral: true });
            }

            if (member.roles.cache.has(settings.RoleId)) {
                return await interaction.reply({ content: 'Já tens o cargo de verificação.', ephemeral: true });
            }

            const role = guild.roles.cache.get(settings.RoleId)
                || await guild.roles.fetch(settings.RoleId).catch(() => null);
            if (!role) {
                return await interaction.reply({ content: 'O cargo de verificação já não existe.', ephemeral: true });
            }

            const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
            if (!me || role.position >= me.roles.highest.position) {
                return await interaction.reply({
                    content: 'Não consigo atribuir esse cargo porque ele está acima do meu cargo mais alto.',
                    ephemeral: true,
                });
            }

            await member.roles.add(role, 'Verificação do servidor PromoPing');
            return await interaction.reply({
                content: `Verificação concluída. Recebeste o cargo ${role}.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error('[DISCORD] Erro no botão de verificação:', error.message);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Ocorreu um erro ao concluir a verificação.', ephemeral: true }).catch(() => {});
            }
        }
    }

    pickRandomUsers(items, count) {
        const unique = [...new Set(items)];
        for (let i = unique.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [unique[i], unique[j]] = [unique[j], unique[i]];
        }
        return unique.slice(0, Math.max(0, count));
    }

    async fetchGiveawayParticipants(record) {
        const guild = this.client.guilds.cache.get(record.GuildId)
            || await this.client.guilds.fetch(record.GuildId).catch(() => null);
        if (!guild) {
            throw new Error(`Guild ${record.GuildId} não encontrada.`);
        }

        const channel = guild.channels.cache.get(record.ChannelId)
            || await guild.channels.fetch(record.ChannelId).catch(() => null);
        if (!channel || !channel.isTextBased || !channel.isTextBased()) {
            throw new Error(`Canal ${record.ChannelId} não encontrado.`);
        }

        const giveawayMessage = await channel.messages.fetch(record.MessageId).catch(() => null);
        if (!giveawayMessage) {
            throw new Error(`Mensagem ${record.MessageId} não encontrada.`);
        }

        const reaction = giveawayMessage.reactions.cache.find((entry) => {
            return entry.emoji.toString() === record.ReactionEmoji
                || entry.emoji.name === record.ReactionEmoji
                || entry.emoji.id === record.ReactionEmoji;
        });

        const reactionUsers = reaction ? await reaction.users.fetch().catch(() => null) : null;
        const participants = reactionUsers
            ? [...reactionUsers.values()].filter((user) => !user.bot).map((user) => user.id)
            : [];

        return { guild, channel, giveawayMessage, participants };
    }

    buildGiveawayEmbed(record, winnerIds = [], ended = false) {
        const endsAt = new Date(record.EndsAt);
        const descriptionLines = ended
            ? [
                `Prémio: **${record.Prize}**`,
                `Vencedores: ${winnerIds.length ? winnerIds.map((id) => `<@${id}>`).join(', ') : 'Sem vencedores'}`,
                `Terminou em: <t:${Math.floor(endsAt.getTime() / 1000)}:F>`,
            ]
            : [
                `Prémio: **${record.Prize}**`,
                `Vencedores: **${record.WinnerCount}**`,
                `Termina: <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
                `Reage com ${record.ReactionEmoji || '🎉'} para participar.`,
            ];

        return new EmbedBuilder()
            .setTitle(ended ? 'Giveaway Encerrado' : 'Giveaway Ativo')
            .setDescription(descriptionLines.join('\n'))
            .setColor(ended ? 0xef4444 : 0xf59e0b)
            .setTimestamp();
    }

    async finalizeGiveaway(record, options = {}) {
        const winnerCount = Number(options.winnerCount || record.WinnerCount || 1);
        const reroll = Boolean(options.reroll);
        const { channel, giveawayMessage, participants } = await this.fetchGiveawayParticipants(record);
        const winnerIds = this.pickRandomUsers(participants, winnerCount);

        await this.dbPool.execute(
            `UPDATE discord_giveaways
                SET Ended = ?, WinnerIds = ?, UpdatedAt = CURRENT_TIMESTAMP
              WHERE MessageId = ?`,
            [reroll ? record.Ended : true, JSON.stringify(winnerIds), record.MessageId]
        );

        await giveawayMessage.edit({
            embeds: [this.buildGiveawayEmbed({ ...record, WinnerCount: winnerCount }, winnerIds, true)],
        }).catch(() => {});

        await channel.send({
            content: winnerIds.length
                ? `${reroll ? 'Novo resultado' : 'Giveaway encerrado'}: ${winnerIds.map((id) => `<@${id}>`).join(', ')} ganharam **${record.Prize}**.`
                : `${reroll ? 'Novo resultado' : 'Giveaway encerrado'}: ninguém participou em **${record.Prize}**.`,
            allowedMentions: { parse: ['users'] },
        }).catch(() => {});

        return winnerIds;
    }

    startGiveawayWorker() {
        if (this.giveawayWorkerInterval) {
            return;
        }

        this.giveawayWorkerInterval = setInterval(() => {
            this.processScheduledGiveaways().catch((error) => {
                console.error('[DISCORD] Erro no worker de giveaways:', error.message);
            });
        }, 15000);
    }

    async processScheduledGiveaways() {
        const [rows] = await this.dbPool.execute(
            `SELECT *
               FROM discord_giveaways
              WHERE Ended = FALSE
                AND EndsAt <= CURRENT_TIMESTAMP
              ORDER BY EndsAt ASC
              LIMIT 10`
        );

        for (const row of rows) {
            try {
                await this.finalizeGiveaway(row);
            } catch (error) {
                console.error(`[DISCORD] Falha ao finalizar giveaway ${row.MessageId}:`, error.message);
                if (/não encontrada|não encontrado/i.test(error.message)) {
                    await this.dbPool.execute(
                        `UPDATE discord_giveaways
                            SET Ended = TRUE, WinnerIds = ?, UpdatedAt = CURRENT_TIMESTAMP
                          WHERE MessageId = ?`,
                        ['[]', row.MessageId]
                    ).catch(() => {});
                }
            }
        }
    }

    startCouponQueueWorker() {
        if (this.couponQueueInterval) return;
        const intervalMs = parseInt(process.env.COUPON_QUEUE_INTERVAL_MS) || 5000;
        this.couponQueueInterval = setInterval(() => {
            this.processCouponQueue().catch(err => {
                console.error('[COUPON-QUEUE] Erro no ciclo:', err.message);
            });
        }, intervalMs);
        console.log(`[COUPON-QUEUE] Worker iniciado (intervalo ${intervalMs}ms)`);
    }

    async processCouponQueue() {
        const [pending] = await this.dbPool.execute(
            `SELECT id, guild_id, channel_id, payload, attempts, coupon_message_id
               FROM discord_outbound_queue
              WHERE status = 'pending' AND attempts < 3
              ORDER BY created_at ASC
              LIMIT 5`
        );
        if (!pending || pending.length === 0) return;

        for (const job of pending) {
            const claimed = await this.dbPool.execute(
                `UPDATE discord_outbound_queue
                    SET status = 'processing', attempts = attempts + 1
                  WHERE id = ? AND status = 'pending'`,
                [job.id]
            );
            if (!claimed || (claimed.affectedRows !== undefined && claimed.affectedRows === 0)) continue;

            try {
                const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
                const messageId = await this.sendCouponEmbed(job.guild_id, job.channel_id, payload);

                await this.dbPool.execute(
                    `UPDATE discord_outbound_queue
                        SET status = 'sent', processed_at = CURRENT_TIMESTAMP, last_error = NULL
                      WHERE id = ?`,
                    [job.id]
                );
                if (job.coupon_message_id) {
                    await this.dbPool.execute(
                        `UPDATE discord_coupon_messages SET message_id = ? WHERE id = ?`,
                        [messageId, job.coupon_message_id]
                    );
                }
                console.log(`[COUPON-QUEUE] Job ${job.id} enviado (msg ${messageId})`);
            } catch (err) {
                const errMsg = (err && err.message) ? err.message.substring(0, 500) : String(err);
                const attemptsAfter = (job.attempts || 0) + 1;
                const finalStatus = attemptsAfter >= 3 ? 'failed' : 'pending';
                await this.dbPool.execute(
                    `UPDATE discord_outbound_queue
                        SET status = ?, last_error = ?, processed_at = CASE WHEN ? = 'failed' THEN CURRENT_TIMESTAMP ELSE processed_at END
                      WHERE id = ?`,
                    [finalStatus, errMsg, finalStatus, job.id]
                );
                console.error(`[COUPON-QUEUE] Job ${job.id} falhou (tentativa ${attemptsAfter}):`, errMsg);
            }
        }
    }

    async sendCouponEmbed(guildId, channelId, payload) {
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) throw new Error(`Bot não está na guild ${guildId}`);
        const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased || !channel.isTextBased()) {
            throw new Error(`Canal ${channelId} não encontrado ou não é de texto`);
        }

        const embed = new EmbedBuilder();
        if (payload.title) embed.setTitle(String(payload.title).slice(0, 256));
        let description = payload.description ? String(payload.description) : '';
        if (payload.coupon_code) {
            const code = String(payload.coupon_code).slice(0, 64);
            description += (description ? '\n\n' : '') + `**Código:** \`${code}\``;
        }
        if (description) embed.setDescription(description.slice(0, 4000));
        if (typeof payload.color === 'number') embed.setColor(payload.color);
        if (payload.image_url) embed.setImage(payload.image_url);
        embed.setTimestamp(new Date());

        const components = [];
        if (payload.button_label && payload.button_url) {
            const button = new ButtonBuilder()
                .setLabel(String(payload.button_label).slice(0, 80))
                .setStyle(ButtonStyle.Link)
                .setURL(String(payload.button_url));
            components.push(new ActionRowBuilder().addComponents(button));
        }

        const sent = await channel.send({ embeds: [embed], components });
        return sent.id;
    }

    async syncCorporationGuilds() {
        try {
            const guilds = this.client.guilds.cache;
            if (guilds.size === 0) {
                console.log('[DISCORD] Nenhuma guild para sincronizar com corporation_discord_guilds');
                return;
            }
            for (const [id, guild] of guilds) {
                await this.dbPool.execute(
                    `INSERT INTO corporation_discord_guilds (guild_id, guild_name, guild_icon, added_at, removed_at)
                     VALUES (?, ?, ?, CURRENT_TIMESTAMP, NULL)
                     ON CONFLICT (guild_id) DO UPDATE SET
                        guild_name = EXCLUDED.guild_name,
                        guild_icon = EXCLUDED.guild_icon,
                        removed_at = NULL`,
                    [id, guild.name, guild.icon || null]
                );
            }
            const activeIds = Array.from(guilds.keys());
            const placeholders = activeIds.map(() => '?').join(',');
            await this.dbPool.execute(
                `UPDATE corporation_discord_guilds
                    SET removed_at = CURRENT_TIMESTAMP
                  WHERE removed_at IS NULL
                    AND guild_id NOT IN (${placeholders})`,
                activeIds
            );
            console.log(`[DISCORD] ${guilds.size} guild(s) sincronizadas com corporation_discord_guilds`);
        } catch (err) {
            console.error('[DISCORD] Erro em syncCorporationGuilds:', err.message);
        }
    }

    setupEventHandlers() {
        // Quando o bot se conecta
        const handleClientReady = async () => {
            console.log(`[DISCORD] Bot conectado como ${this.client.user.tag}`);
            console.log(`[DISCORD] Iniciando workers de comunidade (Twitch, notícias, giveaways)...`);
            this.reconnectAttempts = 0; // Reset contador de reconexão
            try {
                await setupDatabase();
            } catch (dbSetupError) {
                console.error('[DISCORD] Erro ao alinhar schema do bot:', dbSetupError.message);
            }
            console.log('[DISCORD] Alertas de preço são enviados pelo backend (alerts.js) — polling local desativado.');
            this.startTwitchMonitoring();
            this.startNewsMonitoring();
            this.startMemeMonitoring();
            this.startYoutubeFeedMonitoring();
            await this.syncCorporationGuilds();
            this.startCouponQueueWorker();
            this.startGiveawayWorker();
            
            // Definir status/presença do bot
            // Alterna entre diferentes descrições de status a cada 20 segundos
            const activities = [
                { name: 'PromoPing - Monitor de Preços', type: 0 },
                { name: '!ajuda para comandos', type: 0 },
                { name: 'promoping.pt', type: 3 }
            ];
            let activityIndex = 0;
            const updateActivity = () => {
                if (!this.client?.isReady?.() || !this.client.user) return;
                const activity = activities[activityIndex];
                try {
                    this.client.user.setActivity(activity.name, { type: activity.type });
                    activityIndex = (activityIndex + 1) % activities.length;
                } catch (error) {
                    const now = Date.now();
                    if (now - this.lastActivityErrorLog > 60000) {
                        this.lastActivityErrorLog = now;
                        console.warn('[DISCORD] Falha ao atualizar status do bot:', error.message);
                    }
                }
            };
            updateActivity();
            if (this.activityInterval) clearInterval(this.activityInterval);
            this.activityInterval = setInterval(updateActivity, 20000);
            
            // Registrar comandos de barra (slash commands)
            await this.registerSlashCommands();
        };
        this.client.once('clientReady', handleClientReady);

        // Handler para erros de conexão
        this.client.on('error', (error) => {
            console.error('[DISCORD] Erro do cliente Discord:', error);
        });

        // Handler para desconexão
        this.client.on('disconnect', () => {
            console.warn('[DISCORD] Bot desconectado do Discord');
            if (this.activityInterval) {
                clearInterval(this.activityInterval);
                this.activityInterval = null;
            }
        });

        // Handler para reconexão
        this.client.on('reconnecting', () => {
            console.log('[DISCORD] Tentando reconectar ao Discord...');
        });

        this.client.on('shardDisconnect', () => {
            if (this.activityInterval) {
                clearInterval(this.activityInterval);
                this.activityInterval = null;
            }
        });

        // Handler para rate limits
        this.client.on('rateLimit', (rateLimitInfo) => {
            console.warn('[DISCORD] Rate limit atingido:', rateLimitInfo);
        });

        // Bot adicionado a um novo servidor — regista para painel de cupões
        this.client.on('guildCreate', async (guild) => {
            try {
                await this.dbPool.execute(
                    `INSERT INTO corporation_discord_guilds (guild_id, guild_name, guild_icon, added_at, removed_at)
                     VALUES (?, ?, ?, CURRENT_TIMESTAMP, NULL)
                     ON CONFLICT (guild_id) DO UPDATE SET
                        guild_name = EXCLUDED.guild_name,
                        guild_icon = EXCLUDED.guild_icon,
                        removed_at = NULL`,
                    [guild.id, guild.name, guild.icon || null]
                );
                console.log(`[DISCORD] Bot adicionado a "${guild.name}" (${guild.id}) — registado em corporation_discord_guilds`);
            } catch (err) {
                console.error('[DISCORD] Erro ao registar guild em guildCreate:', err.message);
            }
        });

        // Bot removido de um servidor — marca como removido
        this.client.on('guildDelete', async (guild) => {
            try {
                await this.dbPool.execute(
                    `UPDATE corporation_discord_guilds SET removed_at = CURRENT_TIMESTAMP WHERE guild_id = ?`,
                    [guild.id]
                );
                console.log(`[DISCORD] Bot removido de "${guild.name || guild.id}" — marcado como removido`);
            } catch (err) {
                console.error('[DISCORD] Erro ao marcar guild removida:', err.message);
            }
        });

        this.client.on('guildMemberAdd', async (member) => {
            await this.handleConfiguredWelcome(member);
        });

        // Quando alguém envia uma mensagem
        this.client.on('messageCreate', async (message) => {
            try {
                if (message.author.bot) {
                    // Verificar se é mensagem de counting (mesmo sendo bot, pode ser necessário)
                    await this.handleCounting(message);
                    return;
                }

                // Verificar se é mensagem privada (DM)
                if (!message.guild) {
                    const privatePrefix = this.prefix;
                    // Processar comandos no privado também
                    if (message.content.startsWith(privatePrefix)) {
                        const args = message.content.slice(privatePrefix.length).trim().split(/ +/);
                        const commandName = args.shift().toLowerCase();
                        const comando = comandos.get(commandName);
                        if (comando) {
                            await comando.execute(this.client, message, args, this);
                            return;
                        }
                    }
                    // Se não for comando, apenas ignorar (não criar ticket automaticamente)
                    return;
                }

                // Resposta do suporte no canal do ticket (widget) → enviar para o backend para aparecer no widget
                if (message.guild && message.channel.parent?.name === 'Tickets' && /^ticket-\d+$/.test(message.channel.name)) {
                    const threadId = message.channel.name.replace(/^ticket-/, '');
                    const backendUrl = process.env.BACKEND_URL || process.env.API_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
                    const secret = process.env.SUPPORT_DISCORD_INTERNAL_SECRET;
                    if (!secret) {
                        console.warn('[DISCORD] SUPPORT_DISCORD_INTERNAL_SECRET não configurado; resposta no canal do ticket não enviada para o widget.');
                        return;
                    }
                    try {
                        const url = new URL(`${backendUrl}/api/support/internal/threads/${threadId}/reply`);
                        const body = JSON.stringify({
                            message: message.content,
                            discordUserId: message.author.id
                        });
                        const lib = url.protocol === 'https:' ? https : http;
                        const res = await new Promise((resolve, reject) => {
                            const req = lib.request({
                                hostname: url.hostname,
                                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                                path: url.pathname,
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret, 'Content-Length': Buffer.byteLength(body) }
                            }, (res) => {
                                let data = '';
                                res.on('data', (chunk) => { data += chunk; });
                                res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, data }));
                            });
                            req.on('error', reject);
                            req.write(body);
                            req.end();
                        });
                        if (!res.ok) {
                            console.warn('[DISCORD] Falha ao enviar resposta do ticket para o backend:', res.statusCode, res.data);
                        }
                    } catch (err) {
                        console.error('[DISCORD] Erro ao enviar resposta do ticket para o backend:', err.message);
                    }
                    return;
                }

                // Verificar counting antes de processar comandos
                const countingHandled = await this.handleCounting(message);
                if (countingHandled) return; // Se foi processado como counting, não processar como comando

                const guildPrefix = await this.getGuildPrefix(message.guild.id);

                // Ignora mensagens sem prefixo
                if (!message.content.startsWith(guildPrefix)) return;

                // Extrai comando e argumentos
                const args = message.content.slice(guildPrefix.length).trim().split(/ +/);
                const commandName = args.shift().toLowerCase();

                const comando = comandos.get(commandName);
                if (!comando) return;

                // Log silencioso de comandos

                await comando.execute(this.client, message, args, this);
            } catch (error) {
                console.error(`[DISCORD] Erro ao processar comando:`, error);
                if (!message.deleted) {
                    await message.reply('Ocorreu um erro ao executar este comando.').catch(() => {});
                }
            }
        });

        this.client.on('error', (error) => {
            console.error('[DISCORD] Erro no bot:', error);
        });

        // Handler de interações (botões, menus, slash commands, etc)
        this.client.on('interactionCreate', async (interaction) => {
            try {
                // Lidar com comandos de barra (slash commands)
                if (interaction.isChatInputCommand()) {
                    await this.handleSlashCommand(interaction);
                    return;
                }
                
                // Lidar com menus de seleção
                if (interaction.isStringSelectMenu()) {
                    if (interaction.customId.startsWith('ticket_categoria_')) {
                        // Extrair categoria do valor selecionado
                        const selectedValue = interaction.values[0];
                        const parts = selectedValue.split('_');
                        const categoriaCode = parts[0]; // notificacoes, duvida, login, produtos, outros
                        const userId = parts[1];
                        
                        // Verificar se é o usuário correto
                        if (interaction.user.id !== userId) {
                            return await interaction.reply({ 
                                content: 'Esta interação não é para você!', 
                                ephemeral: true 
                            });
                        }
                        
                        const categoriaNomes = {
                            'notificacoes': 'Problema com Notificações',
                            'duvida': 'Dúvida sobre o Bot',
                            'login': 'Erro ao Fazer Login',
                            'produtos': 'Problema com Produtos',
                            'outros': 'Outros'
                        };
                        await this.handleTicketCategory(interaction, categoriaNomes[categoriaCode] || categoriaCode, categoriaCode);
                    } else if (interaction.customId.startsWith('review_tipo_')) {
                        await this.handleReviewTypeSelection(interaction);
                    } else if (interaction.customId === 'product_buy_select') {
                        await this.handleProductBuySelect(interaction);
                    }
                }
                // Lidar com botões
                else if (interaction.isButton()) {
                    if (interaction.customId === 'abrir_ticket_promoping') {
                        await this.handleTicketButton(interaction);
                    } else if (interaction.customId === 'iniciar_review_promoping') {
                        // Iniciar fluxo de review quando clicar no botão do painel
                        await this.handleReviewButton(interaction);
                    } else if (interaction.customId.startsWith('review_anonimo_')) {
                        // Handler para botões de anonimato do review
                        const parts = interaction.customId.split('_');
                        const isAnonimo = parts[2] === 'sim';
                        const tipo = parts[3];
                        const tipoNomes = {
                            'site': 'Site',
                            'bot': 'Bot',
                            'suporte': 'Suporte'
                        };
                        await this.handleReviewAnonimoChoice(interaction, tipo, tipoNomes[tipo], isAnonimo);
                    } else if (interaction.customId.startsWith('ticket_confirmar_')) {
                        // Extrair categoria do customId: ticket_confirmar_userId_categoriaCode
                        const parts = interaction.customId.split('_');
                        const categoriaCode = parts[3]; // código da categoria (notificacoes, duvida, etc)
                        await this.handleTicketConfirm(interaction, categoriaCode);
                    } else if (interaction.customId.startsWith('ticket_cancelar_')) {
                        await this.handleTicketCancel(interaction);
                    } else if (interaction.customId.startsWith('ticket_fechar_confirmar_')) {
                        // Verificar confirmar ANTES de ticket_fechar_ (mais específico)
                        await this.handleFecharTicketConfirm(interaction);
                    } else if (interaction.customId.startsWith('ticket_fechar_cancelar_')) {
                        // Verificar cancelar ANTES de ticket_fechar_ (mais específico)
                        await interaction.update({ 
                            content: 'Fechamento cancelado.', 
                            embeds: [], 
                            components: [] 
                        });
                    } else if (interaction.customId.startsWith('ticket_fechar_')) {
                        await this.handleFecharTicketButton(interaction);
                    } else if (interaction.customId.startsWith('ticket_claim_')) {
                        await this.handleTicketClaim(interaction);
                    } else if (interaction.customId.startsWith('ticket_release_')) {
                        await this.handleTicketRelease(interaction);
                    } else if (interaction.customId.startsWith('ticket_chamar_mod_')) {
                        await this.handleChamarModerador(interaction);
                    } else if (interaction.customId.startsWith('support_ticket_fechar_')) {
                        await this.handleSupportTicketFechar(interaction);
                    } else if (interaction.customId.startsWith('support_ticket_chamar_')) {
                        await this.handleSupportTicketChamar(interaction);
                    } else if (interaction.customId.startsWith('verify_accept_')) {
                        await this.handleVerificationButton(interaction);
                    } else if (interaction.customId === 'aceitar_regras_promoping') {
                        await this.handleAceitarRegras(interaction);
                    } else if (interaction.customId === 'abrir_formulario_bug') {
                        await this.handleReportarBugButton(interaction);
                    } else if (interaction.customId === 'abrir_formulario_sugestao') {
                        await this.handleSugerirButton(interaction);
                    } else if (interaction.customId === 'product_review_start') {
                        await this.handleProductReviewStart(interaction);
                    } else if (interaction.customId.startsWith('suggestion_vote_up_')) {
                        await this.handleSuggestionVote(interaction, 'up');
                    } else if (interaction.customId.startsWith('suggestion_vote_down_')) {
                        await this.handleSuggestionVote(interaction, 'down');
                    } else if (interaction.customId.startsWith('suggestion_discuss_')) {
                        await this.handleSuggestionDiscuss(interaction);
                    } else if (interaction.customId === memeHelpers.MEME_NEW_BUTTON_ID) {
                        await this.handleMemeNewButton(interaction);
                    }
                }
                // Lidar com modais
                else if (interaction.isModalSubmit()) {
                    if (interaction.customId === 'formulario_reportar_bug') {
                        await this.handleReportarBugModal(interaction);
                    } else if (interaction.customId === 'formulario_sugerir') {
                        await this.handleSugerirModal(interaction);
                    } else if (interaction.customId.startsWith('ticket_close_modal_')) {
                        await this.handleTicketCloseModal(interaction);
                    } else if (interaction.customId === 'product_review_modal') {
                        await this.handleProductReviewModal(interaction);
                    }
                }
            } catch (error) {
                console.error('[DISCORD] Erro ao processar interação:', error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ 
                        content: 'Ocorreu um erro ao processar sua solicitação.', 
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ 
                        content: 'Ocorreu um erro ao processar sua solicitação.', 
                        ephemeral: true 
                    });
                }
            }
        });
    }

    async openSupportTicket(guild, user, options = {}) {
        const {
            category = 'General Support',
            panelName = ticketHelpers.TICKET_PANEL_NAME,
            initialMessage = null,
            categoryLabel = null,
            channelPrefix = 'ticket',
            extraDescription = null,
            paymentLink = null,
        } = options;

        const channelName = ticketHelpers.getTicketChannelName(user, channelPrefix);
        const existingChannel = guild.channels.cache.find(
            (channel) => channel.name === channelName && channel.type === ChannelType.GuildText
        );
        if (existingChannel) {
            return { channel: existingChannel, created: false };
        }

        const ticketChannel = await ticketHelpers.createTicketChannel(
            guild,
            this.client.user.id,
            user.id,
            channelName
        );

        const welcomeEmbed = ticketHelpers.buildTicketWelcomeEmbed({
            user,
            panelName,
            category: categoryLabel || category,
            extraDescription: extraDescription || undefined,
        });

        if (initialMessage) {
            welcomeEmbed.addFields({
                name: 'Initial message',
                value: initialMessage.substring(0, 1024),
                inline: false,
            });
        }

        const ticketButtonsRow = ticketHelpers.buildTicketActionRow(ticketChannel.id, user.id);
        const mentionText = `${user} ${ticketHelpers.buildStaffMention()}`;

        const components = [ticketButtonsRow];
        if (paymentLink && paymentLink.startsWith('http')) {
            components.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Pay with Revolut')
                        .setStyle(ButtonStyle.Link)
                        .setURL(paymentLink)
                        .setEmoji('💳')
                )
            );
        }

        const welcomeMsg = await ticketChannel.send({
            content: mentionText,
            embeds: [welcomeEmbed],
            components,
        });

        await welcomeMsg.pin().catch(() => {});

        this.ticketMeta.set(ticketChannel.id, {
            ownerId: user.id,
            openedAt: new Date(),
            claimedBy: null,
            panelName,
            category: categoryLabel || category,
            welcomeMessageId: welcomeMsg.id,
        });

        return { channel: ticketChannel, created: true };
    }

    async handleProductBuySelect(interaction) {
        try {
            const guild = interaction.guild;
            const user = interaction.user;
            const option = interaction.values[0];

            if (!guild) {
                return await interaction.reply({ content: 'This can only be used in a server.', ephemeral: true });
            }

            const channelName = productConfig.getProductChannelName(user);
            const existingChannel = guild.channels.cache.find(
                (ch) => ch.name === channelName && ch.type === ChannelType.GuildText
            );

            if (existingChannel) {
                return await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Ticket already open')
                            .setDescription(`You already have an open ticket: ${existingChannel}`)
                            .setColor(0xffa500)
                            .setTimestamp(),
                    ],
                    ephemeral: true,
                });
            }

            await interaction.deferReply({ ephemeral: true });

            const isPurchase = option === 'purchase';
            const { channel: ticketChannel } = await this.openSupportTicket(guild, user, {
                channelPrefix: productConfig.PRODUCT.slug,
                panelName: isPurchase ? 'Ticket Created' : 'Support & Help',
                category: option,
                categoryLabel: isPurchase ? 'Purchase' : 'Help',
                extraDescription: isPurchase
                    ? productConfig.buildPurchaseWelcome(user)
                    : productConfig.buildHelpWelcome(),
                paymentLink: isPurchase ? productConfig.PRODUCT.paymentUrl : null,
            });

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Ticket created')
                        .setDescription(
                            `Your ticket is ready: ${ticketChannel}\n\n` +
                            (isPurchase
                                ? 'Follow the payment instructions in the ticket channel and send proof when done.'
                                : 'Describe your issue in the ticket channel — staff will assist you shortly.')
                        )
                        .setColor(0x57f287)
                        .setTimestamp(),
                ],
            });
        } catch (error) {
            console.error('[DISCORD] product buy select error:', error);
            const msg = { content: 'An error occurred while creating your ticket.', ephemeral: true };
            if (interaction.deferred) await interaction.editReply(msg).catch(() => {});
            else await interaction.reply(msg).catch(() => {});
        }
    }

    async handleProductReviewStart(interaction) {
        try {
            if (!productConfig.memberCanReview(interaction.member)) {
                const roles = productConfig.PRODUCT.reviewerRoleIds.map((id) => `<@&${id}>`).join(', ');
                return await interaction.reply({
                    content: `Only customers with access to **${productConfig.PRODUCT.name}** can leave a review.\nRequired role(s): ${roles}`,
                    ephemeral: true,
                });
            }

            const modal = new ModalBuilder()
                .setCustomId('product_review_modal')
                .setTitle(`${productConfig.PRODUCT.name} Review`);

            const ratingInput = new TextInputBuilder()
                .setCustomId('product_review_rating')
                .setLabel('Rating (1-5)')
                .setPlaceholder('e.g. 5')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(1);

            const textInput = new TextInputBuilder()
                .setCustomId('product_review_text')
                .setLabel('Your review')
                .setPlaceholder('Tell us about your experience with the product...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMinLength(10)
                .setMaxLength(1500);

            modal.addComponents(
                new ActionRowBuilder().addComponents(ratingInput),
                new ActionRowBuilder().addComponents(textInput)
            );

            await interaction.showModal(modal);
        } catch (error) {
            console.error('[DISCORD] product review start error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Could not open the review form.', ephemeral: true }).catch(() => {});
            }
        }
    }

    async handleProductReviewModal(interaction) {
        try {
            if (!productConfig.memberCanReview(interaction.member)) {
                return await interaction.reply({
                    content: 'You no longer have permission to submit a product review.',
                    ephemeral: true,
                });
            }

            await interaction.deferReply({ ephemeral: true });

            const ratingRaw = interaction.fields.getTextInputValue('product_review_rating').trim();
            const reviewText = interaction.fields.getTextInputValue('product_review_text').trim();
            let rating = parseInt(ratingRaw, 10);
            if (Number.isNaN(rating) || rating < 1 || rating > 5) {
                return await interaction.editReply({ content: 'Rating must be a number from 1 to 5.' });
            }

            const productName = productConfig.PRODUCT.name;
            const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

            const reviewEmbed = new EmbedBuilder()
                .setTitle(`${productName} Review`)
                .setDescription(reviewText)
                .setColor(rating >= 4 ? 0x57f287 : rating >= 3 ? 0xfee75c : 0xed4245)
                .addFields({ name: 'Rating', value: `${stars} (${rating}/5)`, inline: false })
                .setAuthor({
                    name: interaction.user.displayName || interaction.user.username,
                    iconURL: interaction.user.displayAvatarURL(),
                })
                .setTimestamp()
                .setFooter({ text: `${productName} • Customer Review` });

            const reviewChannel = interaction.channel;
            await reviewChannel.send({ embeds: [reviewEmbed] });

            try {
                const connection = await mysql.createConnection(this.dbConfig);
                const [users] = await connection.execute(
                    'SELECT ReferenciaID FROM utilizadores WHERE discord_id = ?',
                    [interaction.user.id]
                );
                const referenciaID = users[0]?.ReferenciaID || null;
                await connection.execute(
                    `INSERT INTO reviews (ReferenciaID, discord_user_id, discord_username, discord_avatar_url, Tipo, Texto, Rating, discord_channel_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        referenciaID,
                        interaction.user.id,
                        interaction.user.username,
                        interaction.user.displayAvatarURL(),
                        productConfig.PRODUCT.slug,
                        reviewText,
                        rating,
                        reviewChannel.id,
                    ]
                );
                await connection.end();
            } catch (dbErr) {
                console.warn('[DISCORD] product review DB save skipped:', dbErr.message);
            }

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Review submitted')
                        .setDescription(`Thank you for reviewing **${productName}**!`)
                        .setColor(0x57f287)
                        .setTimestamp(),
                ],
            });
        } catch (error) {
            console.error('[DISCORD] product review modal error:', error);
            await interaction.editReply({ content: 'An error occurred while submitting your review.' }).catch(() => {});
        }
    }

    async handleTicketButton(interaction) {
        try {
            const guild = interaction.guild;
            const userId = interaction.user.id;

            if (!guild) {
                return await interaction.reply({
                    content: 'This button can only be used inside a server.',
                    ephemeral: true,
                });
            }

            const channelName = ticketHelpers.getTicketChannelName(interaction.user);
            const existingChannel = guild.channels.cache.find(
                (channel) => channel.name === channelName && channel.type === ChannelType.GuildText
            );

            if (existingChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Ticket already open')
                    .setDescription(`You already have an open ticket: ${existingChannel}`)
                    .setColor(0xffa500)
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            const { channel: ticketChannel } = await this.openSupportTicket(guild, interaction.user, {
                category: 'General Support',
            });

            const successEmbed = new EmbedBuilder()
                .setTitle('Ticket created')
                .setDescription(`Your ticket is ready: ${ticketChannel}\n\nA staff member will assist you shortly.`)
                .setColor(0x00ff00)
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('[DISCORD] Error processing ticket button:', error);
            const payload = { content: 'An error occurred while creating your ticket. Please try again.', ephemeral: true };
            if (interaction.deferred) {
                await interaction.editReply(payload).catch(() => {});
            } else if (!interaction.replied) {
                await interaction.reply(payload).catch(() => {});
            }
        }
    }

    async handleReviewButton(interaction) {
        try {
            const userId = interaction.user.id;

            // Criar embed inicial (mesmo do comando review)
            const initialEmbed = new EmbedBuilder()
                .setTitle('Sistema de Avaliações')
                .setDescription('Escolha o que deseja avaliar:')
                .setColor(0xffa500)
                .setTimestamp()
                .setFooter({ text: 'PromoPing - Avaliações' });

            // Criar menu de seleção para escolher o que avaliar
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`review_tipo_${userId}`)
                .setPlaceholder('Selecione o que deseja avaliar...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Site')
                        .setDescription('Avaliar o site PromoPing')
                        .setValue(`site_${userId}`),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Bot')
                        .setDescription('Avaliar o bot Discord')
                        .setValue(`bot_${userId}`),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Suporte')
                        .setDescription('Avaliar o atendimento de suporte')
                        .setValue(`suporte_${userId}`)
                );

            const row = new ActionRowBuilder()
                .addComponents(selectMenu);

            // Responder à interação
            await interaction.reply({
                embeds: [initialEmbed],
                components: [row],
                ephemeral: true
            });

        } catch (error) {
            console.error('[DISCORD] Erro ao processar botão de review:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    content: 'Ocorreu um erro ao processar sua solicitação.', 
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: 'Ocorreu um erro ao processar sua solicitação.', 
                    ephemeral: true 
                });
            }
        }
    }

    async handleReviewTypeSelection(interaction) {
        try {
            const userId = interaction.user.id;
            const selectedValue = interaction.values[0];
            const parts = selectedValue.split('_');
            const tipo = parts[0]; // site, bot, ou suporte
            
            // Verificar se é o usuário correto
            if (userId !== parts[1]) {
                if (!interaction.replied && !interaction.deferred) {
                    return await interaction.reply({ 
                        content: 'Esta interação não é para você!', 
                        ephemeral: true 
                    }).catch(() => {});
                }
                return;
            }
            
            const tipoNomes = {
                'site': 'Site',
                'bot': 'Bot',
                'suporte': 'Suporte'
            };

            // Perguntar se quer ser anónimo
            const anonimoEmbed = new EmbedBuilder()
                .setTitle('Anonimato')
                .setDescription(`Você está avaliando: **${tipoNomes[tipo]}**\n\nDeseja que sua avaliação seja anónima?`)
                .setColor(0x5865F2)
                .setTimestamp();

            const anonimoRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`review_anonimo_sim_${tipo}_${userId}`)
                        .setLabel('Sim, Anónimo')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`review_anonimo_nao_${tipo}_${userId}`)
                        .setLabel('Não, Mostrar Nome')
                        .setStyle(ButtonStyle.Secondary)
                );

            // Responder à interação primeiro para evitar expiração
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    embeds: [anonimoEmbed],
                    components: [anonimoRow],
                    ephemeral: true
                }).catch(() => {});
            } else {
                await interaction.update({
                    embeds: [anonimoEmbed],
                    components: [anonimoRow]
                }).catch(async (err) => {
                    // Se update falhar, tentar reply
                    if (err.code === 10062 || err.code === 40060) {
                        try {
                            await interaction.reply({
                                embeds: [anonimoEmbed],
                                components: [anonimoRow],
                                ephemeral: true
                            }).catch(() => {});
                        } catch {}
                    }
                });
            }

            // Configurar collector para escolha de anonimato
            // Nota: O collector deve ser criado no canal, mas a interação do botão precisa ser respondida imediatamente
            const anonimoFilter = (btnInteraction) => {
                return btnInteraction.user.id === userId && 
                       (btnInteraction.customId.startsWith(`review_anonimo_sim_${tipo}_${userId}`) ||
                        btnInteraction.customId.startsWith(`review_anonimo_nao_${tipo}_${userId}`));
            };

            const anonimoCollector = interaction.channel.createMessageComponentCollector({
                filter: anonimoFilter,
                time: 60000,
                max: 1
            });

            anonimoCollector.on('collect', async (btnInteraction) => {
                try {
                    // Deferir a interação primeiro para evitar expiração
                    if (!btnInteraction.replied && !btnInteraction.deferred) {
                        await btnInteraction.deferUpdate().catch(() => {});
                    }
                    
                    const isAnonimo = btnInteraction.customId.includes('anonimo_sim');
                    
                    // Continuar fluxo usando a lógica do comando review
                    await this.handleReviewAnonimoChoice(btnInteraction, tipo, tipoNomes[tipo], isAnonimo);

                } catch (error) {
                    console.error('[DISCORD] Erro ao processar escolha de anonimato:', error);
                    // Verificar se já foi respondido antes de tentar responder
                    if (!btnInteraction.replied && !btnInteraction.deferred) {
                        await btnInteraction.reply({ 
                            content: 'Erro ao processar sua escolha. Tente novamente.', 
                            ephemeral: true 
                        }).catch(() => {});
                    } else if (btnInteraction.deferred) {
                        await btnInteraction.followUp({ 
                            content: 'Erro ao processar sua escolha. Tente novamente.', 
                            ephemeral: true 
                        }).catch(() => {});
                    }
                }
            });

            anonimoCollector.on('end', (collected) => {
                if (collected.size === 0) {
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle('Tempo Esgotado')
                        .setDescription('Você não escolheu se deseja ser anónimo a tempo. Use `!review` novamente para começar.')
                        .setColor(0xff0000)
                        .setTimestamp();
                    
                    interaction.channel.send({ embeds: [timeoutEmbed] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('[DISCORD] Erro ao processar seleção de tipo de review:', error);
            // Verificar se já foi respondido antes de tentar responder
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'Erro ao processar sua seleção. Tente novamente.', 
                    ephemeral: true 
                }).catch(() => {});
            }
        }
    }

    async handleReviewAnonimoChoice(interaction, tipo, tipoNome, isAnonimo) {
        try {
            const userId = interaction.user.id;
            const userName = interaction.user.username;
            const userAvatar = interaction.user.displayAvatarURL({ dynamic: true });

            // Perguntar pela avaliação e rating
            const avaliacaoEmbed = new EmbedBuilder()
                .setTitle('Avaliação')
                .setDescription(
                    `**Avaliando:** ${tipoNome}\n**Anónimo:** ${isAnonimo ? 'Sim' : 'Não'}\n\n` +
                    `**Por favor, envie sua avaliação:**\n• Use o comando \`!review-texto <sua avaliação>\`\n` +
                    `• Ou responda a esta mensagem com sua avaliação\n\n` +
                    `**Exemplo:** \`!review-texto Excelente serviço! Muito útil.\``
                )
                .addFields({
                    name: 'Dica',
                    value: 'Você também pode incluir uma nota de 1 a 5 estrelas usando: `!review-texto 5 Estrelas Excelente!`',
                    inline: false
                })
                .setColor(0x00ff00)
                .setTimestamp();

            // Responder à interação primeiro para evitar expiração
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    embeds: [avaliacaoEmbed],
                    components: [],
                    ephemeral: true
                }).catch(() => {});
            } else {
                await interaction.update({
                    embeds: [avaliacaoEmbed],
                    components: []
                }).catch(async (err) => {
                    // Se update falhar, tentar reply
                    if (err.code === 10062 || err.code === 40060) {
                        try {
                            await interaction.reply({
                                embeds: [avaliacaoEmbed],
                                components: [],
                                ephemeral: true
                            }).catch(() => {});
                        } catch {}
                    }
                });
            }

            // Aguardar resposta do utilizador
            const textoFilter = (msg) => {
                if (msg.author.id !== userId) return false;
                
                // Verificar se é comando review-texto
                if (msg.content.startsWith('!review-texto ')) return true;
                
                // Verificar se é resposta à mensagem
                if (msg.reference) {
                    const referencedMsgId = msg.reference.messageId;
                    if (referencedMsgId === interaction.message?.id) {
                        return true;
                    }
                }
                
                return false;
            };

            const textoCollector = interaction.channel.createMessageCollector({
                filter: textoFilter,
                time: 300000, // 5 minutos
                max: 1
            });

            textoCollector.on('collect', async (reviewMessage) => {
                try {
                    // Extrair texto da avaliação
                    let reviewText = reviewMessage.content;
                    if (reviewText.startsWith('!review-texto ')) {
                        reviewText = reviewText.replace('!review-texto ', '');
                    }

                    // Extrair rating (estrelas) se houver
                    let rating = null;
                    const starMatch = reviewText.match(/(\d+)\s*[⭐🌟]/);
                    if (starMatch) {
                        rating = parseInt(starMatch[1]);
                        rating = Math.max(1, Math.min(5, rating)); // Limitar entre 1-5
                        reviewText = reviewText.replace(/(\d+)\s*[⭐🌟]/, '').trim();
                    }

                    // Criar embed final da review
                    const reviewEmbed = new EmbedBuilder()
                        .setTitle(`Avaliação - ${tipoNome}`)
                        .setDescription(reviewText || '*Sem texto*')
                        .setColor(rating ? (rating >= 4 ? 0x00ff00 : rating >= 3 ? 0xffa500 : 0xff0000) : 0x5865F2)
                        .setTimestamp()
                        .setFooter({ text: 'PromoPing - Avaliações' });

                    if (rating) {
                        const stars = '*'.repeat(rating) + '-'.repeat(5 - rating);
                        reviewEmbed.addFields({
                            name: 'Avaliação',
                            value: `${stars} (${rating}/5)`,
                            inline: false
                        });
                    }

                    if (isAnonimo) {
                        reviewEmbed.setAuthor({ 
                            name: 'Avaliação Anónima'
                        });
                    } else {
                        reviewEmbed.setAuthor({
                            name: userName,
                            iconURL: userAvatar
                        });
                    }

                    // Encontrar canal de reviews
                    const reviewsChannelId = process.env.DISCORD_REVIEWS_CHANNEL_ID || null;
                    let reviewsChannel = null;

                    if (reviewsChannelId) {
                        reviewsChannel = await this.client.channels.fetch(reviewsChannelId).catch(() => null);
                    }

                    // Se não encontrar pelo ID, procurar por nome
                    if (!reviewsChannel) {
                        reviewsChannel = interaction.guild.channels.cache.find(
                            channel => channel.name === 'reviews' && channel.type === 0
                        );
                    }

                    // Salvar avaliação no banco de dados
                    let savedReviewId = null;
                    let discordMessageId = null;
                    let discordChannelId = null;

                    // Flag para evitar inserção duplicada (por usuário e tipo)
                    if (!this._savingReviews) {
                        this._savingReviews = new Set();
                    }
                    const reviewKey = `${userId}_${tipo}`;
                    if (this._savingReviews.has(reviewKey)) {
                        return;
                    }
                    this._savingReviews.add(reviewKey);

                    try {
                        const connection = await mysql.createConnection(this.dbConfig);
                        
                        // Buscar ReferenciaID do usuário pelo discord_id
                        const [users] = await connection.execute(
                            'SELECT ReferenciaID, Nome, Email FROM utilizadores WHERE discord_id = ?',
                            [userId]
                        );

                        if (users.length === 0) {
                            await connection.end();
                            this._savingReviews.delete(reviewKey);
                            await reviewMessage.reply('❌ Você precisa estar registado no sistema. Use `/registar` primeiro.');
                            return;
                        }

                        const userInfo = users[0];
                        const referenciaID = userInfo.ReferenciaID;

                        // Verificar se já existe uma review recente (últimos 5 minutos) do mesmo usuário e tipo
                        const [existingReviews] = await connection.execute(
                            "SELECT Id FROM reviews WHERE ReferenciaID = ? AND Tipo = ? AND CreatedAt > NOW() - INTERVAL '5 minutes'",
                            [referenciaID, tipo]
                        );

                        if (existingReviews.length > 0) {
                            await connection.end();
                            this._savingReviews.delete(reviewKey);
                            await reviewMessage.reply('⏱️ Você já enviou uma avaliação recentemente. Aguarde alguns minutos.');
                            return;
                        }

                        // Enviar mensagem para o canal de reviews primeiro para obter o message ID
                        let sentMessage = null;
                        if (reviewsChannel) {
                            sentMessage = await reviewsChannel.send({ embeds: [reviewEmbed] });
                            discordMessageId = sentMessage.id;
                            discordChannelId = reviewsChannel.id;
                        } else {
                            sentMessage = await interaction.channel.send({ embeds: [reviewEmbed] });
                            discordMessageId = sentMessage.id;
                            discordChannelId = interaction.channel.id;
                        }

                        // Salvar no banco de dados usando apenas as colunas existentes
                        const [result] = await connection.execute(`
                            INSERT INTO reviews (
                                ReferenciaID,
                                discord_user_id,
                                discord_username,
                                discord_avatar_url,
                                Tipo,
                                Texto,
                                Rating,
                                IsAnonimo,
                                discord_channel_id,
                                discord_message_id
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            referenciaID,
                            userId,
                            userName || interaction.user.username,
                            userAvatar || interaction.user.displayAvatarURL(),
                            tipo,
                            reviewText || '',
                            rating,
                            isAnonimo ? 1 : 0,
                            discordChannelId,
                            discordMessageId
                        ]);

                        savedReviewId = result.insertId;
                        await connection.end();
                        this._savingReviews.delete(reviewKey);
                        console.log(`[DISCORD] Avaliação salva no banco de dados (ID: ${savedReviewId})`);
                    } catch (dbError) {
                        this._savingReviews.delete(reviewKey);
                        console.error('[DISCORD] Erro ao salvar avaliação no banco:', dbError);
                        // Continuar mesmo se falhar ao salvar no banco
                    }
                    
                    // Deletar mensagem do utilizador
                    try {
                        await reviewMessage.delete().catch(() => {});
                    } catch {}
                    
                    // Enviar confirmação via DM (mensagem privada) para o utilizador
                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('Avaliação Enviada!')
                        .setDescription(reviewsChannel ? `Sua avaliação foi enviada para ${reviewsChannel}` : 'Sua avaliação foi enviada!')
                        .setColor(0x00ff00)
                        .setTimestamp();
                    
                    try {
                        await interaction.user.send({ embeds: [confirmEmbed] });
                    } catch (dmError) {
                        // Se não conseguir enviar DM, enviar no canal mas deletar após alguns segundos
                        const confirmMsg = await interaction.channel.send({ 
                            content: `${interaction.user} - Sua avaliação foi enviada!`,
                            embeds: [confirmEmbed]
                        }).catch(() => null);
                        
                        // Deletar mensagem de confirmação após 5 segundos
                        if (confirmMsg) {
                            setTimeout(async () => {
                                try {
                                    await confirmMsg.delete().catch(() => {});
                                } catch {}
                            }, 5000);
                        }
                    }

                } catch (error) {
                    console.error('[DISCORD] Erro ao processar avaliação:', error);
                    await reviewMessage.reply('Erro ao processar sua avaliação. Tente novamente.');
                }
            });

            textoCollector.on('end', (collected) => {
                if (collected.size === 0) {
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle('Tempo Esgotado')
                        .setDescription('Você não enviou sua avaliação a tempo. Use `!review` novamente para começar.')
                        .setColor(0xff0000)
                        .setTimestamp();
                    
                    interaction.channel.send({ embeds: [timeoutEmbed] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('[DISCORD] Erro ao processar escolha de anonimato:', error);
            // Verificar se já foi respondido antes de tentar responder
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'Erro ao processar sua escolha. Tente novamente.', 
                    ephemeral: true 
                }).catch(() => {});
            }
        }
    }

    async handleTicketCategory(interaction, categoria, categoriaCode) {
        try {
            const userId = interaction.user.id;

            // Mostrar confirmação
            const confirmEmbed = new EmbedBuilder()
                .setTitle('Confirmar Criação do Ticket')
                .setDescription(`**Categoria selecionada:** ${categoria}\n\nClique em **Confirmar** para criar o ticket.`)
                .setColor(0x00ff00)
                .setTimestamp();

            const confirmRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_confirmar_${userId}_${categoriaCode}`)
                        .setLabel('Confirmar')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`ticket_cancelar_${userId}`)
                        .setLabel('Cancelar')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.update({ 
                embeds: [confirmEmbed], 
                components: [confirmRow] 
            });

        } catch (error) {
            console.error('[DISCORD] Erro ao processar categoria de ticket:', error);
            await interaction.reply({ 
                content: 'Ocorreu um erro ao processar sua seleção.', 
                ephemeral: true 
            });
        }
    }

    async handleTicketConfirm(interaction, categoriaCode) {
        try {
            const guild = interaction.guild;
            const userId = interaction.user.id;

            // Verificar se é o usuário correto
            if (!interaction.customId.includes(userId)) {
                return await interaction.reply({ 
                    content: 'Esta interação não é para você!', 
                    ephemeral: true 
                });
            }

            // Mapear código para nome da categoria
            const categoriaNomes = {
                'notificacoes': 'Problema com Notificações',
                'duvida': 'Dúvida sobre o Bot',
                'login': 'Erro ao Fazer Login',
                'produtos': 'Problema com Produtos',
                'outros': 'Outros'
            };
            const categoriaNome = categoriaNomes[categoriaCode] || 'Other';

            await interaction.deferUpdate().catch(() => {});

            const channelName = ticketHelpers.getTicketChannelName(interaction.user);
            const existingChannel = guild.channels.cache.find(
                (channel) => channel.name === channelName && channel.type === ChannelType.GuildText
            );

            if (existingChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Ticket already open')
                    .setDescription(`You already have an open ticket: ${existingChannel}`)
                    .setColor(0xffa500)
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
            }

            const { channel: ticketChannel } = await this.openSupportTicket(guild, interaction.user, {
                category: categoriaCode,
                categoryLabel: categoriaNome,
            });

            const successEmbed = new EmbedBuilder()
                .setTitle('Ticket created')
                .setDescription(`Your ticket is ready: ${ticketChannel}\n\n**Category:** ${categoriaNome}`)
                .setColor(0x00ff00)
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed], components: [] }).catch(() => {});

        } catch (error) {
            console.error('[DISCORD] Error creating ticket:', error);
            await interaction.editReply({
                content: '**Error creating ticket.** Please try again in a few minutes.',
                components: [],
            }).catch(() => {});
        }
    }

    async handleDirectMessageTicket(message, ticketMessage = null) {
        try {
            const userId = message.author.id;
            // Se ticketMessage foi fornecido (via comando), usar ele. Caso contrário, usar o conteúdo da mensagem
            const userMessage = ticketMessage || (message.content ? message.content.trim() : '');

            // Função auxiliar para responder mensagens (trata interações deferidas)
            const safeReply = async (content) => {
                // Se for uma interação deferida, usar editReply
                if (message.interaction && message.interaction.deferred) {
                    if (typeof content === 'string') {
                        return await message.interaction.editReply({ content });
                    } else {
                        return await message.interaction.editReply(content);
                    }
                }
                // Caso contrário, usar reply normal
                return await message.reply(content);
            };

            // Ignorar mensagens vazias ou muito curtas
            if (!userMessage || userMessage.length < 3) {
                const embed = new EmbedBuilder()
                    .setTitle('Message too short')
                    .setDescription('Please provide more detail about your issue.\n\n**Example:** `!support I need help with notifications`')
                    .setColor(0xff0000)
                    .setTimestamp();
                return await safeReply({ embeds: [embed] });
            }

            // Obter o servidor principal
            const guildId = process.env.DISCORD_GUILD_ID;
            let guild = null;

            if (guildId) {
                guild = this.client.guilds.cache.get(guildId);
            } else {
                // Se não houver guild ID configurado, usar o primeiro servidor disponível
                guild = this.client.guilds.cache.first();
            }

            if (!guild) {
                const embed = new EmbedBuilder()
                    .setTitle('Server not found')
                    .setDescription('Could not find the server to create your ticket. Please contact an administrator.')
                    .setColor(0xff0000)
                    .setTimestamp();
                return await safeReply({ embeds: [embed] });
            }

            // Verificar se o usuário está no servidor
            let member = null;
            try {
                member = await guild.members.fetch(userId);
            } catch (error) {
                const embed = new EmbedBuilder()
                    .setTitle('Not in server')
                    .setDescription('You must be in the PromoPing Discord server to open a ticket. Please join the server first.')
                    .setColor(0xff0000)
                    .setTimestamp();
                return await safeReply({ embeds: [embed] });
            }

            const channelName = ticketHelpers.getTicketChannelName(message.author);
            const existingChannel = guild.channels.cache.find(
                (channel) => channel.name === channelName && channel.type === ChannelType.GuildText
            );

            if (existingChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Ticket already open')
                    .setDescription(`You already have an open ticket.\n\nGo to: ${existingChannel}\n\nYour message was forwarded to the existing ticket.`)
                    .setColor(0xffa500)
                    .setTimestamp();

                const ticketMessageEmbed = new EmbedBuilder()
                    .setTitle('New message from user (DM)')
                    .setDescription(userMessage)
                    .setAuthor({
                        name: message.author.tag,
                        iconURL: message.author.displayAvatarURL(),
                    })
                    .setColor(0x5865F2)
                    .setTimestamp();

                await existingChannel.send({ embeds: [ticketMessageEmbed] });
                return await safeReply({ embeds: [embed] });
            }

            const { channel: ticketChannel } = await this.openSupportTicket(guild, message.author, {
                category: 'dm',
                categoryLabel: 'Direct Message',
                initialMessage: userMessage,
            });

            const successEmbed = new EmbedBuilder()
                .setTitle('Ticket created')
                .setDescription(`Your ticket was created on the server.\n\n**Channel:** ${ticketChannel}\n\nOur support team has been notified and will respond shortly.`)
                .addFields({
                    name: 'Your message',
                    value: userMessage,
                    inline: false,
                })
                .setColor(0x00ff00)
                .setTimestamp()
                .setFooter({ text: 'PromoPing Support' });

            await safeReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('[DISCORD] Error creating ticket via DM:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('Error creating ticket')
                .setDescription('Something went wrong while creating your ticket. Please try again in a few minutes or contact an administrator.')
                .setColor(0xff0000)
                .setTimestamp();
            
            // Tentar responder com safeReply, se falhar tentar diretamente com a interação
            try {
                if (message.interaction && message.interaction.deferred) {
                    await message.interaction.editReply({ embeds: [errorEmbed] });
                } else if (message.interaction) {
                    await message.interaction.followUp({ embeds: [errorEmbed] });
                } else {
                    await message.reply({ embeds: [errorEmbed] });
                }
            } catch (replyError) {
                console.error('[DISCORD] Erro ao responder com erro:', replyError);
            }
        }
    }

    async handleTicketCancel(interaction) {
        try {
            const userId = interaction.user.id;

            // Verificar se é o usuário correto
            if (!interaction.customId.includes(userId)) {
                return await interaction.reply({ 
                    content: 'Esta interação não é para você!', 
                    ephemeral: true 
                });
            }

            const cancelEmbed = new EmbedBuilder()
                .setTitle('Ticket Cancelado')
                .setDescription('A criação do ticket foi cancelada.')
                .setColor(0xff0000)
                .setTimestamp();

            await interaction.update({ 
                embeds: [cancelEmbed], 
                components: [] 
            });

        } catch (error) {
            console.error('[DISCORD] Erro ao cancelar ticket:', error);
            await interaction.reply({ 
                content: 'Ocorreu um erro ao cancelar.', 
                ephemeral: true 
            });
        }
    }

    async handleFecharTicketButton(interaction) {
        try {
            const guild = interaction.guild;
            const userId = interaction.user.id;

            if (!guild) {
                return await interaction.reply({
                    content: 'This can only be used inside a server.',
                    ephemeral: true,
                });
            }

            const channel = interaction.channel;
            if (!channel || !ticketHelpers.isTicketChannel(channel)) {
                return await interaction.reply({
                    content: 'This action can only be used in a ticket channel.',
                    ephemeral: true,
                });
            }

            const parts = interaction.customId.split('_');
            const channelId = parts[2];
            const ticketOwnerId = parts[3];

            const isTicketOwner = userId === ticketOwnerId;
            const isAdmin = this.isAdmin(interaction.member);
            const hasSupportRole = ticketConfig.memberHasStaffRole(interaction.member);

            if (!isTicketOwner && !isAdmin && !hasSupportRole) {
                return await interaction.reply({
                    content: 'Only the ticket owner, administrators, or support staff can close tickets.',
                    ephemeral: true,
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`ticket_close_modal_${channelId}_${ticketOwnerId}`)
                .setTitle('Close ticket');

            const reasonInput = new TextInputBuilder()
                .setCustomId('close_reason')
                .setLabel('Reason for closing')
                .setPlaceholder('e.g. Issue resolved.')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(500);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
        } catch (error) {
            console.error('[DISCORD] Error opening close ticket modal:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while processing your request.',
                    ephemeral: true,
                }).catch(() => {});
            }
        }
    }

    async handleTicketCloseModal(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const userId = interaction.user.id;
            const parts = interaction.customId.split('_');
            const channelId = parts[3];
            const ticketOwnerId = parts[4];
            const reason = interaction.fields.getTextInputValue('close_reason').trim();

            const channel = guild.channels.cache.get(channelId)
                || await guild.channels.fetch(channelId).catch(() => null);

            if (!channel || !ticketHelpers.isTicketChannel(channel)) {
                return await interaction.editReply({ content: 'Ticket channel not found.' });
            }

            const isTicketOwner = userId === ticketOwnerId;
            const isAdmin = this.isAdmin(interaction.member);
            const hasSupportRole = ticketConfig.memberHasStaffRole(interaction.member);

            if (!isTicketOwner && !isAdmin && !hasSupportRole) {
                return await interaction.editReply({ content: 'You do not have permission to close this ticket.' });
            }

            await this.finalizeTicketClose(channel, interaction.user, reason);
            await interaction.editReply({ content: 'Ticket closed. The channel will be deleted shortly.' });
        } catch (error) {
            console.error('Error closing ticket via modal:', error);
            await interaction.editReply({ content: 'An error occurred while closing the ticket.' }).catch(() => {});
        }
    }

    async finalizeTicketClose(channel, closedByUser, reason) {
        const guild = channel.guild;
        const meta = this.ticketMeta.get(channel.id) || {
            ownerId: channel.topic?.replace('promoping-ticket:', '') || null,
            openedAt: channel.createdAt || new Date(),
            panelName: ticketHelpers.TICKET_PANEL_NAME,
            category: 'General Support',
        };

        const ticketCategory = channel.parent;
        const closedAt = new Date();

        const closeEmbed = new EmbedBuilder()
            .setTitle('Ticket closed')
            .setDescription(`This ticket was closed by ${closedByUser}`)
            .addFields(
                { name: 'Reason', value: reason || 'No reason provided', inline: false },
                { name: 'Notice', value: 'This channel will be deleted in **10 seconds**.', inline: false }
            )
            .setColor(0xff0000)
            .setTimestamp()
            .setFooter({ text: 'PromoPing Support' });

        await channel.send({ embeds: [closeEmbed] }).catch(() => {});

        if (meta.ownerId) {
            try {
                const owner = await this.client.users.fetch(meta.ownerId);
                const dmEmbed = ticketHelpers.buildTicketClosedDmEmbed({
                    guildName: guild.name,
                    openedAt: meta.openedAt,
                    panelName: meta.panelName,
                    channelName: channel.name,
                    closedBy: `${closedByUser}`,
                    closedAt,
                    reason,
                });
                await owner.send({ embeds: [dmEmbed] }).catch(() => {});
            } catch (error) {
                console.warn('Could not DM ticket owner on close:', error.message);
            }
        }

        this.ticketMeta.delete(channel.id);

        setTimeout(async () => {
            try {
                await channel.delete();

                if (ticketCategory && ticketCategory.type === ChannelType.GuildCategory) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    const category = guild.channels.cache.get(ticketCategory.id);
                    if (category) {
                        const channelsInCategory = category.children.cache.filter(
                            (ch) => ch.type !== ChannelType.GuildCategory
                        );
                        if (channelsInCategory.size === 0) {
                            await category.delete().catch(() => {});
                        }
                    }
                }
            } catch (error) {
                console.error('[DISCORD] Error deleting ticket channel:', error);
            }
        }, 10000);
    }

    async handleTicketClaim(interaction) {
        try {
            const guild = interaction.guild;
            const userId = interaction.user.id;
            const parts = interaction.customId.split('_');
            const channelId = parts[2];
            const ticketOwnerId = parts[3];

            if (!ticketConfig.memberHasStaffRole(interaction.member) && !this.isAdmin(interaction.member)) {
                return await interaction.reply({
                    content: 'Only support staff can claim tickets.',
                    ephemeral: true,
                });
            }

            const channel = guild.channels.cache.get(channelId)
                || await guild.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                return await interaction.reply({ content: 'Ticket channel not found.', ephemeral: true });
            }

            const meta = this.ticketMeta.get(channel.id) || {
                ownerId: ticketOwnerId,
                openedAt: channel.createdAt || new Date(),
                claimedBy: null,
                panelName: ticketHelpers.TICKET_PANEL_NAME,
                category: 'General Support',
                welcomeMessageId: null,
            };

            if (meta.claimedBy && meta.claimedBy !== userId) {
                return await interaction.reply({
                    content: 'This ticket is already claimed by another staff member.',
                    ephemeral: true,
                });
            }

            meta.claimedBy = userId;
            this.ticketMeta.set(channel.id, meta);

            if (meta.welcomeMessageId) {
                const welcomeMsg = await channel.messages.fetch(meta.welcomeMessageId).catch(() => null);
                if (welcomeMsg) {
                    const row = ticketHelpers.buildTicketActionRow(channel.id, meta.ownerId, userId);
                    await welcomeMsg.edit({ components: [row] }).catch(() => {});
                }
            }

            await channel.send(`${interaction.user} claimed this ticket.`);

            const claimedEmbed = new EmbedBuilder()
                .setTitle('Claimed')
                .setDescription('You have successfully claimed this ticket.')
                .setColor(0x57f287)
                .setTimestamp()
                .setFooter({ text: 'PromoPing Support' });

            await interaction.reply({ embeds: [claimedEmbed], ephemeral: true });
        } catch (error) {
            console.error('[DISCORD] Error claiming ticket:', error);
            await interaction.reply({ content: 'An error occurred while claiming the ticket.', ephemeral: true }).catch(() => {});
        }
    }

    async handleTicketRelease(interaction) {
        try {
            const guild = interaction.guild;
            const userId = interaction.user.id;
            const parts = interaction.customId.split('_');
            const channelId = parts[2];
            const claimerId = parts[3];

            if (userId !== claimerId && !this.isAdmin(interaction.member)) {
                return await interaction.reply({
                    content: 'Only the staff member who claimed this ticket can release it.',
                    ephemeral: true,
                });
            }

            const channel = guild.channels.cache.get(channelId)
                || await guild.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                return await interaction.reply({ content: 'Ticket channel not found.', ephemeral: true });
            }

            const meta = this.ticketMeta.get(channel.id);
            if (!meta) {
                return await interaction.reply({ content: 'Ticket metadata not found.', ephemeral: true });
            }

            meta.claimedBy = null;
            this.ticketMeta.set(channel.id, meta);

            if (meta.welcomeMessageId) {
                const welcomeMsg = await channel.messages.fetch(meta.welcomeMessageId).catch(() => null);
                if (welcomeMsg) {
                    const row = ticketHelpers.buildTicketActionRow(channel.id, meta.ownerId, null);
                    await welcomeMsg.edit({ components: [row] }).catch(() => {});
                }
            }

            await channel.send(`${interaction.user} released this ticket.`);

            const releasedEmbed = new EmbedBuilder()
                .setTitle('Released')
                .setDescription('You have released this ticket. It is available for other staff members.')
                .setColor(0x5865f2)
                .setTimestamp()
                .setFooter({ text: 'PromoPing Support' });

            await interaction.reply({ embeds: [releasedEmbed], ephemeral: true });
        } catch (error) {
            console.error('[DISCORD] Error releasing ticket:', error);
            await interaction.reply({ content: 'An error occurred while releasing the ticket.', ephemeral: true }).catch(() => {});
        }
    }

    async handleAceitarRegras(interaction) {
        try {
            const roleId = process.env.DISCORD_VERIFICATION_ROLE_ID;
            if (!roleId) {
                return await interaction.reply({
                    content: 'Verification role is not configured.',
                    ephemeral: true,
                });
            }

            // Checar se está em um guild e o membro ainda existe
            const guild = interaction.guild;
            if (!guild) {
                return await interaction.reply({ content: '❌ Não consegui identificar o servidor.', ephemeral: true });
            }
            
            const member = await guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) {
                return await interaction.reply({ content: '❌ Não consegui encontrar você neste servidor.', ephemeral: true });
            }

            // Verifica se o usuário já tem o cargo
            if (member.roles.cache.has(roleId)) {
                return await interaction.reply({ content: 'You already have the verification role.', ephemeral: true });
            }

            await member.roles.add(roleId, 'Accepted PromoPing community rules');
            await interaction.reply({ content: 'You have been verified and granted access to the server.', ephemeral: true });

        } catch (error) {
            console.error('[DISCORD] Erro ao adicionar cargo de verificação:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: '❌ Ocorreu um erro ao te dar o cargo. Por favor, contate a staff.', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Ocorreu um erro ao te dar o cargo. Por favor, contate a staff.', ephemeral: true });
            }
        }
    }

    async handleChamarModerador(interaction) {
        try {
            const guild = interaction.guild;
            const userId = interaction.user.id;

            if (!guild) {
                return await interaction.reply({ 
                    content: 'Este comando só pode ser usado em um servidor!', 
                    ephemeral: true 
                });
            }

            // Extrair informações do customId: ticket_chamar_mod_channelId_userId
            const parts = interaction.customId.split('_');
            const channelId = parts[3];
            const ticketOwnerId = parts[4];

            // Verificar se é o dono do ticket
            if (userId !== ticketOwnerId) {
                return await interaction.reply({ 
                    content: '❌ Apenas o criador do ticket pode chamar um moderador!', 
                    ephemeral: true 
                });
            }

            const channel = guild.channels.cache.get(channelId);
            if (!channel) {
                return await interaction.reply({ 
                    content: '❌ Canal não encontrado!', 
                    ephemeral: true 
                });
            }

            // Verificar anti-spam: 1 chamada a cada 10 minutos por canal
            const now = Date.now();
            const lastCall = this.lastModeratorCall.get(channelId);
            const cooldownTime = 10 * 60 * 1000; // 10 minutos em milissegundos

            if (lastCall && (now - lastCall) < cooldownTime) {
                const timeRemaining = Math.ceil((cooldownTime - (now - lastCall)) / 1000 / 60); // minutos restantes
                const secondsRemaining = Math.ceil((cooldownTime - (now - lastCall)) / 1000 % 60);
                
                const spamEmbed = new EmbedBuilder()
                    .setTitle('Aguarde')
                    .setDescription(`Você já chamou um moderador recentemente.`)
                    .addFields({
                        name: 'Tempo restante',
                        value: `Aguarde **${timeRemaining} minuto(s) e ${secondsRemaining} segundo(s)** antes de chamar novamente.`,
                        inline: false
                    })
                    .setColor(0xffa500)
                    .setTimestamp();

                return await interaction.reply({ 
                    embeds: [spamEmbed],
                    ephemeral: true 
                });
            }

            // ID do role de suporte
            const supportRoleId = '1442655668904398980';
            const supportRole = guild.roles.cache.get(supportRoleId);

            if (!supportRole) {
                return await interaction.reply({ 
                    content: '❌ Role de suporte não encontrado!', 
                    ephemeral: true 
                });
            }

            // Buscar membros com o role de suporte que estão online ou com status "não perturbe"
            // Primeiro, buscar todos os membros do role
            const allSupportMembers = supportRole.members.filter(member => !member.user.bot);
            
            // Filtrar apenas os que estão online ou em "não perturbe"
            const supportMembers = new Map();
            let onlineCount = 0;
            let dndCount = 0;
            let offlineCount = 0;
            
            for (const [memberId, member] of allSupportMembers) {
                // Buscar presença atualizada do membro
                // Tentar buscar do cache primeiro, depois fazer fetch se necessário
                let presence = member.presence;
                
                // Se não tiver presença no cache, tentar buscar do guild
                if (!presence) {
                    try {
                        const guildMember = await guild.members.fetch(memberId);
                        presence = guildMember.presence;
                    } catch (error) {
                        // Se não conseguir buscar, considerar offline
                        presence = null;
                    }
                }
                
                const status = presence?.status || 'offline';
                
                if (status === 'online' || status === 'dnd') {
                    supportMembers.set(memberId, member);
                    if (status === 'online') onlineCount++;
                    if (status === 'dnd') dndCount++;
                } else {
                    offlineCount++;
                }
            }

            if (supportMembers.size === 0) {
                const noModEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Nenhum Moderador Disponível')
                    .setDescription('Nenhum moderador está online ou com status "não perturbe" no momento.')
                    .addFields({
                        name: 'Status dos Moderadores',
                        value: `• Online: ${onlineCount}\n• Não Perturbe: ${dndCount}\n• Offline/Ausente: ${offlineCount}`,
                        inline: false
                    })
                    .setColor(0xffa500)
                    .setTimestamp();
                
                return await interaction.reply({ 
                    embeds: [noModEmbed],
                    ephemeral: true 
                });
            }

            // Criar embed de notificação
            const notificationEmbed = new EmbedBuilder()
                .setTitle('Moderador Solicitado')
                .setDescription(`Um moderador foi solicitado no ticket **${channel.name}**`)
                .addFields(
                    { name: 'Canal', value: `${channel}`, inline: true },
                    { name: 'Solicitado por', value: `${interaction.user}`, inline: true },
                    { name: 'Link do Canal', value: `[Clique aqui para acessar](${channel.url})`, inline: false }
                )
                .setColor(0x5865F2)
                .setTimestamp()
                .setFooter({ text: 'PromoPing - Sistema de Tickets' });

            // Enviar mensagem privada para cada membro do suporte
            let sentCount = 0;
            for (const [memberId, member] of supportMembers) {
                try {
                    await member.send({ embeds: [notificationEmbed] });
                    sentCount++;
                } catch (error) {
                    // Se não conseguir enviar (DMs desabilitadas, etc), apenas continua
                    console.error(`[DISCORD] Erro ao enviar DM para ${member.user.tag}:`, error.message);
                }
            }

            // Atualizar timestamp do anti-spam
            this.lastModeratorCall.set(channelId, now);

            // Confirmar no canal do ticket
            const confirmEmbed = new EmbedBuilder()
                .setTitle('Moderador Notificado')
                .setDescription(`Os moderadores disponíveis foram notificados sobre este ticket.`)
                .addFields(
                    { name: 'Notificações Enviadas', value: `**${sentCount}** moderador(es)`, inline: true },
                    { name: 'Status', value: `Online: ${onlineCount} | Não Perturbe: ${dndCount}`, inline: true }
                )
                .setColor(0x00ff00)
                .setTimestamp();

            await interaction.reply({ 
                embeds: [confirmEmbed],
                ephemeral: false 
            });

            // Mencionar o role no canal
            await channel.send(`<@&${supportRoleId}> - Um moderador foi solicitado neste ticket.`);

        } catch (error) {
            console.error('[DISCORD] Erro ao chamar moderador:', error);
            await interaction.reply({ 
                content: 'Ocorreu um erro ao chamar o moderador.', 
                ephemeral: true 
            });
        }
    }

    /**
     * Botão "Fechar ticket" nos tickets do widget (categoria Tickets, canal ticket-XX).
     * Apaga a thread na base de dados e apaga o canal do Discord (o ticket desaparece).
     */
    async handleSupportTicketFechar(interaction) {
        try {
            const guild = interaction.guild;
            if (!guild) {
                return await interaction.reply({ content: 'Este botão só pode ser usado em um servidor.', ephemeral: true });
            }
            const supportRoleId = process.env.DISCORD_SUPPORT_ROLE_ID || ticketConfig.PRIMARY_SUPPORT_ROLE_ID;
            const isSupport = ticketConfig.memberHasStaffRole(interaction.member);
            const isAdmin = this.isAdmin(interaction.member);
            if (!isSupport && !isAdmin) {
                return await interaction.reply({
                    content: 'Only support staff or administrators can close this ticket.',
                    ephemeral: true
                });
            }
            const threadId = interaction.customId.replace(/^support_ticket_fechar_/, '');
            if (!threadId) {
                return await interaction.reply({ content: 'Thread inválida.', ephemeral: true });
            }
            const backendUrl = process.env.BACKEND_URL || process.env.API_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
            const secret = process.env.SUPPORT_DISCORD_INTERNAL_SECRET;
            if (!secret) {
                return await interaction.reply({
                    content: 'SUPPORT_DISCORD_INTERNAL_SECRET não configurado no servidor.',
                    ephemeral: true
                });
            }
            await interaction.deferReply({ ephemeral: true });
            const url = new URL(`${backendUrl}/api/support/internal/threads/${threadId}/close`);
            const lib = url.protocol === 'https:' ? https : http;
            const body = JSON.stringify({ closedByDiscordId: interaction.user.id });
            const res = await new Promise((resolve, reject) => {
                const req = lib.request({
                    hostname: url.hostname,
                    port: url.port || (url.protocol === 'https:' ? 443 : 80),
                    path: url.pathname,
                    method: 'POST',
                    headers: {
                        'X-Internal-Secret': secret,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    }
                }, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, data }));
                });
                req.on('error', reject);
                req.write(body);
                req.end();
            });
            if (!res.ok) {
                return await interaction.editReply({
                    content: 'Não foi possível apagar a thread na base de dados (' + res.statusCode + ').'
                });
            }
            await interaction.editReply({ content: 'Ticket e thread apagados.' });
            await interaction.channel.delete().catch((err) => {
                console.warn('[DISCORD] Não foi possível apagar o canal do ticket:', err.message);
            });
        } catch (error) {
            console.error('[DISCORD] Erro ao fechar ticket (widget):', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Ocorreu um erro ao fechar o ticket.', ephemeral: true }).catch(() => {});
            } else if (interaction.deferred) {
                await interaction.editReply({ content: 'Ocorreu um erro ao fechar o ticket.' }).catch(() => {});
            }
        }
    }

    /**
     * Botão "Chamar supporter" nos tickets do widget. Menciona o role de suporte no canal.
     */
    async handleSupportTicketChamar(interaction) {
        try {
            const guild = interaction.guild;
            if (!guild) {
                return await interaction.reply({ content: 'Este botão só pode ser usado em um servidor.', ephemeral: true });
            }
            const supportRoleId = process.env.DISCORD_SUPPORT_ROLE_ID || '1442655668904398980';
            const threadId = interaction.customId.replace(/^support_ticket_chamar_/, '') || '?';
            await interaction.reply({
                content: 'Supporter chamado.',
                ephemeral: true
            });
            await interaction.channel.send({
                content: `<@&${supportRoleId}> Pedido de atenção no ticket #${threadId} (widget).`
            }).catch(() => {});
        } catch (error) {
            console.error('[DISCORD] Erro ao chamar supporter (widget):', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Ocorreu um erro.', ephemeral: true }).catch(() => {});
            }
        }
    }

    async handleFecharTicketConfirm(interaction) {
        try {
            const guild = interaction.guild;
            if (!guild) {
                return await interaction.reply({ content: 'This can only be used inside a server.', ephemeral: true });
            }

            let channel = interaction.channel;
            if (!channel) {
                const parts = interaction.customId.split('_');
                const channelId = parts[3];
                channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
            }

            if (!channel || !ticketHelpers.isTicketChannel(channel)) {
                return await interaction.update({ content: 'Ticket channel not found.', embeds: [], components: [] });
            }

            await this.finalizeTicketClose(channel, interaction.user, 'Closed via confirmation button');
            await interaction.update({ content: 'Ticket closed. The channel will be deleted in 10 seconds.', embeds: [], components: [] });
        } catch (error) {
            console.error('[DISCORD] Error confirming ticket close:', error);
            await interaction.update({ content: 'An error occurred while closing the ticket.', embeds: [], components: [] }).catch(() => {});
        }
    }

    async connect() {
        try {
            // Verificar se o token existe
            if (!process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN === 'SEU_TOKEN_AQUI') {
                throw new Error('DISCORD_BOT_TOKEN não configurado no arquivo .env');
            }

            // Tentar conectar com timeout
            const loginPromise = this.client.login(process.env.DISCORD_BOT_TOKEN);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout na conexão com Discord (60s)')), 60000);
            });

            await Promise.race([loginPromise, timeoutPromise]);
            console.log('[DISCORD] Conexão estabelecida com sucesso');
        } catch (error) {
            console.error('[DISCORD] Falha ao conectar ao Discord:', error.message);
            
            // Tentar reconectar automaticamente
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5); // Max 25 segundos
                console.log(`[DISCORD] Tentando reconectar em ${delay/1000} segundos... (tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                
                setTimeout(() => {
                    this.connect().catch(err => {
                        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                            console.error('[DISCORD] Número máximo de tentativas de reconexão atingido. Parando...');
                            throw err;
                        }
                    });
                }, delay);
            } else {
                throw error;
            }
        }
    }

    async disconnect() {
        try {
            if (this.activityInterval) {
                clearInterval(this.activityInterval);
                this.activityInterval = null;
            }
            if (this.client) {
                await this.client.destroy();
                console.log('[DISCORD] Bot desconectado');
            }
        } catch (error) {
            console.error('[DISCORD] Erro ao desconectar:', error);
        }
    }

    async startMonitoring() {
        // Mantido por compatibilidade: alertas de preço são processados pelo backend.
        this.isMonitoring = false;
        console.log('[DISCORD] startMonitoring() ignorado — alertas de preço via backend/alerts.js');
    }

    async startTwitchMonitoring() {
        // Verificar lives da Twitch a cada 5 minutos
        this.twitchCheckInterval = setInterval(async () => {
            try {
                await this.checkTwitchLives();
            } catch (error) {
                console.error('[DISCORD] Erro ao verificar lives da Twitch:', error);
            }
        }, 5 * 60 * 1000); // 5 minutos

        // Verificar imediatamente ao iniciar
        await this.checkTwitchLives();
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    isRetryableFetchError(error) {
        const code = error?.cause?.code || error?.code;
        return code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ECONNRESET' || code === 'ETIMEDOUT';
    }

    async fetchWithRetry(url, options = {}, config = {}) {
        const {
            timeoutMs = 20000,
            retries = 2,
            retryDelayMs = 1500,
            label = 'requisição externa'
        } = config;

        let lastError;

        for (let attempt = 1; attempt <= retries + 1; attempt++) {
            try {
                return await fetch(url, {
                    ...options,
                    signal: AbortSignal.timeout(timeoutMs)
                });
            } catch (error) {
                lastError = error;
                const shouldRetry = attempt <= retries && this.isRetryableFetchError(error);

                if (!shouldRetry) {
                    throw error;
                }

                console.warn(
                    `[DISCORD] Falha temporária em ${label} (tentativa ${attempt}/${retries + 1}): ${error?.cause?.code || error.message}`
                );
                await this.sleep(retryDelayMs * attempt);
            }
        }

        throw lastError;
    }

    async getTwitchAccessToken() {
        const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
        const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

        if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
            return null;
        }

        const now = Date.now();
        if (this.twitchAccessToken && this.twitchTokenExpiresAt > now + 60000) {
            return this.twitchAccessToken;
        }

        const tokenResponse = await this.fetchWithRetry('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                grant_type: 'client_credentials'
            })
        }, {
            timeoutMs: 20000,
            retries: 2,
            retryDelayMs: 2000,
            label: 'autenticação Twitch'
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`Erro ao obter token da Twitch: ${tokenResponse.status} - ${errorText}`);
        }

        const tokenData = await tokenResponse.json();
        this.twitchAccessToken = tokenData.access_token;
        this.twitchTokenExpiresAt = now + ((tokenData.expires_in || 3600) * 1000);

        return this.twitchAccessToken;
    }

    async startNewsMonitoring() {
        try {
            // Carregar newsService dinamicamente (ES module)
            const newsServiceModule = await import('../services/newsService.js');
            this.newsService = newsServiceModule.default;
            
            // Verificar notícias a cada 60 minutos (ou conforme configurado)
            this.newsCheckInterval = setInterval(async () => {
                try {
                    await this.checkNews();
                } catch (error) {
                    console.error('[DISCORD] Erro ao verificar notícias:', error);
                }
            }, 60 * 60 * 1000); // 60 minutos

            // Verificar imediatamente ao iniciar (com delay para não sobrecarregar)
            setTimeout(async () => {
                await this.checkNews();
            }, 2 * 60 * 1000); // Aguardar 2 minutos após iniciar
        } catch (error) {
            console.error('[DISCORD] Erro ao carregar newsService:', error);
        }
    }

    async startYoutubeFeedMonitoring() {
        if (!this.youtubeFeedService) {
            return;
        }

        const intervalMinutes = parseInt(process.env.YOUTUBE_FEED_CHECK_INTERVAL || '10', 10);

        if (this.youtubeCheckInterval) {
            clearInterval(this.youtubeCheckInterval);
        }

        this.youtubeCheckInterval = setInterval(async () => {
            try {
                await this.youtubeFeedService.checkyt();
                this.lastYoutubeCheck = new Date();
            } catch (error) {
                console.error('[DISCORD] Erro ao verificar feeds do YouTube:', error.message);
            }
        }, Math.max(intervalMinutes, 1) * 60 * 1000);

        setTimeout(async () => {
            try {
                await this.youtubeFeedService.checkyt();
                this.lastYoutubeCheck = new Date();
            } catch (error) {
                console.error('[DISCORD] Erro na primeira verificação do YouTube:', error.message);
            }
        }, 15000);
    }

    async checkNews() {
        if (!this.newsService) {
            console.error('[DISCORD] newsService não carregado');
            return;
        }
        try {
            console.log('[DISCORD] Verificando notícias impactantes...');
            
            const news = await this.newsService.fetchNews();
            
            if (news.length === 0) {
                console.log('[DISCORD] Nenhuma notícia impactante encontrada');
                return;
            }

            // Buscar configuração do canal de notícias
            const connection = await mysql.createConnection(this.dbConfig);
            const [configs] = await connection.execute(
                "SELECT * FROM news_config WHERE IsActive = 1 LIMIT 1"
            );

            if (configs.length === 0) {
                console.log('[DISCORD] Sistema de notícias não configurado');
                return;
            }

            const config = configs[0];
            const channelId = config.ChannelId || config.channelid || process.env.DISCORD_NEWS_CHANNEL_ID;
            if (!channelId) {
                console.error('[DISCORD] Canal de notícias não configurado (news_config ou DISCORD_NEWS_CHANNEL_ID)');
                await connection.end();
                return;
            }
            const channel = await this.client.channels.fetch(channelId).catch(() => null);
            
            if (!channel) {
                console.error(`[DISCORD] Canal de notícias não encontrado! (${channelId})`);
                await connection.end();
                return;
            }

            // Enviar cada notícia impactante
            for (const article of news) {
                if (!article || (article.title == null && article.url == null)) continue;
                // Verificar se já foi enviada
                const alreadySent = await this.newsService.isNewsAlreadySent(article.url);
                if (alreadySent) {
                    console.log(`[DISCORD] Notícia já enviada: ${(article.title || '').substring(0, 50)}...`);
                    continue;
                }

                // Enviar notícia
                await this.sendNewsNotification(channel, article);
                
                // Marcar como enviada
                await this.newsService.markNewsAsSent(article);
                
                // Aguardar 2 segundos entre notícias para evitar spam
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            await connection.end();
            this.lastNewsCheck = new Date();
            console.log(`[DISCORD] ${news.length} notícia(s) impactante(s) processada(s)`);

        } catch (error) {
            console.error('[DISCORD] Erro ao verificar notícias:', error);
        }
    }

    async sendNewsNotification(discordChannel, article) {
        try {
            if (!article) return;
            const title = article.title != null ? String(article.title) : 'Sem título';
            const url = article.url || '';
            const description = article.description != null ? String(article.description) : 'Sem descrição disponível';
            const category = article.category != null ? String(article.category) : 'Geral';
            const source = article.source != null ? String(article.source) : 'Fonte';
            const impactScore = article.impactScore != null ? Number(article.impactScore) : 0;
            const publishedAt = article.publishedAt ? new Date(article.publishedAt) : new Date();

            // Determinar cor baseada no score de impacto
            let color = 0x5865F2; // Azul padrão
            if (impactScore >= 9) {
                color = 0xff0000; // Vermelho para muito impactante
            } else if (impactScore >= 8) {
                color = 0xff9900; // Laranja para impactante
            } else {
                color = 0x5865F2; // Azul para moderado
            }

            const embed = new EmbedBuilder()
                .setTitle(`📰 ${title}`)
                .setDescription(description)
                .addFields(
                    { name: 'Categoria', value: category, inline: true },
                    { name: 'Impacto', value: `${impactScore}/10`, inline: true },
                    { name: 'Fonte', value: source, inline: true }
                )
                .setURL(url)
                .setColor(color)
                .setTimestamp(publishedAt)
                .setFooter({ text: 'PromoPing - Notícias Automáticas' });

            if (article.image) {
                embed.setImage(article.image);
            }

            await discordChannel.send({ embeds: [embed] });
            console.log(`[DISCORD] Notícia enviada: ${title.substring(0, 50)}...`);

        } catch (error) {
            console.error('[DISCORD] Erro ao enviar notificação de notícia:', error);
        }
    }

    async startMemeMonitoring() {
        try {
            const memeServiceModule = await import('../services/memeService.js');
            this.memeService = memeServiceModule.default;

            this.memeCheckInterval = setInterval(async () => {
                try {
                    await this.checkMemes();
                } catch (error) {
                    console.error('[DISCORD] Erro ao verificar memes:', error);
                }
            }, 15 * 60 * 1000);

            setTimeout(async () => {
                await this.checkMemes();
            }, 5 * 60 * 1000);
        } catch (error) {
            console.error('[DISCORD] Erro ao carregar memeService:', error);
        }
    }

    async ensureMemeConfigFromEnv(connection) {
        const [configs] = await connection.execute(
            'SELECT * FROM meme_config WHERE IsActive = 1 LIMIT 1'
        );
        if (configs.length) return configs[0];

        const envChannel = process.env.DISCORD_MEMES_CHANNEL_ID;
        if (!envChannel) return null;

        const interval = parseInt(process.env.MEME_CHECK_INTERVAL_MINUTES || '180', 10);
        const maxAge = parseInt(process.env.MEME_MAX_AGE_DAYS || '30', 10);
        await connection.execute(
            'INSERT INTO meme_config (ChannelId, CheckInterval, MaxAgeDays, IsActive) VALUES (?, ?, ?, 1)',
            [envChannel, interval, maxAge]
        );
        const [created] = await connection.execute(
            'SELECT * FROM meme_config WHERE IsActive = 1 LIMIT 1'
        );
        return created[0] || null;
    }

    async ensureMemeService() {
        if (this.memeService) return this.memeService;
        const memeServiceModule = await import('../services/memeService.js');
        this.memeService = memeServiceModule.default;
        return this.memeService;
    }

    async fetchUniqueMeme(options = {}) {
        const service = await this.ensureMemeService();
        if (!service?.hasApiKey?.()) return null;

        let maxAgeDays = options.maxAgeDays ?? 30;
        if (!options.maxAgeDays && !options.force) {
            try {
                const connection = await mysql.createConnection(this.dbConfig);
                const config = await this.ensureMemeConfigFromEnv(connection);
                maxAgeDays = config?.MaxAgeDays || config?.maxagedays || 30;
                await connection.end();
            } catch {
                maxAgeDays = parseInt(process.env.MEME_MAX_AGE_DAYS || '30', 10);
            }
        }

        const skipDedup = Boolean(options.skipDedup || options.force);
        let fallback = null;

        for (let attempt = 0; attempt < 8; attempt++) {
            const candidate = await service.fetchRandomMeme({ maxAgeDays });
            if (!candidate?.url) break;

            if (skipDedup) {
                fallback = candidate;
                const seen = await service.isMemeAlreadySent(candidate.url);
                if (!seen) return candidate;
                continue;
            }

            if (!(await service.isMemeAlreadySent(candidate.url))) {
                return candidate;
            }
        }

        return skipDedup ? fallback : null;
    }

    async postRandomMeme(channelId, options = {}) {
        const channel = await this.client.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased?.()) {
            return false;
        }

        const meme = await this.fetchUniqueMeme(options);
        if (!meme?.url) return false;

        await this.sendMemeNotification(channel, meme);
        const service = await this.ensureMemeService();
        await service.markMemeAsSent(meme);
        return true;
    }

    async checkMemes() {
        if (!this.memeService) return;

        try {
            const connection = await mysql.createConnection(this.dbConfig);
            const config = await this.ensureMemeConfigFromEnv(connection);

            if (!config) {
                await connection.end();
                return;
            }

            const channelId = config.ChannelId || config.channelid || process.env.DISCORD_MEMES_CHANNEL_ID;
            const intervalMinutes = config.CheckInterval || config.checkinterval || 180;
            const lastCheck = config.LastCheck || config.lastcheck;

            if (lastCheck && !Number.isNaN(new Date(lastCheck).getTime())) {
                const elapsedMs = Date.now() - new Date(lastCheck).getTime();
                if (elapsedMs < intervalMinutes * 60 * 1000) {
                    await connection.end();
                    return;
                }
            }

            const posted = await this.postRandomMeme(channelId, {
                maxAgeDays: config.MaxAgeDays || config.maxagedays || 30,
            });

            if (posted) {
                const configId = config.Id || config.id;
                await connection.execute(
                    'UPDATE meme_config SET LastCheck = NOW(), UpdatedAt = NOW() WHERE Id = ?',
                    [configId]
                );
                this.lastMemeCheck = new Date();
                console.log('[DISCORD] Meme aleatório publicado no canal de memes');
            }

            await connection.end();
        } catch (error) {
            console.error('[DISCORD] Erro ao verificar memes:', error);
        }
    }

    async sendMemeNotification(discordChannel, meme) {
        try {
            if (!meme?.url) return null;
            const payload = memeHelpers.buildMemeMessage(meme);
            return await discordChannel.send(payload);
        } catch (error) {
            console.error('[DISCORD] Erro ao enviar meme:', error);
            return null;
        }
    }

    async handleMemeNewButton(interaction) {
        const lastClick = this.memeButtonCooldown.get(interaction.user.id) || 0;
        if (Date.now() - lastClick < 12000) {
            return interaction.reply({
                content: 'Wait a few seconds before requesting another meme.',
                ephemeral: true,
            });
        }
        this.memeButtonCooldown.set(interaction.user.id, Date.now());

        await interaction.deferUpdate();

        const meme = await this.fetchUniqueMeme({ skipDedup: true });
        if (!meme?.url) {
            return interaction.followUp({
                content: 'Could not load a meme right now. Check `API_LEAGUE_API_KEY` in .env.',
                ephemeral: true,
            });
        }

        const service = await this.ensureMemeService();
        await service.markMemeAsSent(meme);
        await interaction.message.edit(memeHelpers.buildMemeMessage(meme));
    }

    async handleMemeSlashCommand(interaction) {
        await interaction.deferReply();

        const meme = await this.fetchUniqueMeme({ skipDedup: true });
        if (!meme?.url) {
            return interaction.editReply({
                content: 'Could not load a meme. Make sure `API_LEAGUE_API_KEY` is set.',
                embeds: [],
                components: [],
            });
        }

        const service = await this.ensureMemeService();
        await service.markMemeAsSent(meme);
        await interaction.editReply(memeHelpers.buildMemeMessage(meme));
    }

    async checkTwitchLives() {
        let connection;
        try {
            connection = await mysql.createConnection(this.dbConfig);
            // Selecionar apenas colunas que existem (TwitchUserId pode não existir)
            const [channels] = await connection.execute(
                'SELECT ChannelName, IsLive FROM twitch_channels'
            );

            if (channels.length === 0) {
                return;
            }

            const SOCIAL_FEED_CHANNEL_ID = '1442931610927366284';
            const channel = await this.client.channels.fetch(SOCIAL_FEED_CHANNEL_ID).catch(() => null);
            if (!channel) {
                console.error('[DISCORD] Canal social-feed não encontrado!');
                await connection.end();
                return;
            }

            // API da Twitch - precisa de Client ID e Client Secret
            const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
            const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

            if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
                console.warn('[DISCORD] Twitch Client ID/Secret não configurados. Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET no .env');
                await connection.end();
                return;
            }

            const accessToken = await this.getTwitchAccessToken();

            // Buscar informações dos canais (máximo 100 por requisição)
            // Extrair apenas o nome do canal (remover URLs se houver)
            const extractChannelName = (channelName) => {
                if (!channelName) return null;
                
                // Se for uma URL, extrair o nome do canal
                const urlMatch = channelName.match(/(?:twitch\.tv\/|^)([^\/\s?]+)/i);
                if (urlMatch) {
                    return urlMatch[1].toLowerCase();
                }
                
                // Se já for apenas o nome, retornar em lowercase
                return channelName.toLowerCase().trim();
            };
            
            const channelNames = channels
                .map(c => extractChannelName(c.ChannelName))
                .filter(name => name !== null && name.length > 0);
            
            // Se não houver canais válidos, não fazer requisição
            if (channelNames.length === 0) {
                console.log('[DISCORD] Nenhum nome de canal válido encontrado');
                await connection.end();
                return;
            }
            
            // Construir query params corretamente - múltiplos user_login separados por &
            // API Twitch aceita até 100 user_login por requisição
            // Sanitizar nomes de canais para prevenir SSRF
            const safeChannelNames = channelNames
                .slice(0, 100) // Limitar a 100 canais por requisição
                .filter(name => {
                    // Validar que o nome contém apenas caracteres seguros
                    return name && typeof name === 'string' && /^[a-zA-Z0-9_]{1,25}$/.test(name.trim());
                })
                .map(name => name.trim());
            
            if (safeChannelNames.length === 0) {
                console.log('[DISCORD] Nenhum nome de canal válido após sanitização');
                await connection.end();
                return;
            }
            
            const queryParams = safeChannelNames
                .map(name => `user_login=${encodeURIComponent(name)}`)
                .join('&');
            
            // Validar URL antes de fazer requisição (prevenir SSRF)
            const twitchApiUrl = `https://api.twitch.tv/helix/streams?${queryParams}`;
            try {
                const urlObj = new URL(twitchApiUrl);
                // Garantir que é apenas api.twitch.tv
                if (urlObj.hostname !== 'api.twitch.tv' || urlObj.protocol !== 'https:') {
                    throw new Error('URL inválida');
                }
            } catch (urlError) {
                console.error('[DISCORD] URL da API Twitch inválida:', urlError);
                await connection.end();
                return;
            }
            
            const streamsResponse = await this.fetchWithRetry(twitchApiUrl, {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${accessToken}`
                }
            }, {
                timeoutMs: 20000,
                retries: 2,
                retryDelayMs: 2000,
                label: 'consulta de streams da Twitch'
            });

            if (!streamsResponse.ok) {
                const errorText = await streamsResponse.text();
                console.error(`[DISCORD] Erro ao buscar streams da Twitch: ${streamsResponse.status} - ${errorText}`);
                if (streamsResponse.status === 401) {
                    this.twitchAccessToken = null;
                    this.twitchTokenExpiresAt = 0;
                }
                return;
            }

            const streamsData = await streamsResponse.json();
            const liveChannels = new Set((streamsData.data || []).map(s => s.user_login.toLowerCase()));

            // Verificar cada canal e enviar notificação se necessário
            for (const channelData of channels) {
                // Extrair nome do canal (pode ser URL ou nome simples)
                const extractedChannelName = extractChannelName(channelData.ChannelName);
                if (!extractedChannelName) {
                    continue;
                }
                
                const channelName = extractedChannelName;
                const isLive = liveChannels.has(channelName);
                const wasLive = channelData.IsLive;

                // Atualizar status no banco (usar ChannelName original para WHERE)
                await connection.execute(
                    'UPDATE twitch_channels SET IsLive = ?, LastLiveCheck = NOW() WHERE ChannelName = ?',
                    [isLive, channelData.ChannelName]
                );

                // Se ficou ao vivo e não estava antes, enviar notificação
                if (isLive && !wasLive) {
                    // Sempre notificar quando canal fica ao vivo (se estava offline antes)
                    // O controle de spam é feito verificando wasLive no banco
                    const streamInfo = (streamsData.data || []).find(s => s.user_login.toLowerCase() === channelName);
                    await this.sendTwitchLiveNotification(channel, channelName, streamInfo);
                    this.twitchLiveStatus.set(channelName, { isLive: true, lastNotification: new Date() });
                } else if (!isLive && wasLive) {
                    // Canal saiu do ar - limpar status completamente para permitir nova notificação quando voltar
                    this.twitchLiveStatus.delete(channelName);
                }
            }

            this.lastTwitchCheck = new Date();

        } catch (error) {
            if (this.isRetryableFetchError(error)) {
                console.warn(`[DISCORD] Twitch indisponível por timeout/rede. Nova tentativa no próximo ciclo. Detalhe: ${error?.cause?.code || error.message}`);
            } else {
                console.error('[DISCORD] Erro ao verificar lives da Twitch:', error);
            }
        } finally {
            if (connection) {
                await connection.end().catch(() => {});
            }
        }
    }

    async sendTwitchLiveNotification(discordChannel, twitchChannelName, streamData) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🔴 Live na Twitch')
                .setDescription(`**${twitchChannelName}** está ao vivo!`)
                .addFields(
                    { name: 'Canal', value: `[${twitchChannelName}](https://twitch.tv/${twitchChannelName})`, inline: true },
                    { name: 'Status', value: '🔴 AO VIVO', inline: true },
                    { name: 'Título', value: streamData?.title || 'Sem título', inline: false },
                    { name: 'Jogo', value: streamData?.game_name || 'Sem jogo', inline: true },
                    { name: 'Viewers', value: streamData?.viewer_count?.toString() || '0', inline: true }
                )
                .setColor(0x9146ff)
                .setThumbnail(streamData?.thumbnail_url?.replace('{width}', '320').replace('{height}', '180') || null)
                .setTimestamp()
                .setFooter({ text: 'PromoPing - Social Feed' });

            await discordChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[DISCORD] Erro ao enviar notificação de live:', error);
        }
    }

    async checkPriceChanges() {
        try {
            const connection = await mysql.createConnection(this.dbConfig);
            const [rows] = await connection.execute(`
                SELECT p.Id, p.Nome, p.Link, p.PrecoAtual, p.PrecoAlvo, p.ReferenciaID,
                       u.discord_id as DiscordId, hp.Preco as PrecoAnterior, hp.DataRegisto as UpdatedAt
                FROM produtos p
                JOIN utilizadores u ON p.ReferenciaID = u.ReferenciaID
                LEFT JOIN historicoprecos hp ON p.Id = hp.ProdutoId
                WHERE hp.DataRegisto > ?
                AND u.discord_id IS NOT NULL AND u.discord_id != ''
                ORDER BY hp.DataRegisto DESC
            `, [this.lastCheck]);

            // Só loga se houver alterações
            if (rows.length > 0) {
                console.log(`[DISCORD] ${rows.length} alteração(ões) de preço encontrada(s)`);
            }
            
            // Enviar notificações para cada mudança de preço
            for (const product of rows) {
                await this.sendPriceNotification(product);
            }
            
            this.lastCheck = new Date();
            await connection.end();
        } catch (error) {
            // Só loga erros de conexão uma vez a cada 5 minutos para evitar spam
            const now = Date.now();
            if (!this.lastErrorLog || (now - this.lastErrorLog) > 300000) {
                console.error('[DISCORD] Erro ao consultar o banco de dados:', error.code || error.message);
                this.lastErrorLog = now;
            }
        }
    }

    async sendPriceNotification(product) {
        try {
            const precoAnterior = parseFloat(product.PrecoAnterior) || 0;
            const precoAtual = parseFloat(product.PrecoAtual) || 0;

            const { isPlausiblePrice, describePriceRejection } = require('../utils/priceValidation.js');
            if (!isPlausiblePrice(precoAtual, precoAnterior || null)) {
                console.warn(
                    `[DISCORD] Notificação de preço ignorada para produto ${product.Id}: ${describePriceRejection(precoAtual, precoAnterior || null)}`
                );
                return;
            }

            const user = await this.client.users.fetch(product.DiscordId);
            if (!user) {
                // Usuário não encontrado - log silencioso
                return;
            }

            const precoAlvo = parseFloat(product.PrecoAlvo) || 0;

            const priceChange = precoAtual - precoAnterior;
            const percentageChange = precoAnterior > 0 ? ((priceChange / precoAnterior) * 100).toFixed(2) : '0.00';
            
            let color = 0x00ff00; // Verde para diminuição
            let emoji = '';
            let status = 'diminuiu';

            if (priceChange > 0) {
                color = 0xff0000; // Vermelho para aumento
                emoji = '[+]';
                status = 'aumentou';
            }

            // Verificar se atingiu o preço alvo
            if (precoAtual <= precoAlvo) {
                color = 0x00bfff; // Azul para meta atingida
                emoji = '[META]';
                status = 'atingiu o preço alvo';
            }

            const embed = new EmbedBuilder()
                .setTitle(`${emoji} Preço ${status}!`)
                .setDescription(`**${product.Nome}**`)
                .addFields(
                    { name: 'Preço Anterior', value: `€${precoAnterior.toFixed(2)}`, inline: true },
                    { name: 'Preço Atual', value: `€${precoAtual.toFixed(2)}`, inline: true },
                    { name: 'Diferença', value: `€${priceChange.toFixed(2)} (${percentageChange}%)`, inline: true },
                    { name: 'Preço Alvo', value: `€${precoAlvo.toFixed(2)}`, inline: true },
                    { name: 'Loja', value: this.extractStoreName(product.Link), inline: true },
                    { name: 'Data', value: new Date(product.UpdatedAt).toLocaleString('pt-PT'), inline: true }
                )
                .setColor(color)
                .setTimestamp()
                .setFooter({ text: 'PromoPing - Monitor de Preços' });

            if (process.env.PROMOPING_LOGO_URL) {
                embed.setThumbnail(process.env.PROMOPING_LOGO_URL);
            }

            // Criar botões de reação
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`parar_notificacoes_${product.Id}`)
                        .setLabel('Parar Notificações')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`ver_produto_${product.Id}`)
                        .setLabel('Ver Produto')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`configurar_${product.Id}`)
                        .setLabel('Configurar')
                        .setStyle(ButtonStyle.Secondary)
                );

            const message = await user.send({ 
                embeds: [embed], 
                components: [row] 
            });

            // Configurar coletor de interações para os botões
            this.setupButtonCollector(message, product, user);

            // Notificação enviada - log silencioso

        } catch (error) {
            console.error(`[DISCORD] Erro ao enviar notificação para ${product.DiscordId}:`, error);
        }
    }

    setupButtonCollector(message, product, user) {
        const filter = (interaction) => {
            return interaction.user.id === user.id && 
                   (interaction.customId.startsWith(`parar_notificacoes_${product.Id}`) ||
                    interaction.customId.startsWith(`ver_produto_${product.Id}`) ||
                    interaction.customId.startsWith(`configurar_${product.Id}`));
        };

        const collector = message.createMessageComponentCollector({ 
            filter, 
            time: 300000 // 5 minutos
        });

        collector.on('collect', async (interaction) => {
            try {
                if (interaction.customId.startsWith('parar_notificacoes_')) {
                    await this.handleStopNotifications(interaction, product, user);
                } else if (interaction.customId.startsWith('ver_produto_')) {
                    await this.handleViewProduct(interaction, product);
                } else if (interaction.customId.startsWith('configurar_')) {
                    await this.handleConfigure(interaction, product, user);
                }
            } catch (error) {
                console.error('[DISCORD] Erro ao processar interação:', error);
                await interaction.reply({ 
                    content: 'Ocorreu um erro ao processar sua solicitação.', 
                    ephemeral: true 
                });
            }
        });

        collector.on('end', () => {
            // Desabilitar botões após 5 minutos
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`parar_notificacoes_${product.Id}_disabled`)
                        .setLabel('Parar Notificações')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`ver_produto_${product.Id}_disabled`)
                        .setLabel('Ver Produto')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`configurar_${product.Id}_disabled`)
                        .setLabel('Configurar')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

            message.edit({ components: [disabledRow] }).catch(console.error);
        });
    }

    async handleStopNotifications(interaction, product, user) {
        try {
            const connection = await mysql.createConnection(this.dbConfig);
            
            // Desativar notificações para este produto específico
            await connection.execute(
                'UPDATE produtos SET DeletedAt = ? WHERE Id = ? AND ReferenciaID = (SELECT ReferenciaID FROM utilizadores WHERE discord_id = ?)',
                [new Date(), product.Id, user.id]
            );
            
            await connection.end();

            const embed = new EmbedBuilder()
                .setTitle('Notificações Paradas')
                .setDescription(`**${product.Nome}**\n\nVocê não receberá mais notificações sobre este produto.`)
                .addFields({
                    name: 'Como reativar?',
                    value: '• Use `!produtos` para ver seus produtos\n• Reative o produto no website PromoPing\n• Ou use `!ajuda` para mais comandos',
                    inline: false
                })
                .setColor(0xff6b6b)
                .setTimestamp();

            await interaction.reply({ 
                embeds: [embed], 
                ephemeral: true 
            });

            // Notificações paradas - log silencioso

        } catch (error) {
            console.error('[DISCORD] Erro ao parar notificações:', error);
            await interaction.reply({ 
                content: 'Erro ao parar notificações. Tente novamente.', 
                ephemeral: true 
            });
        }
    }

    async handleViewProduct(interaction, product) {
        // Converter valores para números (podem vir como string ou Decimal do MySQL)
        const precoAtual = parseFloat(product.PrecoAtual) || 0;
        const precoAlvo = parseFloat(product.PrecoAlvo) || 0;

        const embed = new EmbedBuilder()
            .setTitle('Detalhes do Produto')
            .setDescription(`**${product.Nome}**`)
            .addFields(
                { name: 'Preço Atual', value: `€${precoAtual.toFixed(2)}`, inline: true },
                { name: 'Preço Alvo', value: `€${precoAlvo.toFixed(2)}`, inline: true },
                { name: 'Loja', value: this.extractStoreName(product.Link), inline: true },
                { name: 'Link', value: `[Abrir Produto](${product.Link})`, inline: false }
            )
            .setColor(0x4ecdc4)
            .setTimestamp();

        await interaction.reply({ 
            embeds: [embed], 
            ephemeral: true 
        });
    }

    async handleConfigure(interaction, product, user) {
        // Converter valores para números (podem vir como string ou Decimal do MySQL)
        const precoAlvo = parseFloat(product.PrecoAlvo) || 0;

        const embed = new EmbedBuilder()
            .setTitle('Configurações do Produto')
            .setDescription(`**${product.Nome}**`)
            .addFields(
                { name: 'Preço Alvo Atual', value: `€${precoAlvo.toFixed(2)}`, inline: true },
                { name: 'Status', value: '🟢 Monitorando', inline: true },
                { name: 'Loja', value: this.extractStoreName(product.Link), inline: true }
            )
            .addFields({
                name: 'Opções Disponíveis',
                value: '• **Parar Notificações**: Clique no botão vermelho\n• **Ver Produto**: Clique no botão azul\n• **Configurar no Website**: Acesse PromoPing.com',
                inline: false
            })
            .setColor(0x95a5a6)
            .setTimestamp();

        await interaction.reply({ 
            embeds: [embed], 
            ephemeral: true 
        });
    }

    extractStoreName(url) {
        try {
            const domain = new URL(url).hostname.toLowerCase();
            if (domain.includes('amazon')) return 'Amazon';
            if (domain.includes('fnac')) return 'Fnac';
            if (domain.includes('worten')) return 'Worten';
            if (domain.includes('elcorteingles')) return 'El Corte Inglés';
            if (domain.includes('continente')) return 'Continente';
            if (domain.includes('pcdiga')) return 'PCDiga';
            if (domain.includes('mediamarkt')) return 'MediaMarkt';
            return 'Loja Online';
        } catch {
            return 'Loja Online';
        }
    }

    async registerSlashCommands() {
        try {
            const normalizeEntryPointCommand = (command) => {
                const preserved = {
                    id: command.id,
                    type: command.type,
                    application_id: command.application_id,
                    name: command.name,
                    description: command.description || ''
                };

                for (const key of [
                    'contexts',
                    'integration_types',
                    'handler',
                    'nsfw',
                    'name_localizations',
                    'description_localizations',
                    'options',
                    'default_member_permissions'
                ]) {
                    if (command[key] !== undefined && command[key] !== null) {
                        preserved[key] = command[key];
                    }
                }

                return preserved;
            };

            const commands = [
                new SlashCommandBuilder()
                    .setName('ping')
                    .setDescription('Verifica se o bot está online'),
                new SlashCommandBuilder()
                    .setName('status')
                    .setDescription('Mostra informações sobre o sistema PromoPing'),
                new SlashCommandBuilder()
                    .setName('ajuda')
                    .setDescription('Mostra a lista de comandos disponíveis'),
                new SlashCommandBuilder()
                    .setName('produtos')
                    .setDescription('Lista seus produtos monitorados'),
                new SlashCommandBuilder()
                    .setName('plano')
                    .setDescription('Mostra o teu plano PromoPing e limites'),
                new SlashCommandBuilder()
                    .setName('adicionar')
                    .setDescription('Adiciona um produto para monitorizar preços')
                    .addStringOption(option =>
                        option.setName('link')
                            .setDescription('Link do produto (http/https)')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('preco')
                            .setDescription('Preço alvo em euros (ex: 29.99)')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('nome')
                            .setDescription('Nome do produto (opcional)')
                            .setRequired(false)),
                new SlashCommandBuilder()
                    .setName('login')
                    .setDescription('Liga a tua conta PromoPing através do site'),
                new SlashCommandBuilder()
                    .setName('registar')
                    .setDescription('Abre o site PromoPing para criar conta'),
                new SlashCommandBuilder()
                    .setName('social-feed')
                    .setDescription('Gerencia notificações de live da Twitch')
                    .addStringOption(option =>
                        option.setName('acao')
                            .setDescription('Ação a realizar')
                            .setRequired(false)
                            .addChoices(
                                { name: 'Listar', value: 'listar' },
                                { name: 'Adicionar', value: 'adicionar' },
                                { name: 'Remover', value: 'remover' },
                                { name: 'Testar', value: 'testar' }
                            ))
                    .addStringOption(option =>
                        option.setName('canal')
                            .setDescription('Nome do canal da Twitch')
                            .setRequired(false)),
                new SlashCommandBuilder()
                    .setName('announcements')
                    .setDescription('Gerencia notificações de releases do GitHub')
                    .addStringOption(option =>
                        option.setName('acao')
                            .setDescription('Ação a realizar')
                            .setRequired(false)
                            .addChoices(
                                { name: 'Status', value: 'status' },
                                { name: 'Configurar', value: 'configurar' },
                                { name: 'Testar', value: 'testar' }
                            ))
                    .addStringOption(option =>
                        option.setName('url')
                            .setDescription('URL do webhook (para configurar)')
                            .setRequired(false)),
                new SlashCommandBuilder()
                    .setName('lock')
                    .setDescription('Tranca o chat, impedindo que membros enviem mensagens'),
                new SlashCommandBuilder()
                    .setName('unlock')
                    .setDescription('Destranca o chat, permitindo que membros enviem mensagens novamente'),
                new SlashCommandBuilder()
                    .setName('clear')
                    .setDescription('Limpa mensagens do chat (1-100 mensagens)')
                    .addIntegerOption(option =>
                        option.setName('quantidade')
                            .setDescription('Número de mensagens para deletar (1-100)')
                            .setRequired(true)
                            .setMinValue(1)
                            .setMaxValue(100)),
                new SlashCommandBuilder()
                    .setName('counting')
                    .setDescription('Gerencia o sistema de contagem')
                    .addStringOption(option =>
                        option.setName('acao')
                            .setDescription('Ação a realizar')
                            .setRequired(false)
                            .addChoices(
                                { name: 'Status', value: 'status' },
                                { name: 'Configurar', value: 'configurar' },
                                { name: 'Reset', value: 'reset' },
                                { name: 'Desativar', value: 'desativar' }
                            ))
                    .addChannelOption(option =>
                        option.setName('canal')
                            .setDescription('Canal para configurar (para configurar)')
                            .setRequired(false)),
                new SlashCommandBuilder()
                    .setName('suporte')
                    .setDescription('Cria um ticket de suporte ou mostra informações')
                    .addStringOption(option =>
                        option.setName('mensagem')
                            .setDescription('Descrição do seu problema ou dúvida')
                            .setRequired(false)),
                new SlashCommandBuilder()
                    .setName('review')
                    .setDescription('Deixa uma avaliação sobre o site, bot ou suporte'),
                new SlashCommandBuilder()
                    .setName('meme')
                    .setDescription('Get a random meme with a button for another one')
            ].map(command => command.toJSON());

            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
            const existingGlobalCommands = await rest.get(
                Routes.applicationCommands(this.client.user.id)
            );
            const preservedEntryPointCommands = Array.isArray(existingGlobalCommands)
                ? existingGlobalCommands
                    .filter(command => command.type === ApplicationCommandType.PrimaryEntryPoint)
                    .map(normalizeEntryPointCommand)
                : [];
            const bulkCommands = [...commands, ...preservedEntryPointCommands];

            // Registrar comandos globalmente
            await rest.put(
                Routes.applicationCommands(this.client.user.id),
                { body: bulkCommands }
            );

            console.log(`[DISCORD] ${commands.length} comandos de barra registrados com sucesso.`);
        } catch (error) {
            console.error('[DISCORD] Erro ao registrar comandos de barra:', error);
        }
    }

    async handleSlashCommand(interaction) {
        try {
            const commandName = interaction.commandName;

            if (commandName === 'meme') {
                await this.handleMemeSlashCommand(interaction);
                return;
            }
            
            // Tratamento especial para comando suporte em DMs
            if (commandName === 'suporte' && !interaction.guild) {
                const mensagem = interaction.options.get('mensagem')?.value;
                
                if (!mensagem || mensagem.trim().length < 3) {
                    const embed = new EmbedBuilder()
                        .setTitle('🎫 Criar Ticket de Suporte')
                        .setDescription(
                            'Para criar um ticket, use o parâmetro `mensagem` com sua dúvida ou problema.\n\n' +
                            '**Exemplo:**\n' +
                            '`/suporte mensagem: Preciso de ajuda com notificações`\n' +
                            '`/suporte mensagem: Tenho um problema ao fazer login`'
                        )
                        .setColor(0x5865F2)
                        .setTimestamp()
                        .setFooter({ text: '©PromoPing • Todos os direitos reservados' });
                    return await interaction.reply({ embeds: [embed], ephemeral: true });
                }

                // Fazer defer da interação para evitar timeout (dá 15 minutos para processar)
                await interaction.deferReply({ ephemeral: false });
                
                // Criar ticket diretamente usando handleDirectMessageTicket
                try {
                    let interactionReplied = false;
                    
                    // Criar uma mensagem simulada para usar com handleDirectMessageTicket
                    const fakeMessage = {
                        author: interaction.user,
                        guild: null,
                        channel: interaction.channel,
                        content: '',
                        interaction: interaction, // Adicionar referência à interação
                        reply: async (content) => {
                            try {
                                // Sempre usar editReply já que fizemos defer
                                if (interactionReplied) {
                                    // Se já respondeu, usar followUp
                                    if (typeof content === 'string') {
                                        return await interaction.followUp({ content, ephemeral: false });
                                    } else {
                                        return await interaction.followUp({ ...content, ephemeral: false });
                                    }
                                } else {
                                    interactionReplied = true;
                                    // Primeira resposta - sempre usar editReply já que fizemos defer
                                    if (typeof content === 'string') {
                                        return await interaction.editReply({ content });
                                    } else {
                                        return await interaction.editReply(content);
                                    }
                                }
                            } catch (error) {
                                // Se editReply falhar (interação expirada), tentar followUp
                                if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
                                    console.error('[DISCORD] Erro ao editar resposta (interação pode ter expirado), tentando followUp:', error);
                                    interactionReplied = true; // Marcar como respondido para evitar tentar novamente
                                    if (typeof content === 'string') {
                                        return await interaction.followUp({ content, ephemeral: false });
                                    } else {
                                        return await interaction.followUp({ ...content, ephemeral: false });
                                    }
                                }
                                // Se não for erro de interação desconhecida, relançar o erro
                                console.error('[DISCORD] Erro inesperado ao responder:', error);
                                throw error;
                            }
                        }
                    };
                    
                    await this.handleDirectMessageTicket(fakeMessage, mensagem);
                    return;
                } catch (error) {
                    console.error('[DISCORD] Erro ao criar ticket via slash command:', error);
                    try {
                        if (interaction.deferred || interaction.replied) {
                            await interaction.editReply({ 
                                content: '❌ Erro ao criar o ticket! Tente novamente em alguns minutos.' 
                            });
                        } else {
                            await interaction.reply({ 
                                content: '❌ Erro ao criar o ticket! Tente novamente em alguns minutos.', 
                                ephemeral: true 
                            });
                        }
                    } catch (replyError) {
                        console.error('[DISCORD] Erro ao responder interação:', replyError);
                    }
                }
            }

            const comandosMap = require('./comandos');

            // Mapear comandos de barra para comandos existentes
            const comandoMap = {
                'ping': 'ping',
                'status': 'status',
                'ajuda': 'ajuda',
                'produtos': 'produtos',
                'plano': 'plano',
                'adicionar': 'adicionar',
                'login': 'login',
                'registar': 'registar',
                'social-feed': 'social-feed',
                'announcements': 'announcements',
                'lock': 'lock',
                'unlock': 'unlock',
                'counting': 'counting',
                'clear': 'clear',
                'suporte': 'suporte',
                'review': 'review'
            };

            const comandoNome = comandoMap[commandName];
            if (!comandoNome) {
                return await interaction.reply({ 
                    content: 'Comando não encontrado!', 
                    ephemeral: true 
                });
            }

            const comando = comandosMap.get(comandoNome);
            if (!comando) {
                return await interaction.reply({ 
                    content: 'Comando não disponível!', 
                    ephemeral: true 
                });
            }

            // Converter opções do slash command para args
            const args = [];
            if (interaction.options) {
                // Para comandos com opções nomeadas, manter a ordem correta
                if (commandName === 'social-feed' || commandName === 'announcements' || commandName === 'counting') {
                    const acao = interaction.options.get('acao')?.value;
                    const canal = interaction.options.get('canal')?.value;
                    const url = interaction.options.get('url')?.value;
                    
                    if (acao) args.push(acao);
                    if (canal) {
                        // Para counting, passar menção do canal
                        args.push(`<#${canal.id}>`);
                    }
                    if (url) args.push(url);
                } else if (commandName === 'adicionar') {
                    const link = interaction.options.get('link')?.value;
                    const preco = interaction.options.get('preco')?.value;
                    const nome = interaction.options.get('nome')?.value;
                    if (link) args.push(link);
                    if (preco) args.push(preco);
                    if (nome) args.push(nome);
                } else if (commandName === 'clear') {
                    // Para clear, passar quantidade
                    const quantidade = interaction.options.get('quantidade')?.value;
                    if (quantidade) args.push(quantidade.toString());
                } else if (commandName === 'suporte') {
                    // Para suporte, passar mensagem se fornecida
                    const mensagem = interaction.options.get('mensagem')?.value;
                    if (mensagem) {
                        // Dividir a mensagem em palavras para simular args
                        args.push(...mensagem.split(' '));
                    }
                } else {
                    // Para outros comandos, manter comportamento original
                    interaction.options.data.forEach(option => {
                        args.push(option.value);
                    });
                }
            }

            // Garantir canal disponível (interaction.channel pode ser null se não estiver em cache)
            let channel = interaction.channel;
            if (!channel && interaction.channelId) {
                try {
                    channel = await interaction.client.channels.fetch(interaction.channelId);
                } catch (err) {
                    console.error('[DISCORD] Erro ao obter canal do slash command:', err);
                }
            }

            // Criar uma mensagem simulada para compatibilidade com comandos existentes
            let replied = false;
            const fakeMessage = {
                author: interaction.user,
                member: interaction.member,
                guild: interaction.guild,
                channel: channel,
                createdTimestamp: Date.now(),
                content: interaction.commandName + (args.length > 0 ? ' ' + args.join(' ') : ''),
                deleted: false,
                reply: async (content) => {
                    if (replied) {
                        if (typeof content === 'string') {
                            return await interaction.followUp({ content, ephemeral: false });
                        } else {
                            return await interaction.followUp({ ...content, ephemeral: false });
                        }
                    } else {
                        replied = true;
                        if (typeof content === 'string') {
                            const response = await interaction.reply({ content, ephemeral: false, fetchReply: true });
                            return {
                                ...response,
                                edit: async (newContent) => {
                                    if (typeof newContent === 'string') {
                                        return await interaction.editReply({ content: newContent });
                                    } else {
                                        return await interaction.editReply(newContent);
                                    }
                                },
                                createdTimestamp: response.createdTimestamp || Date.now()
                            };
                        } else {
                            const response = await interaction.reply({ ...content, ephemeral: false, fetchReply: true });
                            return {
                                ...response,
                                edit: async (newContent) => {
                                    if (typeof newContent === 'string') {
                                        return await interaction.editReply({ content: newContent });
                                    } else {
                                        return await interaction.editReply(newContent);
                                    }
                                },
                                createdTimestamp: response.createdTimestamp || Date.now()
                            };
                        }
                    }
                }
            };

            await comando.execute(this.client, fakeMessage, args, this);

        } catch (error) {
            console.error('[DISCORD] Erro ao processar comando de barra:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    content: 'Ocorreu um erro ao executar este comando.', 
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: 'Ocorreu um erro ao executar este comando.', 
                    ephemeral: true 
                });
            }
        }
    }

    async handleCounting(message) {
        try {
            // Verificar se o canal tem counting configurado
            const connection = await mysql.createConnection(this.dbConfig);
            const [configs] = await connection.execute(
                'SELECT * FROM counting_config WHERE ChannelId = ?',
                [message.channel.id]
            );

            if (configs.length === 0) {
                await connection.end();
                return false; // Não é canal de counting
            }

            const config = configs[0];
            const expectedNumber = config.CurrentNumber + 1;
            const messageNumber = parseInt(message.content.trim());

            // Verificar se a mensagem é um número
            if (isNaN(messageNumber)) {
                await connection.end();
                return false; // Não é número, não processar
            }

            // Verificar se é o número correto
            if (messageNumber === expectedNumber) {
                // Verificar se a mesma pessoa não enviou o número anterior
                if (config.LastUserId === message.author.id) {
                    // Mesma pessoa - erro!
                    await message.react('❌');
                    await message.reply(`❌ Você não pode enviar dois números seguidos! A contagem volta para **0**.`);
                    
                    // Resetar contagem
                    await connection.execute(
                        'UPDATE counting_config SET CurrentNumber = 0, LastUserId = NULL WHERE Id = ?',
                        [config.Id]
                    );
                    
                    await connection.end();
                    return true;
                }

                // Número correto e pessoa diferente - sucesso!
                await message.react('✅');
                
                // Atualizar contagem
                const newNumber = expectedNumber;
                const newHighScore = newNumber > config.HighScore ? newNumber : config.HighScore;
                
                await connection.execute(
                    'UPDATE counting_config SET CurrentNumber = ?, HighScore = ?, LastUserId = ?, LastMessageId = ? WHERE Id = ?',
                    [newNumber, newHighScore, message.author.id, message.id, config.Id]
                );

                // Se bateu recorde, celebrar
                if (newNumber > config.HighScore) {
                    await message.reply(`🎉 **NOVO RECORDE!** Contagem chegou em **${newNumber}**!`);
                }

                await connection.end();
                return true;

            } else {
                // Número errado - resetar
                await message.react('❌');
                await message.reply(`❌ Erro! Era esperado **${expectedNumber}**, mas você enviou **${messageNumber}**. A contagem volta para **0**.`);
                
                await connection.execute(
                    'UPDATE counting_config SET CurrentNumber = 0, LastUserId = NULL WHERE Id = ?',
                    [config.Id]
                );
                
                await connection.end();
                return true;
            }

        } catch (error) {
            console.error('[DISCORD] Erro ao processar counting:', error);
            return false;
        }
    }

    async handleReportarBugButton(interaction) {
        try {
            // Criar modal para reportar bug
            const modal = new ModalBuilder()
                .setCustomId('formulario_reportar_bug')
                .setTitle('Reportar Bug');

            // Campo de título
            const tituloInput = new TextInputBuilder()
                .setCustomId('bug_titulo')
                .setLabel('Título do Bug')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: Botão de login não funciona')
                .setRequired(true)
                .setMaxLength(200)
                .setMinLength(3);

            // Campo de descrição
            const descricaoInput = new TextInputBuilder()
                .setCustomId('bug_descricao')
                .setLabel('Descrição Detalhada')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Descreva o bug em detalhes: o que aconteceu, quando aconteceu, passos para reproduzir, etc.')
                .setRequired(true)
                .setMaxLength(2000)
                .setMinLength(10);

            // Adicionar campos ao modal
            const tituloRow = new ActionRowBuilder().addComponents(tituloInput);
            const descricaoRow = new ActionRowBuilder().addComponents(descricaoInput);

            modal.addComponents(tituloRow, descricaoRow);

            await interaction.showModal(modal);
        } catch (error) {
            console.error('[DISCORD] Erro ao mostrar modal de reportar bug:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'Ocorreu um erro ao abrir o formulário. Tente novamente.', 
                    ephemeral: true 
                });
            }
        }
    }

    async handleReportarBugModal(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const titulo = interaction.fields.getTextInputValue('bug_titulo');
            const descricao = interaction.fields.getTextInputValue('bug_descricao');

            // Validar
            if (!titulo || titulo.length < 3) {
                return await interaction.followUp({ 
                    content: '❌ **Erro:** O título deve ter pelo menos 3 caracteres.', 
                    ephemeral: true 
                });
            }

            if (!descricao || descricao.length < 10) {
                return await interaction.followUp({ 
                    content: '❌ **Erro:** A descrição deve ter pelo menos 10 caracteres.', 
                    ephemeral: true 
                });
            }

            const connection = await mysql.createConnection(this.dbConfig);

            try {
                // Verificar se a tabela existe, se não, criar
                await connection.execute(`
                    CREATE TABLE IF NOT EXISTS bugsprojetos (
                        Id INT AUTO_INCREMENT PRIMARY KEY,
                        Titulo VARCHAR(200) NOT NULL,
                        Descricao TEXT,
                        Tipo ENUM('bug', 'projeto', 'melhoria') DEFAULT 'bug',
                        Prioridade ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
                        Status ENUM('open', 'in-progress', 'resolved', 'closed') DEFAULT 'open',
                        DataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        DataAtualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_status (Status),
                        INDEX idx_tipo (Tipo),
                        INDEX idx_data_criacao (DataCriacao)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);

                // Buscar informações do usuário (opcional - para rastreamento)
                let userInfo = null;
                try {
                    const [users] = await connection.execute(
                        'SELECT ReferenciaID, Nome, Email FROM utilizadores WHERE discord_id = ?',
                        [interaction.user.id]
                    );
                    if (users.length > 0) {
                        userInfo = users[0];
                    }
                } catch (userError) {
                    console.log('[REPORTAR] Usuário não encontrado ou erro ao buscar:', userError.message);
                }

                // Adicionar informações do usuário à descrição se disponível
                let descricaoCompleta = descricao;
                if (userInfo) {
                    descricaoCompleta += `\n\n---\n**Reportado por:** ${userInfo.Nome} (${userInfo.ReferenciaID})\n**Discord:** ${interaction.user.tag} (${interaction.user.id})`;
                } else {
                    descricaoCompleta += `\n\n---\n**Reportado por:** ${interaction.user.tag} (${interaction.user.id})\n**Discord ID:** ${interaction.user.id}`;
                }

                // Inserir bug na base de dados
                const [result] = await connection.execute(
                    `INSERT INTO bugsprojetos (Titulo, Descricao, Tipo, Prioridade, Status, CreatedBy) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        titulo,
                        descricaoCompleta,
                        'bug', // Sempre bug quando reportado pelo Discord
                        'medium', // Prioridade média por padrão
                        'open', // Sempre aberto quando criado
                        userInfo?.ReferenciaID || null
                    ]
                );

                await connection.end();

                // Criar embed de confirmação
                const embed = new EmbedBuilder()
                    .setTitle('✅ Bug Reportado com Sucesso!')
                    .setDescription(
                        `Seu bug foi reportado e será analisado pela equipe.\n\n` +
                        `**Título:** ${titulo}\n` +
                        `**ID do Bug:** #${result.insertId}\n\n` +
                        `O bug aparecerá no painel administrativo e será tratado o mais breve possível.`
                    )
                    .setColor(0x4CAF50)
                    .setTimestamp()
                    .setFooter({ 
                        text: `©PromoPing • Bug #${result.insertId}`,
                        iconURL: interaction.user.displayAvatarURL()
                    });

                await interaction.followUp({ embeds: [embed], ephemeral: true });

                // Log para console
                console.log(`[REPORTAR] Bug reportado por ${interaction.user.tag} (${interaction.user.id}): ${titulo} (ID: ${result.insertId})`);

            } catch (dbError) {
                await connection.end();
                console.error('[REPORTAR] Erro ao inserir bug na base de dados:', dbError);
                
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Erro ao Reportar Bug')
                    .setDescription(
                        'Ocorreu um erro ao reportar o bug. Por favor, tente novamente mais tarde ou entre em contato com o suporte.'
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();

                return await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            }

        } catch (error) {
            console.error('[DISCORD] Erro ao processar modal de reportar bug:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'Ocorreu um erro ao processar seu reporte. Tente novamente.', 
                    ephemeral: true 
                });
            } else {
                await interaction.followUp({ 
                    content: 'Ocorreu um erro ao processar seu reporte. Tente novamente.', 
                    ephemeral: true 
                });
            }
        }
    }

    async publishPublicSuggestion(interaction, suggestionData) {
        const { id, titulo, descricao, plataforma, publicId } = suggestionData;
        const guild = interaction.guild;
        if (!guild) return null;

        const channel = await suggestionPublic.resolveSuggestionsChannel(guild, this.client);
        if (!channel) {
            console.warn('[SUGGESTION] Public suggestions channel not found. Set DISCORD_SUGGESTIONS_PUBLIC_CHANNEL_ID.');
            return null;
        }

        const embed = suggestionPublic.buildPublicSuggestionEmbed({
            submitterName: interaction.user.displayName || interaction.user.username,
            submitterAvatar: interaction.user.displayAvatarURL(),
            titulo,
            descricao,
            plataforma,
            upvotes: 0,
            downvotes: 0,
            submitterId: interaction.user.id,
            publicId,
        });

        const row = suggestionPublic.buildVoteRow(id, { guildId: guild.id });
        const message = await channel.send({ embeds: [embed], components: [row] });

        try {
            await this.dbPool.execute(
                `UPDATE sugestoes SET
                    PublicId = ?,
                    DiscordUserId = ?,
                    DiscordUsername = ?,
                    DiscordPublicMessageId = ?,
                    DiscordPublicChannelId = ?,
                    DiscordThreadId = NULL,
                    Upvotes = 0,
                    Downvotes = 0
                 WHERE Id = ?`,
                [
                    publicId,
                    interaction.user.id,
                    interaction.user.username,
                    message.id,
                    channel.id,
                    id,
                ]
            );
        } catch (dbErr) {
            console.error('[SUGGESTION] Failed to save public suggestion metadata:', dbErr.message);
        }

        return { channel, message, thread: null, publicId };
    }

    async handleSuggestionDiscuss(interaction) {
        try {
            const suggestionId = parseInt(interaction.customId.replace('suggestion_discuss_', ''), 10);
            if (!suggestionId) {
                return await interaction.reply({ content: 'Invalid suggestion.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            const [rows] = await this.dbPool.execute(
                `SELECT Id, Titulo, Descricao, Plataforma, Upvotes, Downvotes, PublicId,
                        DiscordUserId, DiscordUsername, DiscordPublicMessageId, DiscordPublicChannelId,
                        DiscordThreadId
                 FROM sugestoes WHERE Id = ? LIMIT 1`,
                [suggestionId]
            );

            if (!rows.length) {
                return await interaction.editReply({ content: 'Suggestion not found.' });
            }

            const suggestion = rows[0];
            const getField = (obj, ...keys) => {
                for (const k of keys) {
                    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
                    const lower = k.toLowerCase();
                    if (obj[lower] !== undefined && obj[lower] !== null) return obj[lower];
                }
                return null;
            };

            const guild = interaction.guild;
            const messageId = getField(suggestion, 'DiscordPublicMessageId', 'discordpublicmessageid');
            const channelId = getField(suggestion, 'DiscordPublicChannelId', 'discordpublicchannelid');
            let threadId = getField(suggestion, 'DiscordThreadId', 'discordthreadid');
            const publicId = getField(suggestion, 'PublicId', 'publicid');
            const submitterId = getField(suggestion, 'DiscordUserId', 'discorduserid');

            if (threadId) {
                const existing = await this.client.channels.fetch(threadId).catch(() => null);
                if (existing) {
                    return await interaction.editReply({ content: `Join the discussion: ${existing}` });
                }
            }

            const channel = await this.client.channels.fetch(channelId).catch(() => null);
            if (!channel?.isTextBased?.()) {
                return await interaction.editReply({ content: 'Could not open discussion for this suggestion.' });
            }

            const parentMessage = await channel.messages.fetch(messageId).catch(() => null);
            if (!parentMessage) {
                return await interaction.editReply({ content: 'Suggestion message not found.' });
            }

            const thread = await parentMessage.startThread({
                name: `Discussion · ${publicId}`,
                autoArchiveDuration: 10080,
                reason: 'Community discussion opened on demand',
            });

            const submitter = submitterId
                ? await this.client.users.fetch(submitterId).catch(() => null)
                : null;

            await thread.send(
                `Hey ${submitter || interaction.user}, use this thread to discuss this suggestion.`
            );

            threadId = thread.id;
            await this.dbPool.execute(
                'UPDATE sugestoes SET DiscordThreadId = ? WHERE Id = ?',
                [threadId, suggestionId]
            );

            const titulo = getField(suggestion, 'Titulo', 'titulo');
            const descricao = getField(suggestion, 'Descricao', 'descricao');
            const plataforma = getField(suggestion, 'Plataforma', 'plataforma') || 'ambos';
            const upvotes = parseInt(getField(suggestion, 'Upvotes', 'upvotes') || 0, 10);
            const downvotes = parseInt(getField(suggestion, 'Downvotes', 'downvotes') || 0, 10);
            const submitterName = getField(suggestion, 'DiscordUsername', 'discordusername') || 'User';

            const embed = suggestionPublic.buildPublicSuggestionEmbed({
                submitterName: submitter?.displayName || submitterName,
                submitterAvatar: submitter?.displayAvatarURL() || null,
                titulo,
                descricao,
                plataforma,
                upvotes,
                downvotes,
                submitterId: submitterId || interaction.user.id,
                publicId,
            });

            await parentMessage.edit({
                embeds: [embed],
                components: [
                    suggestionPublic.buildVoteRow(suggestionId, {
                        guildId: guild.id,
                        threadId,
                    }),
                ],
            });

            await interaction.editReply({ content: `Discussion opened: ${thread}` });
        } catch (error) {
            console.error('[SUGGESTION] Discuss error:', error);
            await interaction.editReply({ content: 'Could not open discussion. Please try again.' }).catch(() => {});
        }
    }

    async handleSuggestionVote(interaction, voteType) {
        try {
            const parts = interaction.customId.split('_');
            const suggestionId = parseInt(parts[3], 10);
            if (!suggestionId) {
                return await interaction.reply({ content: 'Invalid suggestion.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            const [rows] = await this.dbPool.execute(
                `SELECT Id, Titulo, Descricao, Plataforma, Upvotes, Downvotes, PublicId,
                        DiscordUserId, DiscordUsername, DiscordPublicMessageId, DiscordPublicChannelId,
                        DiscordThreadId
                 FROM sugestoes WHERE Id = ? LIMIT 1`,
                [suggestionId]
            );

            if (!rows.length) {
                return await interaction.editReply({ content: 'Suggestion not found.' });
            }

            const suggestion = rows[0];
            const getField = (obj, ...keys) => {
                for (const k of keys) {
                    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
                    const lower = k.toLowerCase();
                    if (obj[lower] !== undefined && obj[lower] !== null) return obj[lower];
                }
                return null;
            };

            const messageId = getField(suggestion, 'DiscordPublicMessageId', 'discordpublicmessageid');
            const channelId = getField(suggestion, 'DiscordPublicChannelId', 'discordpublicchannelid');
            if (!messageId || !channelId) {
                return await interaction.editReply({ content: 'This suggestion is no longer available for voting.' });
            }
            const publicId = getField(suggestion, 'PublicId', 'publicid');
            const titulo = getField(suggestion, 'Titulo', 'titulo');
            const descricao = getField(suggestion, 'Descricao', 'descricao');
            const plataforma = getField(suggestion, 'Plataforma', 'plataforma') || 'ambos';
            let upvotes = parseInt(getField(suggestion, 'Upvotes', 'upvotes') || 0, 10);
            let downvotes = parseInt(getField(suggestion, 'Downvotes', 'downvotes') || 0, 10);
            const submitterId = getField(suggestion, 'DiscordUserId', 'discorduserid');
            const submitterName = getField(suggestion, 'DiscordUsername', 'discordusername') || 'User';
            const threadId = getField(suggestion, 'DiscordThreadId', 'discordthreadid');

            const userId = interaction.user.id;

            const [existingVotes] = await this.dbPool.execute(
                'SELECT VoteType FROM suggestion_votes WHERE SuggestionId = ? AND DiscordUserId = ? LIMIT 1',
                [suggestionId, userId]
            );

            let feedback;
            const previousVote = existingVotes[0]?.votetype || existingVotes[0]?.VoteType;

            if (previousVote === voteType) {
                feedback = `You have already ${voteType === 'up' ? 'upvoted' : 'downvoted'} this suggestion.`;
                return await interaction.editReply({ content: feedback });
            }

            if (previousVote === 'up') upvotes = Math.max(0, upvotes - 1);
            if (previousVote === 'down') downvotes = Math.max(0, downvotes - 1);

            if (voteType === 'up') upvotes += 1;
            else downvotes += 1;

            if (previousVote) {
                await this.dbPool.execute(
                    'UPDATE suggestion_votes SET VoteType = ? WHERE SuggestionId = ? AND DiscordUserId = ?',
                    [voteType, suggestionId, userId]
                );
                const fromLabel = previousVote === 'up' ? 'up vote' : 'down vote';
                const toLabel = voteType === 'up' ? 'up vote' : 'down vote';
                const articleFrom = previousVote === 'up' ? 'an' : 'a';
                const articleTo = voteType === 'up' ? 'an' : 'a';
                feedback = `I have changed your vote from ${articleFrom} ${fromLabel} to ${articleTo} ${toLabel} for this suggestion. The suggestion will be updated shortly.`;
            } else {
                await this.dbPool.execute(
                    'INSERT INTO suggestion_votes (SuggestionId, DiscordUserId, VoteType) VALUES (?, ?, ?)',
                    [suggestionId, userId, voteType]
                );
                feedback = `Thanks! I have registered your ${voteType === 'up' ? 'up' : 'down'} vote.`;
            }

            await this.dbPool.execute(
                'UPDATE sugestoes SET Upvotes = ?, Downvotes = ?, Votos = ? WHERE Id = ?',
                [upvotes, downvotes, upvotes - downvotes, suggestionId]
            );

            const channel = await this.client.channels.fetch(channelId).catch(() => null);
            if (channel?.isTextBased?.()) {
                const msg = await channel.messages.fetch(messageId).catch(() => null);
                if (msg) {
                    const submitter = submitterId
                        ? await this.client.users.fetch(submitterId).catch(() => null)
                        : null;

                    const embed = suggestionPublic.buildPublicSuggestionEmbed({
                        submitterName: submitter?.displayName || submitterName,
                        submitterAvatar: submitter?.displayAvatarURL() || null,
                        titulo,
                        descricao,
                        plataforma,
                        upvotes,
                        downvotes,
                        submitterId: submitterId || userId,
                        publicId,
                    });

                    await msg.edit({
                        embeds: [embed],
                        components: [
                            suggestionPublic.buildVoteRow(suggestionId, {
                                guildId: interaction.guild?.id || channel.guildId,
                                threadId,
                            }),
                        ],
                    });
                }
            }

            await interaction.editReply({ content: feedback });
        } catch (error) {
            console.error('[SUGGESTION] Vote error:', error);
            await interaction.editReply({ content: 'An error occurred while registering your vote.' }).catch(() => {});
        }
    }

    async handleSugerirButton(interaction) {
        try {
            const modal = new ModalBuilder()
                .setCustomId('formulario_sugerir')
                .setTitle('Suggest a Feature');

            const tituloInput = new TextInputBuilder()
                .setCustomId('sugestao_titulo')
                .setLabel('Suggestion title')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. Add email notifications')
                .setRequired(true)
                .setMaxLength(200)
                .setMinLength(3);

            const descricaoInput = new TextInputBuilder()
                .setCustomId('sugestao_descricao')
                .setLabel('Detailed description')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe your idea: what you want, how it would work, etc.')
                .setRequired(true)
                .setMaxLength(2000)
                .setMinLength(10);

            const plataformaInput = new TextInputBuilder()
                .setCustomId('sugestao_plataforma')
                .setLabel('Platform (website/bot/both)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('website, bot, or both')
                .setRequired(true)
                .setMaxLength(10)
                .setMinLength(3);

            // Adicionar campos ao modal
            const tituloRow = new ActionRowBuilder().addComponents(tituloInput);
            const descricaoRow = new ActionRowBuilder().addComponents(descricaoInput);
            const plataformaRow = new ActionRowBuilder().addComponents(plataformaInput);

            modal.addComponents(tituloRow, descricaoRow, plataformaRow);

            await interaction.showModal(modal);
        } catch (error) {
            console.error('[DISCORD] Erro ao mostrar modal de sugestão:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'Ocorreu um erro ao abrir o formulário. Tente novamente.', 
                    ephemeral: true 
                });
            }
        }
    }

    async handleSugerirModal(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const titulo = interaction.fields.getTextInputValue('sugestao_titulo');
            const descricao = interaction.fields.getTextInputValue('sugestao_descricao');
            let plataforma = interaction.fields.getTextInputValue('sugestao_plataforma').toLowerCase().trim();

            if (!titulo || titulo.length < 3) {
                return await interaction.editReply({
                    content: '**Error:** Title must be at least 3 characters.',
                });
            }

            if (!descricao || descricao.length < 10) {
                return await interaction.editReply({
                    content: '**Error:** Description must be at least 10 characters.',
                });
            }

            if (plataforma === 'site' || plataforma === 'web' || plataforma === 'website') {
                plataforma = 'site';
            } else if (plataforma === 'bot' || plataforma === 'discord') {
                plataforma = 'bot';
            } else {
                plataforma = 'ambos';
            }

            const publicId = suggestionPublic.generatePublicId();

            const connection = await mysql.createConnection(this.dbConfig);

            try {
                // Verificar se a tabela existe, se não, criar
                await connection.execute(`
                    CREATE TABLE IF NOT EXISTS sugestoes (
                        Id INT AUTO_INCREMENT PRIMARY KEY,
                        Titulo VARCHAR(200) NOT NULL,
                        Descricao TEXT,
                        Plataforma ENUM('site', 'bot', 'ambos') DEFAULT 'ambos',
                        Prioridade ENUM('low', 'medium', 'high') DEFAULT 'medium',
                        Status ENUM('pendente', 'em-analise', 'aprovada', 'em-desenvolvimento', 'implementada', 'rejeitada') DEFAULT 'pendente',
                        Votos INT DEFAULT 0,
                        DataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        DataAtualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_status (Status),
                        INDEX idx_plataforma (Plataforma),
                        INDEX idx_data_criacao (DataCriacao)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);

                // Buscar informações do usuário (opcional - para rastreamento)
                let userInfo = null;
                try {
                    const [users] = await connection.execute(
                        'SELECT ReferenciaID, Nome, Email FROM utilizadores WHERE discord_id = ?',
                        [interaction.user.id]
                    );
                    if (users.length > 0) {
                        userInfo = users[0];
                    }
                } catch (userError) {
                    console.log('[SUGERIR] Usuário não encontrado ou erro ao buscar:', userError.message);
                }

                // Adicionar informações do usuário à descrição se disponível
                let descricaoCompleta = descricao;
                if (userInfo) {
                    descricaoCompleta += `\n\n---\n**Sugerido por:** ${userInfo.Nome} (${userInfo.ReferenciaID})\n**Discord:** ${interaction.user.tag} (${interaction.user.id})`;
                } else {
                    descricaoCompleta += `\n\n---\n**Sugerido por:** ${interaction.user.tag} (${interaction.user.id})\n**Discord ID:** ${interaction.user.id}`;
                }

                // Inserir sugestão na base de dados
                const [result] = await connection.execute(
                    `INSERT INTO sugestoes (Titulo, Descricao, Plataforma, Prioridade, Status) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        titulo,
                        descricaoCompleta,
                        plataforma,
                        'medium', // Prioridade média por padrão
                        'pendente' // Sempre pendente quando criado
                    ]
                );

                const suggestionDbId = result.insertId;

                await connection.end();

                const publicPost = await this.publishPublicSuggestion(interaction, {
                    id: suggestionDbId,
                    titulo,
                    descricao,
                    plataforma,
                    publicId,
                });

                const platformLabel = suggestionPublic.formatPlatform(plataforma);
                const embed = new EmbedBuilder()
                    .setTitle('Suggestion submitted')
                    .setDescription(
                        'Your suggestion was sent to the admin panel and posted publicly for community voting.\n\n' +
                        `**Title:** ${titulo}\n` +
                        `**Platform:** ${platformLabel}\n` +
                        `**Suggestion ID:** #${suggestionDbId}\n` +
                        `**Public ID:** \`${publicId}\`\n\n` +
                        (publicPost?.channel
                            ? `Community discussion: ${publicPost.channel}${publicPost.thread ? ` → ${publicPost.thread}` : ''}`
                            : 'Public channel not configured — only the admin panel received this suggestion.')
                    )
                    .setColor(0x3B82F6)
                    .setTimestamp()
                    .setFooter({
                        text: `PromoPing • Suggestion #${suggestionDbId}`,
                        iconURL: interaction.user.displayAvatarURL(),
                    });

                await interaction.editReply({ embeds: [embed] });

                console.log(`[SUGGESTION] Submitted by ${interaction.user.tag} (${interaction.user.id}): ${titulo} (ID: ${suggestionDbId}, sID: ${publicId})`);

            } catch (dbError) {
                await connection.end();
                console.error('[SUGERIR] Erro ao inserir sugestão na base de dados:', dbError);
                
                const errorEmbed = new EmbedBuilder()
                    .setTitle('Error submitting suggestion')
                    .setDescription('Something went wrong. Please try again later or contact support.')
                    .setColor(0xFF0000)
                    .setTimestamp();

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

        } catch (error) {
            console.error('[DISCORD] Erro ao processar modal de sugestão:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while processing your suggestion.',
                    ephemeral: true,
                });
            } else {
                await interaction.editReply({
                    content: 'An error occurred while processing your suggestion.',
                }).catch(() => {});
            }
        }
    }

}

module.exports = PromoPingBot;

