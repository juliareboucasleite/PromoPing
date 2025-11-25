const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'announcements',
    aliases: ['anuncios', 'github', 'release'],
    description: 'Gerencia notificações de releases do GitHub no canal announcements.',
    execute: async (client, message, args, botInstance) => {
        try {
            // Verificar permissões de administrador
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await message.reply('❌ Você precisa de permissões de administrador para usar este comando.');
            }

            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'pap',
                port: parseInt(process.env.DB_PORT) || 3306
            };

            const connection = await mysql.createConnection(dbConfig);
            const action = args[0]?.toLowerCase();

            // ID do canal announcements
            const ANNOUNCEMENTS_CHANNEL_ID = '1442931993888428143';
            const channel = await client.channels.fetch(ANNOUNCEMENTS_CHANNEL_ID);

            if (!channel) {
                await connection.end();
                return await message.reply('❌ Canal announcements não encontrado!');
            }

            if (!action || action === 'status' || action === 'info') {
                // Mostrar status da configuração
                const [configs] = await connection.execute(
                    'SELECT * FROM webhook_configs WHERE Type = ? AND IsActive = TRUE',
                    ['github']
                );

                const embed = new EmbedBuilder()
                    .setTitle('📢 Configuração de Announcements')
                    .setDescription('Notificações de releases do GitHub')
                    .setColor(0x24292e)
                    .setTimestamp();

                if (configs.length === 0) {
                    embed.addFields({
                        name: 'Status',
                        value: '❌ Webhook não configurado',
                        inline: false
                    });
                } else {
                    const config = configs[0];
                    embed.addFields(
                        { name: 'Status', value: '✅ Webhook configurado', inline: true },
                        { name: 'Ativo', value: config.IsActive ? '✅ Sim' : '❌ Não', inline: true },
                        { name: 'Canal', value: `<#${ANNOUNCEMENTS_CHANNEL_ID}>`, inline: true }
                    );
                    embed.addFields({
                        name: 'Webhook URL',
                        value: config.WebhookUrl ? `\`${config.WebhookUrl.substring(0, 50)}...\`` : 'Não configurado',
                        inline: false
                    });
                }

                embed.addFields({
                    name: 'Canal de Notificações',
                    value: `<#${ANNOUNCEMENTS_CHANNEL_ID}>`,
                    inline: false
                });

                await connection.end();
                return await message.reply({ embeds: [embed] });

            } else if (action === 'configurar' || action === 'config') {
                // Configurar webhook URL (opcional - pode ser feito manualmente no GitHub)
                const webhookUrl = args[1];
                
                if (!webhookUrl) {
                    await connection.end();
                    return await message.reply(
                        '❌ Por favor, forneça a URL do webhook.\n**Uso:** `!announcements configurar <webhook-url>`'
                    );
                }

                // Verificar se já existe configuração
                const [existing] = await connection.execute(
                    'SELECT Id FROM webhook_configs WHERE Type = ?',
                    ['github']
                );

                if (existing.length > 0) {
                    await connection.execute(
                        'UPDATE webhook_configs SET WebhookUrl = ?, IsActive = TRUE WHERE Type = ?',
                        [webhookUrl, 'github']
                    );
                } else {
                    await connection.execute(
                        'INSERT INTO webhook_configs (Type, WebhookUrl, IsActive) VALUES (?, ?, TRUE)',
                        ['github', webhookUrl]
                    );
                }

                const embed = new EmbedBuilder()
                    .setTitle('✅ Webhook Configurado')
                    .setDescription('A configuração do webhook foi salva.')
                    .addFields({
                        name: 'Informações',
                        value: `• Tipo: GitHub Releases\n• Canal: <#${ANNOUNCEMENTS_CHANNEL_ID}>\n• Status: Ativo`,
                        inline: false
                    })
                    .setColor(0x00ff00)
                    .setTimestamp();

                await connection.end();
                return await message.reply({ embeds: [embed] });

            } else if (action === 'testar' || action === 'test') {
                // Testar notificação de release
                const embed = new EmbedBuilder()
                    .setTitle('🚀 Nova Release - TESTE')
                    .setDescription('**v2.4.0** foi lançada!')
                    .addFields(
                        { name: 'Repositório', value: '[PromoPing](https://github.com/seu-usuario/PromoPing)', inline: true },
                        { name: 'Tag', value: 'v2.4.0', inline: true },
                        { name: 'Autor', value: 'Teste', inline: true },
                        { name: 'Notas da Release', value: 'Esta é uma notificação de teste para verificar o sistema de announcements.', inline: false }
                    )
                    .setColor(0x24292e)
                    .setThumbnail('https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png')
                    .setTimestamp()
                    .setFooter({ text: 'PromoPing - GitHub Releases' });

                await channel.send({ embeds: [embed] });
                await connection.end();
                return await message.reply('✅ Notificação de teste enviada no canal announcements!');

            } else {
                await connection.end();
                return await message.reply(
                    '❌ Ação inválida!\n\n' +
                    '**Ações disponíveis:**\n' +
                    '• `status` - Mostra status da configuração\n' +
                    '• `configurar <url>` - Configura webhook URL (opcional)\n' +
                    '• `testar` - Envia uma notificação de teste\n\n' +
                    '**Exemplo:** `!announcements status`'
                );
            }

        } catch (error) {
            console.error('[DISCORD] Erro no comando announcements:', error);
            return await message.reply('❌ Ocorreu um erro ao processar o comando. Tente novamente.');
        }
    }
};

