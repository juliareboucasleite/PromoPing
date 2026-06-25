const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const mysql = require('../../mysql2-compat');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

module.exports = {
    name: 'news',
    aliases: ['noticias', 'news-config'],
    description: 'Configura o sistema de notícias automáticas sobre categorias monitoradas.',
    execute: async (client, message, args, botInstance) => {
        try {
            // Verificar permissões de administrador
            if (!botInstance.isAdmin(message.member)) {
                return await message.channel.send('❌ Você precisa de permissões de administrador para usar este comando.');
            }

            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'papv5',
                port: parseInt(process.env.DB_PORT) || 5432
            };

            const connection = await mysql.createConnection(dbConfig);

            const action = args[0]?.toLowerCase();

            if (!action || action === 'status' || action === 'info') {
                // Mostrar status da configuração
                const [configs] = await connection.execute(
                    "SELECT * FROM news_config WHERE IsActive = 1 LIMIT 1"
                );

                const embed = new EmbedBuilder()
                    .setTitle('📰 Configuração de Notícias')
                    .setDescription('Sistema de notícias automáticas sobre categorias monitoradas')
                    .setColor(0x5865F2)
                    .setTimestamp();

                if (configs.length === 0) {
                    embed.addFields({
                        name: 'Status',
                        value: '❌ Sistema não configurado',
                        inline: false
                    });
                    embed.addFields({
                        name: 'Como configurar',
                        value: 'Use `!news configurar <canal-id>` para ativar o sistema de notícias.',
                        inline: false
                    });
                } else {
                    const config = configs[0];
                    const channelId = config.ChannelId || config.channelid || process.env.DISCORD_NEWS_CHANNEL_ID;
                    const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;
                    
                    embed.addFields(
                        { name: 'Status', value: '✅ Sistema ativo', inline: true },
                        { name: 'Canal', value: channel ? `<#${channelId}>` : `Canal não encontrado (${channelId || 'n/d'})`, inline: true },
                        { name: 'Frequência', value: `${config.CheckInterval || 60} minutos`, inline: true }
                    );
                    embed.addFields({
                        name: 'Categorias Monitoradas',
                        value: config.MonitoredCategories || 'Todas as categorias',
                        inline: false
                    });
                }

                await connection.end();
                return await message.channel.send({ embeds: [embed] });

            } else if (action === 'configurar' || action === 'config') {
                // Configurar canal de notícias
                const defaultChannelId = process.env.DISCORD_NEWS_CHANNEL_ID || '1442932093184245821';
                let channelId = (args[1] || defaultChannelId).replace(/[<#>]/g, '').trim();
                // Verificar se o canal existe
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (!channel) {
                    await connection.end();
                    return await message.channel.send('❌ Canal não encontrado! Verifique o ID do canal.');
                }

                // Verificar se o bot tem permissão para enviar mensagens no canal
                const botMember = channel.guild.members.cache.get(client.user.id);
                if (!botMember || !channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
                    await connection.end();
                    return await message.channel.send('❌ O bot não tem permissão para enviar mensagens nesse canal!');
                }

                // Criar tabela se não existir (alinhada com sql/PAPv5.postgres.sql)
                await connection.execute(`
                    CREATE TABLE IF NOT EXISTS news_config (
                        Id SERIAL PRIMARY KEY,
                        ChannelId VARCHAR(50) NOT NULL,
                        CheckInterval INTEGER DEFAULT 60,
                        MonitoredCategories TEXT,
                        MinImpactScore INTEGER DEFAULT 7,
                        IsActive INTEGER DEFAULT 1,
                        LastCheck TIMESTAMP NULL,
                        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Verificar se já existe configuração
                const [existing] = await connection.execute(
                    "SELECT Id FROM news_config WHERE IsActive = 1 LIMIT 1"
                );

                if (existing.length > 0) {
                    await connection.execute(
                        'UPDATE news_config SET ChannelId = ?, IsActive = 1, UpdatedAt = NOW() WHERE Id = ?',
                        [channelId, existing[0].Id]
                    );
                } else {
                    await connection.execute(
                        'INSERT INTO news_config (ChannelId, IsActive) VALUES (?, 1)',
                        [channelId]
                    );
                }

                const embed = new EmbedBuilder()
                    .setTitle('✅ Canal de Notícias Configurado')
                    .setDescription('O sistema de notícias foi configurado com sucesso!')
                    .addFields(
                        { name: 'Canal', value: `<#${channelId}>`, inline: true },
                        { name: 'Status', value: '✅ Ativo', inline: true }
                    )
                    .setColor(0x00ff00)
                    .setTimestamp();

                await connection.end();
                return await message.channel.send({ embeds: [embed] });

            } else if (action === 'testar' || action === 'test') {
                // Testar envio de notícia
                const [configs] = await connection.execute(
                    "SELECT * FROM news_config WHERE IsActive = 1 LIMIT 1"
                );

                if (configs.length === 0) {
                    await connection.end();
                    return await message.channel.send('❌ Sistema de notícias não configurado! Use `!news configurar <canal-id>` primeiro.');
                }

                const config = configs[0];
                const channelId = config.ChannelId || config.channelid || process.env.DISCORD_NEWS_CHANNEL_ID;
                const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;
                
                if (!channel) {
                    await connection.end();
                    return await message.channel.send('❌ Canal de notícias não encontrado!');
                }

                // Criar notícia de teste
                const testEmbed = new EmbedBuilder()
                    .setTitle('📰 Notícia de Teste - Tecnologia')
                    .setDescription('Esta é uma notícia de teste para verificar o sistema de notícias automáticas.')
                    .addFields(
                        { name: 'Categoria', value: 'Tecnologia', inline: true },
                        { name: 'Impacto', value: 'Alto (8/10)', inline: true },
                        { name: 'Fonte', value: 'Teste', inline: true }
                    )
                    .setColor(0x5865F2)
                    .setTimestamp()
                    .setFooter({ text: 'PromoPing - Notícias Automáticas' });

                await channel.send({ embeds: [testEmbed] });
                await connection.end();
                return await message.channel.send('✅ Notícia de teste enviada no canal de notícias!');

            } else if (action === 'desativar' || action === 'disable') {
                // Desativar sistema
                await connection.execute(
                    'UPDATE news_config SET IsActive = 0 WHERE IsActive = 1'
                );

                const embed = new EmbedBuilder()
                    .setTitle('⏸️ Sistema Desativado')
                    .setDescription('O sistema de notícias foi desativado.')
                    .setColor(0xff9900)
                    .setTimestamp();

                await connection.end();
                return await message.channel.send({ embeds: [embed] });

            } else {
                await connection.end();
                return await message.channel.send(
                    '❌ Ação inválida!\n\n' +
                    '**Ações disponíveis:**\n' +
                    '• `status` - Mostra status da configuração\n' +
                    '• `configurar <canal-id>` - Configura canal de notícias\n' +
                    '• `testar` - Envia uma notícia de teste\n' +
                    '• `desativar` - Desativa o sistema\n\n' +
                    '**Exemplo:** `!news configurar 123456789012345678`'
                );
            }

        } catch (error) {
            console.error('[DISCORD] Erro no comando news:', error);
            return await message.channel.send('❌ Ocorreu um erro ao processar o comando. Tente novamente.');
        }
    }
};

