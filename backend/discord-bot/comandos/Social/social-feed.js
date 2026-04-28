const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const mysql = require('../../mysql2-compat');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

module.exports = {
    name: 'social-feed',
    aliases: ['twitch', 'live'],
    description: 'Gerencia notificações de live da Twitch no canal social-feed.',
    execute: async (client, message, args, botInstance) => {
        try {
            // Verificar permissões de administrador
            if (!botInstance.isAdmin(message.member)) {
                return await message.reply('❌ Você precisa de permissões de administrador para usar este comando.');
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

            // ID do canal social-feed
            const SOCIAL_FEED_CHANNEL_ID = '1442931610927366284';
            const channel = await client.channels.fetch(SOCIAL_FEED_CHANNEL_ID);

            if (!channel) {
                await connection.end();
                return await message.reply('❌ Canal social-feed não encontrado!');
            }

            if (!action || action === 'listar' || action === 'list') {
                // Listar canais monitorados
                const [channels] = await connection.execute(
                    'SELECT ChannelName, IsLive, LastLiveCheck FROM twitch_channels ORDER BY ChannelName'
                );

                if (channels.length === 0) {
                    await connection.end();
                    return await message.reply('📋 Nenhum canal da Twitch está sendo monitorado no momento.');
                }

                const embed = new EmbedBuilder()
                    .setTitle('📺 Canais Twitch Monitorados')
                    .setDescription(`Total: **${channels.length}** canal(is)`)
                    .setColor(0x9146ff)
                    .setTimestamp();

                const channelList = channels.map(ch => {
                    const status = ch.IsLive ? '🔴 **AO VIVO**' : '⚫ Offline';
                    const lastCheck = ch.LastLiveCheck 
                        ? new Date(ch.LastLiveCheck).toLocaleString('pt-PT')
                        : 'Nunca';
                    return `**${ch.ChannelName}** - ${status}\n└ Última verificação: ${lastCheck}`;
                }).join('\n\n');

                embed.addFields({
                    name: 'Canais',
                    value: channelList || 'Nenhum canal',
                    inline: false
                });

                await connection.end();
                return await message.reply({ embeds: [embed] });

            } else if (action === 'adicionar' || action === 'add') {
                // Adicionar canal
                const channelInput = args[1];
                if (!channelInput) {
                    await connection.end();
                    return await message.reply('❌ Por favor, forneça o nome do canal da Twitch ou a URL.\n**Uso:** `!social-feed adicionar <nome-do-canal>` ou `!social-feed adicionar https://twitch.tv/nome-do-canal`');
                }

                // Extrair nome do canal (pode ser URL ou nome simples)
                const extractChannelName = (input) => {
                    if (!input) return null;
                    const urlMatch = input.match(/(?:twitch\.tv\/|^)([^\/\s?]+)/i);
                    if (urlMatch) {
                        return urlMatch[1].toLowerCase();
                    }
                    return input.toLowerCase().trim();
                };

                const channelName = extractChannelName(channelInput);
                if (!channelName) {
                    await connection.end();
                    return await message.reply('❌ Nome de canal inválido. Use apenas o nome do canal ou a URL completa.');
                }

                // Verificar se já existe (buscar por nome extraído ou URL completa)
                const [existing] = await connection.execute(
                    'SELECT Id FROM twitch_channels WHERE ChannelName = ? OR ChannelName = ? OR ChannelName LIKE ?',
                    [channelName, channelInput.toLowerCase(), `%${channelName}%`]
                );

                if (existing.length > 0) {
                    await connection.end();
                    return await message.reply(`❌ O canal **${channelName}** já está sendo monitorado.`);
                }

                // Adicionar ao banco (salvar como URL se foi fornecido URL, senão apenas o nome)
                const channelToSave = channelInput.toLowerCase().includes('twitch.tv') 
                    ? channelInput.toLowerCase() 
                    : channelName;
                
                await connection.execute(
                    'INSERT INTO twitch_channels (ChannelName) VALUES (?)',
                    [channelToSave]
                );

                const embed = new EmbedBuilder()
                    .setTitle('✅ Canal Adicionado')
                    .setDescription(`O canal **${channelName}** foi adicionado ao monitoramento.`)
                    .addFields({
                        name: 'Informações',
                        value: `• Canal: **${channelName}**\n• Notificações serão enviadas em: <#${SOCIAL_FEED_CHANNEL_ID}>\n• Verificação automática a cada 5 minutos`,
                        inline: false
                    })
                    .setColor(0x00ff00)
                    .setTimestamp();

                await connection.end();
                return await message.reply({ embeds: [embed] });

            } else if (action === 'remover' || action === 'remove' || action === 'rem') {
                // Remover canal
                const channelInput = args[1];
                if (!channelInput) {
                    await connection.end();
                    return await message.reply('❌ Por favor, forneça o nome do canal da Twitch ou a URL.\n**Uso:** `!social-feed remover <nome-do-canal>`');
                }

                // Extrair nome do canal (pode ser URL ou nome simples)
                const extractChannelName = (input) => {
                    if (!input) return null;
                    const urlMatch = input.match(/(?:twitch\.tv\/|^)([^\/\s?]+)/i);
                    if (urlMatch) {
                        return urlMatch[1].toLowerCase();
                    }
                    return input.toLowerCase().trim();
                };

                const channelName = extractChannelName(channelInput);
                
                // Tentar remover por nome extraído ou URL completa
                const [result] = await connection.execute(
                    'DELETE FROM twitch_channels WHERE ChannelName = ? OR ChannelName = ? OR ChannelName LIKE ?',
                    [channelName, channelInput.toLowerCase(), `%${channelName}%`]
                );

                if (result.affectedRows === 0) {
                    await connection.end();
                    return await message.reply(`❌ O canal **${channelName || channelInput}** não está sendo monitorado.`);
                }

                const embed = new EmbedBuilder()
                    .setTitle('✅ Canal Removido')
                    .setDescription(`O canal **${channelName}** foi removido do monitoramento.`)
                    .setColor(0xff6b6b)
                    .setTimestamp();

                await connection.end();
                return await message.reply({ embeds: [embed] });

            } else if (action === 'verificar' || action === 'check' || action === 'force') {
                // Forçar verificação imediata
                await connection.end();
                await message.reply('🔄 Verificando lives da Twitch agora...');
                
                try {
                    await botInstance.checkTwitchLives();
                    return await message.reply('✅ Verificação concluída!');
                } catch (error) {
                    console.error('[DISCORD] Erro ao forçar verificação:', error);
                    return await message.reply('❌ Erro ao verificar. Veja os logs do bot.');
                }

            } else if (action === 'testar' || action === 'test') {
                // Testar notificação
                const channelName = args[1] || 'leeksxy';
                
                const embed = new EmbedBuilder()
                    .setTitle('🔴 TESTE - Live na Twitch')
                    .setDescription(`**${channelName}** está ao vivo!`)
                    .addFields(
                        { name: 'Canal', value: `[${channelName}](https://twitch.tv/${channelName})`, inline: true },
                        { name: 'Status', value: '🔴 AO VIVO', inline: true },
                        { name: 'Título', value: 'Teste de Notificação', inline: false }
                    )
                    .setColor(0x9146ff)
                    .setThumbnail('https://static-cdn.jtvnw.net/jtv_user_pictures/asmongold-profile_image-f7ddcbd0332f5aa2-300x300.png')
                    .setTimestamp()
                    .setFooter({ text: 'PromoPing - Social Feed' });

                await channel.send({ embeds: [embed] });
                await connection.end();
                return await message.reply('✅ Notificação de teste enviada no canal social-feed!');

            } else {
                await connection.end();
                return await message.reply(
                    '❌ Ação inválida!\n\n' +
                    '**Ações disponíveis:**\n' +
                    '• `listar` - Lista canais monitorados\n' +
                    '• `adicionar <canal>` - Adiciona um canal\n' +
                    '• `remover <canal>` - Remove um canal\n' +
                    '• `verificar` - Força verificação imediata\n' +
                    '• `testar` - Envia uma notificação de teste\n\n' +
                    '**Exemplo:** `!social-feed verificar`'
                );
            }

        } catch (error) {
            console.error('[DISCORD] Erro no comando social-feed:', error);
            return await message.reply('❌ Ocorreu um erro ao processar o comando. Tente novamente.');
        }
    }
};

