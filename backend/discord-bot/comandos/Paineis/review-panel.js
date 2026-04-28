const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

module.exports = {
    name: 'review-panel',
    aliases: ['painel-review', 'setup-review'],
    description: 'Configura o painel de avaliações no canal. Escolha o canal onde o painel aparecerá. (Apenas administradores)',
    execute: async (client, message, args, botInstance) => {
        try {
            // Verificar se o comando foi usado em um servidor
            if (!message.guild) {
                return message.reply('Este comando só pode ser usado em um servidor!');
            }

            // Verificar se o usuário é administrador
            if (!botInstance.isAdmin(message.member)) {
                const embed = new EmbedBuilder()
                    .setTitle('Sem Permissão')
                    .setDescription('Apenas administradores podem configurar o painel de avaliações!')
                    .setColor(0xff0000)
                    .setTimestamp();
                
                return message.reply({ embeds: [embed] });
            }

            // Verificar se foi mencionado um canal
            let targetChannel = message.channel; // Canal padrão é o atual

            if (args.length > 0) {
                // Tentar encontrar o canal mencionado
                const channelMention = args[0];
                const channelId = channelMention.replace(/[<#>]/g, '');
                
                const mentionedChannel = message.guild.channels.cache.get(channelId);
                if (mentionedChannel && mentionedChannel.type === ChannelType.GuildText) {
                    targetChannel = mentionedChannel;
                } else {
                    return message.reply('Canal inválido! Mencione um canal de texto válido ou use o comando no canal desejado.\n**Exemplo:** `!review-panel #reviews`');
                }
            }

            // Criar embed do painel de reviews
            const reviewPanelEmbed = new EmbedBuilder()
                .setTitle('Sistema de Avaliações - PromoPing')
                .setDescription(
                    '**Deixe sua avaliação sobre nossos serviços!**\n\n' +
                    'Avalie o **Site**, **Bot** ou **Suporte** e ajude-nos a melhorar.\n\n' +
                    '**Como funciona:**\n' +
                    '1. Clique no botão abaixo\n' +
                    '2. Escolha o que deseja avaliar\n' +
                    '3. Decida se quer ser anónimo\n' +
                    '4. Envie sua avaliação\n\n' +
                    '**Você pode incluir uma nota de 1 a 5 estrelas na sua avaliação!**'
                )
                .setColor(0xffa500)
                .addFields({
                    name: 'Comandos Disponíveis',
                    value: '`!review` - Iniciar avaliação\n`/review` - Iniciar avaliação (slash command)',
                    inline: false
                })
                .setTimestamp()
                .setFooter({ text: '©PromoPing • Todos os direitos reservados' });

            // Criar botão para iniciar avaliação
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('iniciar_review_promoping')
                        .setLabel('Deixar Avaliação')
                        .setStyle(ButtonStyle.Primary)
                );

            // Enviar mensagem no canal escolhido
            await targetChannel.send({
                embeds: [reviewPanelEmbed],
                components: [row]
            });

            // Confirmar configuração
            const confirmEmbed = new EmbedBuilder()
                .setTitle('Painel de Avaliações Configurado!')
                .setDescription(`O painel de avaliações foi enviado para ${targetChannel}`)
                .setColor(0x00ff00)
                .setTimestamp();

            await message.reply({ embeds: [confirmEmbed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando review-panel:', error);
            await message.reply('Erro interno! Tente novamente em alguns minutos.');
        }
    }
};

