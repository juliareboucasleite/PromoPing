const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'counting',
    aliases: ['contagem', 'count'],
    description: 'Gerencia o sistema de contagem no servidor.',
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

            if (!action || action === 'status' || action === 'info') {
                // Mostrar status do sistema de counting
                const [configs] = await connection.execute(
                    'SELECT * FROM counting_config WHERE GuildId = ?',
                    [message.guild.id]
                );

                const embed = new EmbedBuilder()
                    .setTitle('🔢 Sistema de Contagem')
                    .setColor(0x5865F2)
                    .setTimestamp();

                if (configs.length === 0) {
                    embed.setDescription('❌ Sistema de contagem não configurado.')
                        .addFields({
                            name: 'Como configurar',
                            value: 'Use `!counting configurar <canal>` para configurar um canal de contagem.',
                            inline: false
                        });
                } else {
                    const config = configs[0];
                    const channel = message.guild.channels.cache.get(config.ChannelId);
                    
                    embed.setDescription('✅ Sistema de contagem ativo')
                        .addFields(
                            { name: 'Canal', value: channel ? `<#${config.ChannelId}>` : 'Canal não encontrado', inline: true },
                            { name: 'Número Atual', value: config.CurrentNumber?.toString() || '0', inline: true },
                            { name: 'Recorde', value: config.HighScore?.toString() || '0', inline: true },
                            { name: 'Último Usuário', value: config.LastUserId ? `<@${config.LastUserId}>` : 'Ninguém', inline: true }
                        );
                }

                await connection.end();
                return await message.reply({ embeds: [embed] });

            } else if (action === 'configurar' || action === 'config' || action === 'set') {
                // Configurar canal de contagem
                const channelMention = args[1];
                if (!channelMention) {
                    await connection.end();
                    return await message.reply('❌ Por favor, mencione o canal ou forneça o ID.\n**Uso:** `!counting configurar #canal`');
                }

                // Extrair ID do canal da menção ou usar diretamente
                let channelId = channelMention.replace(/[<#>]/g, '');
                const channel = message.guild.channels.cache.get(channelId) || 
                              message.mentions.channels.first();

                if (!channel) {
                    await connection.end();
                    return await message.reply('❌ Canal não encontrado!');
                }

                // Verificar se já existe configuração
                const [existing] = await connection.execute(
                    'SELECT Id FROM counting_config WHERE GuildId = ?',
                    [message.guild.id]
                );

                if (existing.length > 0) {
                    await connection.execute(
                        'UPDATE counting_config SET ChannelId = ?, CurrentNumber = 0, LastUserId = NULL WHERE GuildId = ?',
                        [channel.id, message.guild.id]
                    );
                } else {
                    await connection.execute(
                        'INSERT INTO counting_config (GuildId, ChannelId, CurrentNumber, HighScore) VALUES (?, ?, 0, 0)',
                        [message.guild.id, channel.id]
                    );
                }

                const embed = new EmbedBuilder()
                    .setTitle('✅ Canal de Contagem Configurado')
                    .setDescription(`O canal ${channel} foi configurado para contagem.`)
                    .addFields({
                        name: 'Como funciona',
                        value: '• Os membros devem enviar números em sequência (1, 2, 3...)\n• Cada número deve ser enviado por uma pessoa diferente\n• Se alguém errar, a contagem volta para 0',
                        inline: false
                    })
                    .setColor(0x00ff00)
                    .setTimestamp();

                await connection.end();
                return await message.reply({ embeds: [embed] });

            } else if (action === 'reset' || action === 'zerar') {
                // Resetar contagem
                await connection.execute(
                    'UPDATE counting_config SET CurrentNumber = 0, LastUserId = NULL WHERE GuildId = ?',
                    [message.guild.id]
                );

                await connection.end();
                return await message.reply('✅ Contagem resetada para 0!');

            } else if (action === 'desativar' || action === 'remove') {
                // Desativar sistema de contagem
                await connection.execute(
                    'DELETE FROM counting_config WHERE GuildId = ?',
                    [message.guild.id]
                );

                await connection.end();
                return await message.reply('✅ Sistema de contagem desativado!');

            } else {
                await connection.end();
                return await message.reply(
                    '❌ Ação inválida!\n\n' +
                    '**Ações disponíveis:**\n' +
                    '• `status` - Mostra status do sistema\n' +
                    '• `configurar <canal>` - Configura canal de contagem\n' +
                    '• `reset` - Reseta a contagem para 0\n' +
                    '• `desativar` - Desativa o sistema\n\n' +
                    '**Exemplo:** `!counting configurar #contagem`'
                );
            }

        } catch (error) {
            console.error('[DISCORD] Erro no comando counting:', error);
            return await message.reply('❌ Ocorreu um erro ao processar o comando. Tente novamente.');
        }
    }
};

