const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'fechar-ticket',
    aliases: ['fechar', 'close-ticket', 'encerrar'],
    description: 'Fecha o ticket de suporte atual.',
    execute: async (client, message, args, botInstance) => {
        try {
            // Verificar se o comando foi usado em um servidor
            if (!message.guild) {
                return message.reply(' **Este comando só pode ser usado em um servidor!**');
            }

            const channel = message.channel;
            const userId = message.author.id;

            // Verificar se o canal é um ticket (começa com "ticket-")
            if (!channel.name.startsWith('ticket-')) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Erro')
                    .setDescription('Este comando só pode ser usado em um canal de ticket!')
                    .setColor(0xff0000)
                    .setTimestamp();
                
                return message.reply({ embeds: [embed] });
            }

            // Verificar se o usuário é o criador do ticket ou tem permissões de administrador
            const isTicketOwner = channel.name.includes(message.author.username.toLowerCase().replace(/[^a-z0-9]/g, ''));
            const isAdmin = botInstance.isAdmin(message.member);
            const supportRoleId = process.env.DISCORD_SUPPORT_ROLE_ID;
            const hasSupportRole = supportRoleId && message.member.roles.cache.has(supportRoleId);

            if (!isTicketOwner && !isAdmin && !hasSupportRole) {
                const embed = new EmbedBuilder()
                    .setTitle('Sem Permissão')
                    .setDescription('Apenas o criador do ticket, administradores ou membros da equipe de suporte podem fechar tickets!')
                    .setColor(0xff0000)
                    .setTimestamp();
                
                return message.reply({ embeds: [embed] });
            }

            // Perguntar confirmação
            const confirmEmbed = new EmbedBuilder()
                .setTitle('Confirmar Fechamento')
                .setDescription('Tem certeza que deseja fechar este ticket?\n\nDigite `confirmar` nos próximos **30 segundos** para fechar o ticket.\n\nDigite `cancelar` para cancelar.')
                .setColor(0xffa500)
                .setTimestamp();

            const confirmMessage = await message.reply({ embeds: [confirmEmbed] });

            // Coletar confirmação
            const filter = (response) => {
                return response.author.id === userId && 
                       response.channel.id === channel.id &&
                       (response.content.toLowerCase() === 'confirmar' || response.content.toLowerCase() === 'cancelar');
            };

            const collector = channel.createMessageCollector({ 
                filter, 
                time: 30000, // 30 segundos
                max: 1 
            });

            collector.on('collect', async (response) => {
                if (response.content.toLowerCase() === 'cancelar') {
                    collector.stop('cancelado');
                    return;
                }
                collector.stop('confirmado');
            });

            collector.on('end', async (collected, reason) => {
                try {
                    await confirmMessage.delete().catch(() => {});
                    if (collected.size > 0) {
                        await collected.first().delete().catch(() => {});
                    }

                    if (reason === 'cancelado') {
                        const cancelEmbed = new EmbedBuilder()
                            .setTitle('Fechamento Cancelado')
                            .setDescription('O ticket não foi fechado.')
                            .setColor(0xffa500)
                            .setTimestamp();
                        return message.reply({ embeds: [cancelEmbed] });
                    }

                    if (reason === 'time') {
                        const timeoutEmbed = new EmbedBuilder()
                            .setTitle('Tempo Esgotado')
                            .setDescription('O fechamento do ticket foi cancelado por falta de confirmação.')
                            .setColor(0xff0000)
                            .setTimestamp();
                        return message.reply({ embeds: [timeoutEmbed] });
                    }

                    if (reason !== 'confirmado') {
                        return;
                    }

                    // Salvar referência da categoria antes de deletar
                    const ticketCategory = channel.parent;

                    // Criar embed de fechamento
                    const closeEmbed = new EmbedBuilder()
                        .setTitle('Ticket Fechado')
                        .setDescription(`Este ticket foi fechado por ${message.author}`)
                        .addFields({
                            name: 'Informação',
                            value: 'O canal será deletado em **10 segundos**.',
                            inline: false
                        })
                        .setColor(0xff0000)
                        .setTimestamp()
                        .setFooter({ text: 'PromoPing - Suporte' });

                    await channel.send({ embeds: [closeEmbed] });

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
                                const category = message.guild.channels.cache.get(ticketCategory.id);
                                
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
                    console.error('[DISCORD] Erro ao fechar ticket:', error);
                    await message.reply(' **Erro ao fechar o ticket!** Tente novamente.');
                }
            });

        } catch (error) {
            console.error('[DISCORD] Erro no comando fechar-ticket:', error);
            await message.reply(' **Erro interno!** Tente novamente em alguns minutos.');
        }
    }
};

