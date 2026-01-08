const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const path = require('path');
const mysql = require('mysql2/promise');
const comandos = require('./comandos');
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
            partials: ['CHANNEL']
        });

        // Configurações de banco de dados
        this.dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'pap',
            port: parseInt(process.env.DB_PORT) || 3306
        };

        // Configurações do bot
        this.prefix = process.env.DISCORD_PREFIX || '!';
        this.checkInterval = parseInt(process.env.BOT_CHECK_INTERVAL) || 5;
        this.isMonitoring = false;
        this.lastCheck = new Date();
        this.lastErrorLog = 0; // Para controlar spam de erros
        
        // Anti-spam para chamar moderador: armazena timestamp por canal
        this.lastModeratorCall = new Map(); // channelId -> timestamp

        // Monitoramento de Twitch
        this.twitchCheckInterval = null;
        this.lastTwitchCheck = new Date();
        this.twitchLiveStatus = new Map(); // channelName -> { isLive: boolean, lastNotification: Date }

        // Monitoramento de Notícias
        this.newsCheckInterval = null;
        this.lastNewsCheck = new Date();
        this.newsService = null; // Será carregado dinamicamente

        // IDs de administradores com acesso total a todos os comandos
        this.adminIds = [
            '1448056767253708821' // ID com acesso total
        ];

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

    setupEventHandlers() {
        // Quando o bot se conecta
        this.client.once('ready', async () => {
            console.log(`[DISCORD] Bot conectado como ${this.client.user.tag}`);
            console.log(`[DISCORD] Iniciando monitoramento de preços, Twitch e notícias...`);
            this.startMonitoring();
            this.startTwitchMonitoring();
            this.startNewsMonitoring();
            
            // Definir status/presença do bot
            // Alterna entre diferentes descrições de status a cada 20 segundos
            const activities = [
                { name: 'PromoPing - Monitor de Preços', type: 0 },
                { name: '!ajuda para comandos', type: 0 },
                { name: 'promoping.pt', type: 3 }
            ];
            let activityIndex = 0;
            const updateActivity = () => {
                const activity = activities[activityIndex];
                this.client.user.setActivity(activity.name, { type: activity.type });
                activityIndex = (activityIndex + 1) % activities.length;
            };
            updateActivity();
            setInterval(updateActivity, 20000);
            
            // Registrar comandos de barra (slash commands)
            await this.registerSlashCommands();
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
                    // Processar comandos no privado também
                    if (message.content.startsWith(this.prefix)) {
                        const args = message.content.slice(this.prefix.length).trim().split(/ +/);
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

                // Verificar counting antes de processar comandos
                const countingHandled = await this.handleCounting(message);
                if (countingHandled) return; // Se foi processado como counting, não processar como comando

                // Ignora mensagens sem prefixo
                if (!message.content.startsWith(this.prefix)) return;

                // Extrai comando e argumentos
                const args = message.content.slice(this.prefix.length).trim().split(/ +/);
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
                        // Handler para menu de seleção de review
                        await this.handleReviewTypeSelection(interaction);
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
                        // Verificar ticket_fechar_ depois das verificações específicas
                        await this.handleFecharTicketButton(interaction);
                    } else if (interaction.customId.startsWith('ticket_chamar_mod_')) {
                        await this.handleChamarModerador(interaction);
                    } else if (interaction.customId === 'aceitar_regras_promoping') {
                        await this.handleAceitarRegras(interaction);
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

    async handleTicketButton(interaction) {
        try {
            const guild = interaction.guild;
            const userId = interaction.user.id;

            if (!guild) {
                return await interaction.reply({ 
                    content: 'Este botão só pode ser usado em um servidor!', 
                    ephemeral: true 
                });
            }

            // Verificar se o usuário já tem um ticket aberto
            const ticketChannelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            
            const existingChannel = guild.channels.cache.find(
                channel => channel.name === ticketChannelName && channel.type === ChannelType.GuildText
            );

            if (existingChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Ticket Já Existe')
                    .setDescription(`Você já tem um ticket aberto: ${existingChannel}`)
                    .setColor(0xffa500)
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Mostrar opções de categoria com menu de seleção
            const categoriaEmbed = new EmbedBuilder()
                .setTitle('Escolha a Categoria do Ticket')
                .setDescription('Selecione a categoria que melhor descreve seu problema:')
                .setColor(0x5865F2)
                .setTimestamp();

            const categoriaSelectMenu = new StringSelectMenuBuilder()
                .setCustomId(`ticket_categoria_${userId}`)
                .setPlaceholder('Selecione uma categoria...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Notificações')
                        .setDescription('Problema com notificações')
                        .setValue(`notificacoes_${userId}`),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Dúvida')
                        .setDescription('Dúvida sobre o bot')
                        .setValue(`duvida_${userId}`),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Login')
                        .setDescription('Erro ao fazer login')
                        .setValue(`login_${userId}`),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Produtos')
                        .setDescription('Problema com produtos')
                        .setValue(`produtos_${userId}`),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Outros')
                        .setDescription('Outro tipo de problema')
                        .setValue(`outros_${userId}`)
                );

            const categoriaRow = new ActionRowBuilder()
                .addComponents(categoriaSelectMenu);

            await interaction.reply({ 
                embeds: [categoriaEmbed], 
                components: [categoriaRow],
                ephemeral: true 
            });

        } catch (error) {
            console.error('[DISCORD] Erro ao processar botão de ticket:', error);
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
                        .setStyle(ButtonStyle.Primary)
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

                    try {
                        const connection = await mysql.createConnection(this.dbConfig);
                        
                        // Garantir que a tabela existe
                        await connection.execute(`
                            CREATE TABLE IF NOT EXISTS reviews (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                discord_user_id VARCHAR(20) NOT NULL,
                                discord_username VARCHAR(100) NOT NULL,
                                discord_avatar_url VARCHAR(500) NULL,
                                tipo ENUM('site', 'bot', 'suporte') NOT NULL,
                                texto TEXT NOT NULL,
                                rating INT NULL,
                                is_anonimo TINYINT(1) DEFAULT 0,
                                discord_channel_id VARCHAR(20) NULL,
                                discord_message_id VARCHAR(20) NULL,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                                INDEX idx_discord_user_id (discord_user_id),
                                INDEX idx_tipo (tipo),
                                INDEX idx_rating (rating),
                                INDEX idx_created_at (created_at),
                                INDEX idx_is_anonimo (is_anonimo)
                            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                        `);

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

                        // Salvar no banco de dados
                        const [result] = await connection.execute(`
                            INSERT INTO reviews (
                                discord_user_id, 
                                discord_username, 
                                discord_avatar_url, 
                                tipo, 
                                texto, 
                                rating, 
                                is_anonimo, 
                                discord_channel_id, 
                                discord_message_id
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            userId,
                            isAnonimo ? 'Anónimo' : userName,
                            isAnonimo ? null : userAvatar,
                            tipo,
                            reviewText || '',
                            rating,
                            isAnonimo ? 1 : 0,
                            discordChannelId,
                            discordMessageId
                        ]);

                        savedReviewId = result.insertId;
                        await connection.end();
                        console.log(`[DISCORD] Avaliação salva no banco de dados (ID: ${savedReviewId})`);
                    } catch (dbError) {
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
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`ticket_cancelar_${userId}`)
                        .setLabel('Cancelar')
                        .setStyle(ButtonStyle.Danger)
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
            const categoriaNome = categoriaNomes[categoriaCode] || 'Outros';

            // Verificar se o usuário já tem um ticket aberto
            const ticketChannelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            
            const existingChannel = guild.channels.cache.find(
                channel => channel.name === ticketChannelName && channel.type === ChannelType.GuildText
            );

            if (existingChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Ticket Já Existe')
                    .setDescription(`Você já tem um ticket aberto: ${existingChannel}`)
                    .setColor(0xffa500)
                    .setTimestamp();
                
                return await interaction.update({ 
                    embeds: [embed], 
                    components: [] 
                });
            }

            // Criar categoria de tickets se não existir
            let ticketCategory = guild.channels.cache.find(
                cat => cat.name === '🎫 Tickets' && cat.type === ChannelType.GuildCategory
            );

            if (!ticketCategory) {
                ticketCategory = await guild.channels.create({
                    name: '🎫 Tickets',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        }
                    ]
                });
            }

            // Criar canal de ticket com permissões explícitas
            const ticketChannel = await guild.channels.create({
                name: ticketChannelName,
                type: ChannelType.GuildText,
                parent: ticketCategory.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: userId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ],
                        deny: []
                    },
                    {
                        id: this.client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageMessages
                        ]
                    }
                ]
            });

            // Garantir que o usuário tenha acesso ao canal (atualizar permissões se necessário)
            try {
                await ticketChannel.permissionOverwrites.edit(userId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true
                });
            } catch (error) {
                console.error('[DISCORD] Erro ao atualizar permissões do usuário:', error);
            }

            // Adicionar permissões para roles de suporte (se configuradas)
            const supportRoleId = process.env.DISCORD_SUPPORT_ROLE_ID;
            if (supportRoleId) {
                await ticketChannel.permissionOverwrites.edit(supportRoleId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true
                });
            }

            // Criar embed de boas-vindas no canal do ticket
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎫 Ticket de Suporte Criado')
                .setDescription(`**Ticket criado por:** ${interaction.user}\n**Categoria:** ${categoriaNome}`)
                .addFields({
                    name: 'Informações',
                    value: '• Um membro da equipe de suporte responderá em breve\n• Descreva seu problema com detalhes\n• Use os botões abaixo para gerenciar o ticket',
                    inline: false
                })
                .setColor(0x00ff00)
                .setTimestamp()
                .setFooter({ text: 'PromoPing - Suporte' });

            // Criar botões para o ticket
            const ticketButtonsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_fechar_${ticketChannel.id}_${userId}`)
                        .setLabel('Fechar Ticket')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`ticket_chamar_mod_${ticketChannel.id}_${userId}`)
                        .setLabel('Chamar Suporte')
                        .setStyle(ButtonStyle.Primary)
                );

            const mentionText = supportRoleId 
                ? `${interaction.user} | <@&${supportRoleId}>`
                : `${interaction.user}`;
            
            await ticketChannel.send({ 
                content: mentionText,
                embeds: [welcomeEmbed],
                components: [ticketButtonsRow]
            });

            // Confirmar criação do ticket
            const successEmbed = new EmbedBuilder()
                .setTitle('🎫 Ticket Criado com Sucesso!')
                .setDescription(`Seu ticket foi criado: ${ticketChannel}\n\n**Categoria:** ${categoriaNome}\n\nClique no canal acima para acessá-lo.`)
                .setColor(0x00ff00)
                .setTimestamp();

            await interaction.update({ 
                embeds: [successEmbed], 
                components: [] 
            });

            // Enviar mensagem adicional com link
            await interaction.followUp({ 
                content: `🎫 Seu ticket foi criado! Acesse: ${ticketChannel}`,
                ephemeral: true 
            });

        } catch (error) {
            console.error('[DISCORD] Erro ao criar ticket:', error);
            await interaction.update({ 
                content: ' **Erro ao criar o ticket!** Tente novamente em alguns minutos.',
                components: []
            });
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
                    .setTitle('❌ Mensagem Muito Curta')
                    .setDescription('Por favor, forneça uma descrição mais detalhada sobre seu problema ou dúvida.\n\n**Exemplo:** `!suporte Preciso de ajuda com notificações`')
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
                    .setTitle('❌ Servidor Não Encontrado')
                    .setDescription('Não foi possível encontrar o servidor para criar o ticket. Por favor, contate um administrador.')
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
                    .setTitle('❌ Você Não Está no Servidor')
                    .setDescription('Para criar um ticket, você precisa estar no servidor do PromoPing. Por favor, entre no servidor primeiro.')
                    .setColor(0xff0000)
                    .setTimestamp();
                return await safeReply({ embeds: [embed] });
            }

            // Verificar se o usuário já tem um ticket aberto
            const username = message.author.username || message.author.displayName || message.author.tag.split('#')[0] || 'user';
            const ticketChannelName = `ticket-${username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            
            const existingChannel = guild.channels.cache.find(
                channel => channel.name === ticketChannelName && channel.type === ChannelType.GuildText
            );

            if (existingChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🎫 Ticket Já Existe')
                    .setDescription(`Você já tem um ticket aberto no servidor.\n\nAcesse: ${existingChannel}\n\nSua mensagem foi encaminhada para o ticket existente.`)
                    .setColor(0xffa500)
                    .setTimestamp();

                // Enviar mensagem para o ticket existente
                const ticketMessageEmbed = new EmbedBuilder()
                    .setTitle('📩 Nova Mensagem do Usuário (via DM)')
                    .setDescription(userMessage)
                    .setAuthor({ 
                        name: message.author.tag, 
                        iconURL: message.author.displayAvatarURL() 
                    })
                    .setColor(0x5865F2)
                    .setTimestamp();

                await existingChannel.send({ embeds: [ticketMessageEmbed] });
                return await safeReply({ embeds: [embed] });
            }

            // Criar categoria de tickets se não existir
            let ticketCategory = guild.channels.cache.find(
                cat => cat.name === '🎫 Tickets' && cat.type === ChannelType.GuildCategory
            );

            if (!ticketCategory) {
                ticketCategory = await guild.channels.create({
                    name: '🎫 Tickets',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        }
                    ]
                });
            }

            // Criar canal de ticket com permissões explícitas
            const ticketChannel = await guild.channels.create({
                name: ticketChannelName,
                type: ChannelType.GuildText,
                parent: ticketCategory.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: userId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ],
                        deny: []
                    },
                    {
                        id: this.client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageMessages
                        ]
                    }
                ]
            });

            // Garantir que o usuário tenha acesso ao canal
            try {
                await ticketChannel.permissionOverwrites.edit(userId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true
                });
            } catch (error) {
                console.error('[DISCORD] Erro ao atualizar permissões do usuário:', error);
            }

            // Adicionar permissões para roles de suporte (se configuradas)
            const supportRoleId = process.env.DISCORD_SUPPORT_ROLE_ID;
            if (supportRoleId) {
                await ticketChannel.permissionOverwrites.edit(supportRoleId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true
                });
            }

            // Criar embed de boas-vindas no canal do ticket
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎫 Ticket de Suporte Criado via DM')
                .setDescription(`**Ticket criado por:** ${message.author}\n**Categoria:** Criado via Mensagem Privada`)
                .addFields({
                    name: 'Mensagem Inicial',
                    value: userMessage,
                    inline: false
                })
                .addFields({
                    name: 'Informações',
                    value: '• Um membro da equipe de suporte responderá em breve\n• Descreva seu problema com detalhes\n• Use os botões abaixo para gerenciar o ticket',
                    inline: false
                })
                .setColor(0x00ff00)
                .setTimestamp()
                .setFooter({ text: 'PromoPing - Suporte' });

            // Criar botões para o ticket
            const ticketButtonsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_fechar_${ticketChannel.id}_${userId}`)
                        .setLabel('Fechar Ticket')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`ticket_chamar_mod_${ticketChannel.id}_${userId}`)
                        .setLabel('Chamar Suporte')
                        .setStyle(ButtonStyle.Primary)
                );

            const mentionText = supportRoleId 
                ? `${message.author} | <@&${supportRoleId}>`
                : `${message.author}`;
            
            await ticketChannel.send({ 
                content: mentionText,
                embeds: [welcomeEmbed],
                components: [ticketButtonsRow]
            });

            // Confirmar criação do ticket na DM
            const successEmbed = new EmbedBuilder()
                .setTitle('🎫 Ticket Criado com Sucesso!')
                .setDescription(`Seu ticket foi criado no servidor!\n\n**Canal:** ${ticketChannel}\n\nA equipe de suporte foi notificada e responderá em breve.`)
                .addFields({
                    name: 'Sua Mensagem',
                    value: userMessage,
                    inline: false
                })
                .setColor(0x00ff00)
                .setTimestamp()
                .setFooter({ text: 'PromoPing - Suporte' });

            // Usar safeReply para responder (trata interações deferidas automaticamente)
            await safeReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('[DISCORD] Erro ao criar ticket via DM:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erro ao Criar Ticket')
                .setDescription('Ocorreu um erro ao criar seu ticket. Por favor, tente novamente em alguns minutos ou contate um administrador.')
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
                    content: 'Este comando só pode ser usado em um servidor!', 
                    ephemeral: true 
                });
            }

            // Usar o canal da interação diretamente (mais confiável)
            const channel = interaction.channel;
            
            if (!channel) {
                // Se não tiver canal na interação, tentar buscar pelo ID do customId
                const parts = interaction.customId.split('_');
                const channelId = parts[2];
                const channelFromId = guild.channels.cache.get(channelId);
                
                if (!channelFromId) {
                    return await interaction.reply({ 
                        content: '❌ Canal não encontrado!', 
                        ephemeral: true 
                    });
                }
                
                // Verificar se é um ticket
                if (!channelFromId.name.startsWith('ticket-')) {
                    return await interaction.reply({ 
                        content: '❌ Este comando só pode ser usado em um canal de ticket!', 
                        ephemeral: true 
                    });
                }
            } else {
                // Verificar se é um ticket
                if (!channel.name.startsWith('ticket-')) {
                    return await interaction.reply({ 
                        content: '❌ Este comando só pode ser usado em um canal de ticket!', 
                        ephemeral: true 
                    });
                }
            }

            const finalChannel = channel || guild.channels.cache.get(interaction.customId.split('_')[2]);
            const channelId = finalChannel.id;

            // Extrair informações do customId: ticket_fechar_channelId_userId
            const parts = interaction.customId.split('_');
            const ticketOwnerId = parts[3];

            // Verificar permissões
            const isTicketOwner = userId === ticketOwnerId;
            const isAdmin = this.isAdmin(interaction.member);
            const supportRoleId = '1442655668904398980';
            const hasSupportRole = interaction.member.roles.cache.has(supportRoleId);

            if (!isTicketOwner && !isAdmin && !hasSupportRole) {
                return await interaction.reply({ 
                    content: '❌ Apenas o criador do ticket, administradores ou membros da equipe de suporte podem fechar tickets!', 
                    ephemeral: true 
                });
            }

            // Confirmar fechamento
            const confirmEmbed = new EmbedBuilder()
                .setTitle('Confirmar Fechamento')
                .setDescription('Tem certeza que deseja fechar este ticket?')
                .setColor(0xffa500)
                .setTimestamp();

            const confirmRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_fechar_confirmar_${channelId}_${userId}`)
                        .setLabel('Sim, Fechar')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`ticket_fechar_cancelar_${userId}`)
                        .setLabel('Cancelar')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.reply({ 
                embeds: [confirmEmbed], 
                components: [confirmRow],
                ephemeral: true 
            });

        } catch (error) {
            console.error('[DISCORD] Erro ao processar fechar ticket:', error);
            await interaction.reply({ 
                content: 'Ocorreu um erro ao processar sua solicitação.', 
                ephemeral: true 
            });
        }
    }

    async handleAceitarRegras(interaction) {
        try {
            // ID do cargo a ser adicionado: 1443627596565712978
            const roleId = '1443627596565712978';

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
                return await interaction.reply({ content: '✅ Você já possui o cargo de verificação!', ephemeral: true });
            }

            // Adiciona o cargo
            await member.roles.add(roleId, 'Aceite das regras do PromoPing');
            await interaction.reply({ content: '✅ Você foi verificado e recebeu acesso ao servidor!', ephemeral: true });

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

    async handleFecharTicketConfirm(interaction) {
        try {
            const guild = interaction.guild;
            const userId = interaction.user.id;

            if (!guild) {
                return await interaction.reply({ 
                    content: 'Este comando só pode ser usado em um servidor!', 
                    ephemeral: true 
                });
            }

            // Usar o canal da interação diretamente (mais confiável)
            let channel = interaction.channel;
            
            // Se não tiver canal na interação, tentar buscar pelo ID do customId
            if (!channel) {
                const parts = interaction.customId.split('_');
                const channelId = parts[3];
                channel = guild.channels.cache.get(channelId);
                
                // Tentar buscar via fetch se não estiver no cache
                if (!channel) {
                    try {
                        channel = await guild.channels.fetch(channelId);
                    } catch (error) {
                        console.error('[DISCORD] Erro ao buscar canal:', error);
                        return await interaction.update({ 
                            content: '❌ Canal não encontrado!', 
                            embeds: [], 
                            components: [] 
                        });
                    }
                }
            }

            if (!channel) {
                return await interaction.update({ 
                    content: '❌ Canal não encontrado!', 
                    embeds: [], 
                    components: [] 
                });
            }

            // Verificar se o canal é um ticket
            if (!channel.name.startsWith('ticket-')) {
                return await interaction.update({ 
                    content: '❌ Este não é um canal de ticket!', 
                    embeds: [], 
                    components: [] 
                });
            }

            // Salvar referência da categoria antes de deletar
            const ticketCategory = channel.parent;

            // Criar embed de fechamento
            const closeEmbed = new EmbedBuilder()
                .setTitle('Ticket Fechado')
                .setDescription(`Este ticket foi fechado por ${interaction.user}`)
                .addFields({
                    name: 'Informação',
                    value: 'O canal será deletado em **10 segundos**.',
                    inline: false
                })
                .setColor(0xff0000)
                .setTimestamp()
                .setFooter({ text: 'PromoPing - Suporte' });

            await channel.send({ embeds: [closeEmbed] });

            // Atualizar a interação
            await interaction.update({ 
                content: '✅ Ticket será fechado em 10 segundos...', 
                embeds: [], 
                components: [] 
            });

            // Deletar o canal após 10 segundos
            setTimeout(async () => {
                try {
                    // Deletar o canal
                    await channel.delete();

                    // Verificar se a categoria existe e está vazia
                    if (ticketCategory && ticketCategory.type === ChannelType.GuildCategory) {
                        // Aguardar um pouco para garantir que o canal foi deletado
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // Buscar a categoria novamente para verificar se ainda existe
                        const category = guild.channels.cache.get(ticketCategory.id);
                        
                        if (category) {
                            // Contar quantos canais restam na categoria (excluindo a própria categoria)
                            const channelsInCategory = category.children.cache.filter(
                                ch => ch.type !== ChannelType.GuildCategory
                            );

                            // Se não houver mais canais na categoria, deletar a categoria
                            if (channelsInCategory.size === 0) {
                                try {
                                    await category.delete();
                                    console.log(`[DISCORD] Categoria de tickets vazia deletada: ${category.name}`);
                                } catch (error) {
                                    console.error('[DISCORD] Erro ao deletar categoria de tickets:', error);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('[DISCORD] Erro ao deletar canal de ticket:', error);
                }
            }, 10000);

        } catch (error) {
            console.error('[DISCORD] Erro ao confirmar fechamento do ticket:', error);
            await interaction.update({ 
                content: '❌ Erro ao fechar o ticket!', 
                embeds: [], 
                components: [] 
            });
        }
    }

    async connect() {
        try {
            await this.client.login(process.env.DISCORD_BOT_TOKEN);
        } catch (error) {
            console.error('[DISCORD] Falha ao conectar ao Discord:', error);
            throw error;
        }
    }

    async startMonitoring() {
        this.isMonitoring = true;

        setInterval(async () => {
            if (this.isMonitoring) {
                await this.checkPriceChanges();
            }
        }, this.checkInterval * 60 * 1000);
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
                'SELECT * FROM news_config WHERE IsActive = TRUE LIMIT 1'
            );

            if (configs.length === 0) {
                console.log('[DISCORD] Sistema de notícias não configurado');
                await connection.end();
                return;
            }

            const config = configs[0];
            const channel = await this.client.channels.fetch(config.ChannelId).catch(() => null);
            
            if (!channel) {
                console.error('[DISCORD] Canal de notícias não encontrado!');
                await connection.end();
                return;
            }

            // Enviar cada notícia impactante
            for (const article of news) {
                // Verificar se já foi enviada
                const alreadySent = await this.newsService.isNewsAlreadySent(article.url);
                if (alreadySent) {
                    console.log(`[DISCORD] Notícia já enviada: ${article.title.substring(0, 50)}...`);
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
            // Determinar cor baseada no score de impacto
            let color = 0x5865F2; // Azul padrão
            if (article.impactScore >= 9) {
                color = 0xff0000; // Vermelho para muito impactante
            } else if (article.impactScore >= 8) {
                color = 0xff9900; // Laranja para impactante
            } else {
                color = 0x5865F2; // Azul para moderado
            }

            const embed = new EmbedBuilder()
                .setTitle(`📰 ${article.title}`)
                .setDescription(article.description || 'Sem descrição disponível')
                .addFields(
                    { name: 'Categoria', value: article.category, inline: true },
                    { name: 'Impacto', value: `${article.impactScore}/10`, inline: true },
                    { name: 'Fonte', value: article.source, inline: true }
                )
                .setURL(article.url)
                .setColor(color)
                .setTimestamp(new Date(article.publishedAt))
                .setFooter({ text: 'PromoPing - Notícias Automáticas' });

            if (article.image) {
                embed.setImage(article.image);
            }

            await discordChannel.send({ embeds: [embed] });
            console.log(`[DISCORD] Notícia enviada: ${article.title.substring(0, 50)}...`);

        } catch (error) {
            console.error('[DISCORD] Erro ao enviar notificação de notícia:', error);
        }
    }

    async checkTwitchLives() {
        try {
            const connection = await mysql.createConnection(this.dbConfig);
            // Selecionar apenas colunas que existem (TwitchUserId pode não existir)
            const [channels] = await connection.execute(
                'SELECT ChannelName, IsLive FROM twitch_channels'
            );

            if (channels.length === 0) {
                await connection.end();
                return;
            }

            const SOCIAL_FEED_CHANNEL_ID = '1442931610927366284';
            const channel = await this.client.channels.fetch(SOCIAL_FEED_CHANNEL_ID);
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

            // Obter token de acesso da Twitch
            const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: TWITCH_CLIENT_ID,
                    client_secret: TWITCH_CLIENT_SECRET,
                    grant_type: 'client_credentials'
                })
            });

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                console.error(`[DISCORD] Erro ao obter token da Twitch: ${tokenResponse.status} - ${errorText}`);
                await connection.end();
                return;
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

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
            const queryParams = channelNames
                .slice(0, 100) // Limitar a 100 canais por requisição
                .map(name => `user_login=${encodeURIComponent(name)}`)
                .join('&');
            
            const streamsResponse = await fetch(
                `https://api.twitch.tv/helix/streams?${queryParams}`,
                {
                    headers: {
                        'Client-ID': TWITCH_CLIENT_ID,
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            if (!streamsResponse.ok) {
                const errorText = await streamsResponse.text();
                console.error(`[DISCORD] Erro ao buscar streams da Twitch: ${streamsResponse.status} - ${errorText}`);
                await connection.end();
                return;
            }

            const streamsData = await streamsResponse.json();
            const liveChannels = new Set(streamsData.data.map(s => s.user_login.toLowerCase()));

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
                    const streamInfo = streamsData.data.find(s => s.user_login.toLowerCase() === channelName);
                    await this.sendTwitchLiveNotification(channel, channelName, streamInfo);
                    this.twitchLiveStatus.set(channelName, { isLive: true, lastNotification: new Date() });
                } else if (!isLive && wasLive) {
                    // Canal saiu do ar - limpar status completamente para permitir nova notificação quando voltar
                    this.twitchLiveStatus.delete(channelName);
                }
            }

            await connection.end();
            this.lastTwitchCheck = new Date();

        } catch (error) {
            console.error('[DISCORD] Erro ao verificar lives da Twitch:', error);
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
            const user = await this.client.users.fetch(product.DiscordId);
            if (!user) {
                // Usuário não encontrado - log silencioso
                return;
            }

            // Converter valores para números (podem vir como string ou Decimal do MySQL)
            const precoAnterior = parseFloat(product.PrecoAnterior) || 0;
            const precoAtual = parseFloat(product.PrecoAtual) || 0;
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
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`ver_produto_${product.Id}`)
                        .setLabel('Ver Produto')
                        .setStyle(ButtonStyle.Primary),
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
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`ver_produto_${product.Id}_disabled`)
                        .setLabel('Ver Produto')
                        .setStyle(ButtonStyle.Primary)
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
                    .setName('login')
                    .setDescription('Faz login na sua conta PromoPing')
                    .addStringOption(option =>
                        option.setName('email')
                            .setDescription('Seu email')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('senha')
                            .setDescription('Sua senha')
                            .setRequired(true)),
                new SlashCommandBuilder()
                    .setName('registar')
                    .setDescription('Cria uma nova conta PromoPing')
                    .addStringOption(option =>
                        option.setName('email')
                            .setDescription('Seu email')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('senha')
                            .setDescription('Sua senha (mínimo 6 caracteres)')
                            .setRequired(true)),
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
                    .setDescription('Deixa uma avaliação sobre o site, bot ou suporte')
            ].map(command => command.toJSON());

            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

            // Registrar comandos globalmente
            await rest.put(
                Routes.applicationCommands(this.client.user.id),
                { body: commands }
            );

            console.log(`[DISCORD] ${commands.length} comandos de barra registrados com sucesso.`);
        } catch (error) {
            console.error('[DISCORD] Erro ao registrar comandos de barra:', error);
        }
    }

    async handleSlashCommand(interaction) {
        try {
            const commandName = interaction.commandName;
            
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

            // Criar uma mensagem simulada para compatibilidade com comandos existentes
            let replied = false;
            const fakeMessage = {
                author: interaction.user,
                member: interaction.member,
                guild: interaction.guild,
                channel: interaction.channel,
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

    async disconnect() {
        try {
            await this.client.destroy();
            // Bot desconectado - log silencioso
        } catch (error) {
            console.error('[DISCORD] Erro ao desconectar o bot:', error);
        }
    }
}

module.exports = PromoPingBot;
