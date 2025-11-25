const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'ticket',
    aliases: ['setup-ticket', 'config-ticket'],
    description: 'Configura o sistema de tickets. Escolha o canal onde o botão de abrir ticket aparecerá. (Apenas administradores)',
    execute: async (client, message, args, botInstance) => {
        try {
            // Verificar se o comando foi usado em um servidor
            if (!message.guild) {
                return message.reply(' **Este comando só pode ser usado em um servidor!**');
            }

            // Verificar se o usuário é administrador
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Sem Permissão')
                    .setDescription('Apenas administradores podem configurar o sistema de tickets!')
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
                    return message.reply(' **Canal inválido!** Mencione um canal de texto válido ou use o comando no canal desejado.\n**Exemplo:** `!ticket #suporte`');
                }
            }

            // Criar embed de suporte
            const supportEmbed = new EmbedBuilder()
                .setTitle('🎫 Suporte - PromoPing')
                .setDescription('**Precisa de ajuda ou suporte?** Clique no botão abaixo para abrir um ticket. Nossa equipe irá auxiliá-lo o mais breve possível!')
                .setColor(0x5865F2)
                .setTimestamp()
                .setFooter({ text: '©PromoPing • Todos os direitos reservados' });

            // Criar botão
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('abrir_ticket_promoping')
                        .setLabel('Abrir Ticket')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🎫')
                );

            // Enviar mensagem no canal escolhido
            await targetChannel.send({
                embeds: [supportEmbed],
                components: [row]
            });

            // Confirmar configuração
            const confirmEmbed = new EmbedBuilder()
                .setTitle('✅ Sistema de Tickets Configurado!')
                .setDescription(`O botão de abrir ticket foi enviado para ${targetChannel}`)
                .setColor(0x00ff00)
                .setTimestamp();

            await message.reply({ embeds: [confirmEmbed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando ticket:', error);
            await message.reply(' **Erro interno!** Tente novamente em alguns minutos.');
        }
    }
};
