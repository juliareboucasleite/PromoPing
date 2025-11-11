const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
                GatewayIntentBits.DirectMessages
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

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Quando o bot se conecta
        this.client.once('ready', () => {
            console.log(`\nBot conectado como ${this.client.user.tag}`);
            console.log(`Servidores: ${this.client.guilds.cache.size}`);
            console.log(`Prefixo atual: ${this.prefix}`);
            console.log(`Comandos carregados: ${comandos.size}`);
            console.log('Sistema de monitoramento inicializado.\n');
            this.startMonitoring();
        });

        // Quando alguém envia uma mensagem
        this.client.on('messageCreate', async (message) => {
            try {
                if (message.author.bot) return; // ignora bots

                // Ignora mensagens sem prefixo
                if (!message.content.startsWith(this.prefix)) return;

                // Extrai comando e argumentos
                const args = message.content.slice(this.prefix.length).trim().split(/ +/);
                const commandName = args.shift().toLowerCase();

                const comando = comandos.get(commandName);
                if (!comando) return;

                console.log(`[DISCORD] Executando comando: ${this.prefix}${commandName}`);

                await comando.execute(this.client, message, args, this);
            } catch (error) {
                console.error(`[DISCORD] Erro ao processar comando:`, error);
                await message.reply('Ocorreu um erro ao executar este comando.');
            }
        });

        this.client.on('error', (error) => {
            console.error('[DISCORD] Erro no bot:', error);
        });
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
        console.log('[DISCORD] Iniciando monitoramento automático de preços...');
        this.isMonitoring = true;

        setInterval(async () => {
            if (this.isMonitoring) {
                await this.checkPriceChanges();
            }
        }, this.checkInterval * 60 * 1000);
    }

    async checkPriceChanges() {
        try {
            const connection = await mysql.createConnection(this.dbConfig);
            const [rows] = await connection.execute(`
                SELECT p.Id, p.Nome, p.Link, p.PrecoAtual, p.PrecoAlvo, p.UserId,
                       u.discord_id as DiscordId, hp.Preco as PrecoAnterior, hp.DataRegisto as UpdatedAt
                FROM produtos p
                JOIN utilizadores u ON p.UserId = u.Id
                LEFT JOIN historicoprecos hp ON p.Id = hp.ProdutoId
                WHERE hp.DataRegisto > ?
                AND u.discord_id IS NOT NULL AND u.discord_id != ''
                ORDER BY hp.DataRegisto DESC
            `, [this.lastCheck]);

            console.log(`[DISCORD] Verificando ${rows.length} alterações de preço...`);
            
            // Enviar notificações para cada mudança de preço
            for (const product of rows) {
                await this.sendPriceNotification(product);
            }
            
            this.lastCheck = new Date();
            await connection.end();
        } catch (error) {
            console.error('[DISCORD] Erro ao consultar o banco de dados:', error);
        }
    }

    async sendPriceNotification(product) {
        try {
            const user = await this.client.users.fetch(product.DiscordId);
            if (!user) {
                console.log(`[DISCORD] Usuário ${product.DiscordId} não encontrado`);
                return;
            }

            const priceChange = product.PrecoAtual - product.PrecoAnterior;
            const percentageChange = ((priceChange / product.PrecoAnterior) * 100).toFixed(2);
            
            let color = 0x00ff00; // Verde para diminuição
            let emoji = '';
            let status = 'diminuiu';

            if (priceChange > 0) {
                color = 0xff0000; // Vermelho para aumento
                emoji = '[+]';
                status = 'aumentou';
            }

            // Verificar se atingiu o preço alvo
            if (product.PrecoAtual <= product.PrecoAlvo) {
                color = 0x00bfff; // Azul para meta atingida
                emoji = '[META]';
                status = 'atingiu o preço alvo';
            }

            const embed = new EmbedBuilder()
                .setTitle(`${emoji} Preço ${status}!`)
                .setDescription(`**${product.Nome}**`)
                .addFields(
                    { name: 'Preço Anterior', value: `€${product.PrecoAnterior.toFixed(2)}`, inline: true },
                    { name: 'Preço Atual', value: `€${product.PrecoAtual.toFixed(2)}`, inline: true },
                    { name: 'Diferença', value: `€${priceChange.toFixed(2)} (${percentageChange}%)`, inline: true },
                    { name: 'Preço Alvo', value: `€${product.PrecoAlvo.toFixed(2)}`, inline: true },
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
                        .setStyle(ButtonStyle.Danger)
                    new ButtonBuilder()
                        .setCustomId(`ver_produto_${product.Id}`)
                        .setLabel('Ver Produto')
                        .setStyle(ButtonStyle.Primary)
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

            console.log(`[DISCORD] Notificação enviada para ${user.username} sobre ${product.Nome}`);

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
                'UPDATE produtos SET DeletedAt = ? WHERE Id = ? AND UserId = (SELECT Id FROM utilizadores WHERE discord_id = ?)',
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

            console.log(`[DISCORD] Notificações paradas para ${user.username} - produto ${product.Id}`);

        } catch (error) {
            console.error('[DISCORD] Erro ao parar notificações:', error);
            await interaction.reply({ 
                content: 'Erro ao parar notificações. Tente novamente.', 
                ephemeral: true 
            });
        }
    }

    async handleViewProduct(interaction, product) {
        const embed = new EmbedBuilder()
            .setTitle('Detalhes do Produto')
            .setDescription(`**${product.Nome}**`)
            .addFields(
                { name: 'Preço Atual', value: `€${product.PrecoAtual.toFixed(2)}`, inline: true },
                { name: 'Preço Alvo', value: `€${product.PrecoAlvo.toFixed(2)}`, inline: true },
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
        const embed = new EmbedBuilder()
            .setTitle('Configurações do Produto')
            .setDescription(`**${product.Nome}**`)
            .addFields(
                { name: 'Preço Alvo Atual', value: `€${product.PrecoAlvo.toFixed(2)}`, inline: true },
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

    async disconnect() {
        try {
            await this.client.destroy();
            console.log('[DISCORD] Bot desconectado com sucesso.');
        } catch (error) {
            console.error('[DISCORD] Erro ao desconectar o bot:', error);
        }
    }
}

module.exports = PromoPingBot;
