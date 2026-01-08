const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// Configuração do banco de dados
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pap',
    port: parseInt(process.env.DB_PORT) || 3306
};

// Variável para evitar inserções duplicadas
const savingReviews = new Set();

module.exports = {
    name: 'review',
    aliases: ['avaliar', 'avaliação', 'feedback'],
    description: 'Deixa uma avaliação sobre o site, bot ou suporte. Pode escolher ser anónimo.',
    execute: async (client, message, args, botInstance) => {
        try {
            // Verificar se o comando foi usado em um servidor
            if (!message.guild) {
                return message.reply('Este comando só pode ser usado em um servidor!');
            }

            const userId = message.author.id;
            const userName = message.author.username;
            const userAvatar = message.author.displayAvatarURL({ dynamic: true });

            // Criar embed inicial
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

            // Enviar mensagem inicial
            const initialMessage = await message.reply({
                embeds: [initialEmbed],
                components: [row],
                ephemeral: false
            });

            // Configurar collector para o menu de seleção
            const filter = (interaction) => {
                return interaction.user.id === userId && 
                       interaction.customId === `review_tipo_${userId}`;
            };

            const collector = message.channel.createMessageComponentCollector({
                filter,
                time: 60000, // 1 minuto
                max: 1
            });

            collector.on('collect', async (interaction) => {
                try {
                    const selectedValue = interaction.values[0];
                    const tipo = selectedValue.split('_')[0]; // site, bot, ou suporte
                    
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

                    await interaction.update({
                        embeds: [anonimoEmbed],
                        components: [anonimoRow]
                    });

                    // Configurar collector para escolha de anonimato
                    const anonimoFilter = (btnInteraction) => {
                        return btnInteraction.user.id === userId && 
                               (btnInteraction.customId.startsWith(`review_anonimo_sim_${tipo}_${userId}`) ||
                                btnInteraction.customId.startsWith(`review_anonimo_nao_${tipo}_${userId}`));
                    };

                    const anonimoCollector = message.channel.createMessageComponentCollector({
                        filter: anonimoFilter,
                        time: 60000,
                        max: 1
                    });

                    anonimoCollector.on('collect', async (btnInteraction) => {
                        try {
                            const isAnonimo = btnInteraction.customId.includes('anonimo_sim');
                            
                            // Perguntar pela avaliação e rating
                            const avaliacaoEmbed = new EmbedBuilder()
                                .setTitle('Avaliação')
                                .setDescription(
                                    `**Avaliando:** ${tipoNomes[tipo]}\n**Anónimo:** ${isAnonimo ? 'Sim' : 'Não'}\n\n` +
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

                            await btnInteraction.update({
                                embeds: [avaliacaoEmbed],
                                components: []
                            });

                            // Aguardar resposta do utilizador
                            const textoFilter = (msg) => {
                                if (msg.author.id !== userId) return false;
                                
                                // Verificar se é comando review-texto
                                if (msg.content.startsWith('!review-texto ')) return true;
                                
                                // Verificar se é resposta à mensagem
                                if (msg.reference) {
                                    const referencedMsgId = msg.reference.messageId;
                                    if (referencedMsgId === initialMessage.id || 
                                        referencedMsgId === btnInteraction.message?.id) {
                                        return true;
                                    }
                                }
                                
                                return false;
                            };

                            const textoCollector = message.channel.createMessageCollector({
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
                                    const starMatch = reviewText.match(/(\d+)\s*[⭐🌟]/); // ainda permite o usuário digitar "5 ⭐"
                                    if (starMatch) {
                                        rating = parseInt(starMatch[1]);
                                        rating = Math.max(1, Math.min(5, rating)); // Limitar entre 1-5
                                        reviewText = reviewText.replace(/(\d+)\s*[⭐🌟]/, '').trim();
                                    }

                                    // Criar embed final da review
                                    const reviewEmbed = new EmbedBuilder()
                                        .setTitle(`Avaliação - ${tipoNomes[tipo]}`)
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
                                        reviewsChannel = await client.channels.fetch(reviewsChannelId).catch(() => null);
                                    }

                                    // Se não encontrar pelo ID, procurar por nome
                                    if (!reviewsChannel) {
                                        reviewsChannel = message.guild.channels.cache.find(
                                            channel => channel.name === 'reviews' && channel.type === 0
                                        );
                                    }

                                    // Salvar avaliação no banco de dados
                                    let savedReviewId = null;
                                    let discordMessageId = null;
                                    let discordChannelId = null;

                                    // Flag para evitar inserção duplicada
                                    const reviewKey = `${userId}_${tipo}`;
                                    if (savingReviews.has(reviewKey)) {
                                        return;
                                    }
                                    savingReviews.add(reviewKey);

                                    try {
                                        const connection = await mysql.createConnection(dbConfig);
                                        
                                        // Buscar ReferenciaID do usuário pelo discord_id
                                        const [users] = await connection.execute(
                                            'SELECT ReferenciaID FROM utilizadores WHERE discord_id = ?',
                                            [userId]
                                        );

                                        if (users.length === 0) {
                                            await connection.end();
                                            savingReviews.delete(reviewKey);
                                            await reviewMessage.reply('Você precisa estar registado no sistema. Use `/registar` primeiro.');
                                            return;
                                        }

                                        const referenciaID = users[0].ReferenciaID;

                                        // Verificar se já existe uma review recente (últimos 5 minutos) do mesmo usuário e tipo
                                        const [existingReviews] = await connection.execute(
                                            'SELECT Id FROM reviews WHERE ReferenciaID = ? AND Tipo = ? AND CreatedAt > DATE_SUB(NOW(), INTERVAL 5 MINUTE)',
                                            [referenciaID, tipo]
                                        );

                                        if (existingReviews.length > 0) {
                                            await connection.end();
                                            savingReviews.delete(reviewKey);
                                            await reviewMessage.reply('Você já enviou uma avaliação recentemente. Aguarde alguns minutos.');
                                            return;
                                        }

                                        // Enviar mensagem para o canal de reviews primeiro para obter o message ID
                                        let sentMessage = null;
                                        if (reviewsChannel) {
                                            sentMessage = await reviewsChannel.send({ embeds: [reviewEmbed] });
                                            discordMessageId = sentMessage.id;
                                            discordChannelId = reviewsChannel.id;
                                        } else {
                                            sentMessage = await message.channel.send({ embeds: [reviewEmbed] });
                                            discordMessageId = sentMessage.id;
                                            discordChannelId = message.channel.id;
                                        }

                                        // Salvar no banco de dados usando apenas as colunas existentes
                                        const [result] = await connection.execute(`
                                            INSERT INTO reviews (
                                                ReferenciaID, 
                                                Tipo, 
                                                Texto, 
                                                Rating, 
                                                IsAnonimo
                                            ) VALUES (?, ?, ?, ?, ?)
                                        `, [
                                            referenciaID,
                                            tipo,
                                            reviewText || '',
                                            rating,
                                            isAnonimo ? 1 : 0
                                        ]);

                                        savedReviewId = result.insertId;
                                        await connection.end();
                                        savingReviews.delete(reviewKey);
                                        console.log(`[DISCORD] Avaliação salva no banco de dados (ID: ${savedReviewId})`);
                                    } catch (dbError) {
                                        savingReviews.delete(reviewKey);
                                        console.error('[DISCORD] Erro ao salvar avaliação no banco:', dbError);
                                        // Continuar mesmo se falhar ao salvar no banco
                                        
                                        // Enviar mensagem mesmo se falhar ao salvar
                                        if (reviewsChannel) {
                                            await reviewsChannel.send({ embeds: [reviewEmbed] });
                                        } else {
                                            await message.channel.send({ embeds: [reviewEmbed] });
                                        }
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
                                        await message.author.send({ embeds: [confirmEmbed] });
                                    } catch (dmError) {
                                        // Se não conseguir enviar DM, enviar no canal mas deletar após alguns segundos
                                        const confirmMsg = await message.channel.send({ 
                                            content: `${message.author} - Sua avaliação foi enviada!`,
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

                                    // Deletar mensagem inicial se possível
                                    try {
                                        await initialMessage.delete().catch(() => {});
                                    } catch {}

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
                                    
                                    message.channel.send({ embeds: [timeoutEmbed] }).catch(() => {});
                                }
                            });

                        } catch (error) {
                            console.error('[DISCORD] Erro ao processar escolha de anonimato:', error);
                            await btnInteraction.reply({ 
                                content: 'Erro ao processar sua escolha. Tente novamente.', 
                                ephemeral: true 
                            });
                        }
                    });

                    anonimoCollector.on('end', (collected) => {
                        if (collected.size === 0) {
                            const timeoutEmbed = new EmbedBuilder()
                                .setTitle('Tempo Esgotado')
                                .setDescription('Você não escolheu se deseja ser anónimo a tempo. Use `!review` novamente para começar.')
                                .setColor(0xff0000)
                                .setTimestamp();
                            
                            message.channel.send({ embeds: [timeoutEmbed] }).catch(() => {});
                        }
                    });

                } catch (error) {
                    console.error('[DISCORD] Erro ao processar seleção de tipo:', error);
                    await interaction.reply({ 
                        content: 'Erro ao processar sua seleção. Tente novamente.', 
                        ephemeral: true 
                    });
                }
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle('Tempo Esgotado')
                        .setDescription('Você não selecionou o que deseja avaliar a tempo. Use `!review` novamente para começar.')
                        .setColor(0xff0000)
                        .setTimestamp();
                    
                    message.channel.send({ embeds: [timeoutEmbed] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('[DISCORD] Erro no comando review:', error);
            await message.reply('Erro interno! Tente novamente em alguns minutos.');
        }
    }
};
