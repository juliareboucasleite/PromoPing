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
            const action = args[0]?.toLowerCase();
            
            // Para ação de sincronizar, verificar cargo específico
            if (action === 'sincronizar' || action === 'sync') {
                const allowedRoleIds = ['1442655601682419722', '1442937735253065758'];
                const hasAllowedRole = allowedRoleIds.some(roleId => message.member.roles.cache.has(roleId));
                
                if (!hasAllowedRole) {
                    return await message.channel.send('❌ Você não tem permissão para sincronizar releases. Apenas membros com o cargo específico podem usar esta função.');
                }
            } else {
                // Para outras ações, verificar permissões de administrador
                if (!botInstance.isAdmin(message.member)) {
                    return await message.channel.send('❌ Você precisa de permissões de administrador para usar este comando.');
                }
            }

            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'pap',
                port: parseInt(process.env.DB_PORT) || 3306
            };

            const connection = await mysql.createConnection(dbConfig);

            // ID do canal announcements
            const ANNOUNCEMENTS_CHANNEL_ID = '1442931993888428143';
            const channel = await client.channels.fetch(ANNOUNCEMENTS_CHANNEL_ID);

            if (!channel) {
                await connection.end();
                return await message.channel.send('❌ Canal announcements não encontrado!');
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
                return await message.channel.send({ embeds: [embed] });

            } else if (action === 'configurar' || action === 'config') {
                // Configurar webhook URL (opcional - pode ser feito manualmente no GitHub)
                const webhookUrl = args[1];
                
                if (!webhookUrl) {
                    await connection.end();
                    return await message.channel.send(
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
                return await message.channel.send({ embeds: [embed] });

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
                return await message.channel.send('✅ Notificação de teste enviada no canal announcements!');

            } else if (action === 'sincronizar' || action === 'sync') {
                // Sincronizar todas as releases do GitHub
                const loadingMsg = await message.channel.send('🔄 Sincronizando releases do GitHub... Isso pode levar alguns segundos.');
                
                try {
                    // Chamar API de sincronização
                    const syncUrl = process.env.API_URL || 'http://localhost:3000';
                    const response = await fetch(`${syncUrl}/api/webhooks/github/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (!response.ok) {
                        throw new Error(`Erro na API: ${response.status}`);
                    }

                    const result = await response.json();
                    
                    if (result.success) {
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Sincronização Concluída')
                            .setDescription('Todas as releases do GitHub foram sincronizadas.')
                            .addFields(
                                { name: 'Total de Releases', value: result.total.toString(), inline: true },
                                { name: 'Enviadas', value: result.sent.toString(), inline: true },
                                { name: 'Já Processadas', value: result.skipped.toString(), inline: true }
                            )
                            .setColor(0x00ff00)
                            .setTimestamp();
                        
                        await connection.end();
                        await loadingMsg.edit({ content: '', embeds: [embed] });
                        return;
                    } else {
                        await connection.end();
                        await loadingMsg.edit(`❌ Erro ao sincronizar: ${result.error || 'Erro desconhecido'}`);
                        return;
                    }
                } catch (error) {
                    console.error('[DISCORD] Erro ao sincronizar releases:', error);
                    await connection.end();
                    await loadingMsg.edit(`❌ Erro ao sincronizar releases: ${error.message}`).catch(() => {
                        // Se não conseguir editar, enviar nova mensagem
                        message.channel.send(`❌ Erro ao sincronizar releases: ${error.message}`).catch(console.error);
                    });
                    return;
                }

            } else {
                await connection.end();
                return await message.channel.send(
                    '❌ Ação inválida!\n\n' +
                    '**Ações disponíveis:**\n' +
                    '• `status` - Mostra status da configuração\n' +
                    '• `configurar <url>` - Configura webhook URL (opcional)\n' +
                    '• `testar` - Envia uma notificação de teste\n' +
                    '• `sincronizar` - Sincroniza todas as releases do GitHub (requer cargo específico)\n\n' +
                    '**Exemplo:** `!announcements status`'
                );
            }

        } catch (error) {
            console.error('[DISCORD] Erro no comando announcements:', error);
            
            // Registrar erro no banco de dados
            try {
                const dbConfig = {
                    host: process.env.DB_HOST || 'localhost',
                    user: process.env.DB_USER || 'root',
                    password: process.env.DB_PASSWORD || '',
                    database: process.env.DB_NAME || 'pap',
                    port: parseInt(process.env.DB_PORT) || 3306
                };
                const errorConnection = await mysql.createConnection(dbConfig);
                
                // Criar tabela de erros se não existir
                await errorConnection.execute(`
                    CREATE TABLE IF NOT EXISTS discord_errors (
                        Id INT AUTO_INCREMENT PRIMARY KEY,
                        CommandName VARCHAR(100) NOT NULL,
                        ErrorMessage TEXT NOT NULL,
                        StackTrace TEXT,
                        UserId VARCHAR(50),
                        ChannelId VARCHAR(50),
                        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_command (CommandName),
                        INDEX idx_created_at (CreatedAt)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);
                
                // Inserir erro
                await errorConnection.execute(
                    'INSERT INTO discord_errors (CommandName, ErrorMessage, StackTrace, UserId, ChannelId) VALUES (?, ?, ?, ?, ?)',
                    [
                        'announcements',
                        error.message || 'Erro desconhecido',
                        error.stack || '',
                        message.author?.id || null,
                        message.channel?.id || null
                    ]
                );
                
                await errorConnection.end();
            } catch (dbError) {
                console.error('[DISCORD] Erro ao registrar erro no banco:', dbError);
            }
            
            return await message.channel.send('❌ Ocorreu um erro ao processar o comando. Tente novamente.').catch(() => {
                // Se não conseguir enviar, apenas logar
                console.error('[DISCORD] Não foi possível enviar mensagem de erro');
            });
        }
    }
};

