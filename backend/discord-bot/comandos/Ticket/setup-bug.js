const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'setup-bug',
    aliases: ['config-bug', 'setup-reportar', 'config-reportar'],
    description: 'Configura o painel de reportar bugs. Escolha o canal onde o botão de reportar bug aparecerá. (Apenas administradores)',
    execute: async (client, message, args, botInstance) => {
        try {
            // Verificar se o comando foi usado em um servidor
            if (!message.guild) {
                return message.reply(' **Este comando só pode ser usado em um servidor!**');
            }

            // Verificar se o usuário é administrador
            if (!botInstance.isAdmin(message.member)) {
                const embed = new EmbedBuilder()
                    .setTitle('Sem Permissão')
                    .setDescription('Apenas administradores podem configurar o painel de reportar bugs!')
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
                    return message.reply(' **Canal inválido!** Mencione um canal de texto válido ou use o comando no canal desejado.\n**Exemplo:** `!setup-bug #reportar-bugs`');
                }
            }

            // Criar embed do painel de reportar bugs
            const bugPanelEmbed = new EmbedBuilder()
                .setTitle('Reportar Bug')
                .setDescription(
                    '**Encontrou um bug ou problema?**\n\n' +
                    'Clique no botão abaixo para abrir o formulário de reporte.\n\n' +
                    '**O que você pode reportar:**\n' +
                    '• Bugs e erros no sistema\n' +
                    '• Problemas de funcionalidade\n' +
                    '• Sugestões de melhorias\n\n' +
                    '**Seu reporte será enviado diretamente para o painel administrativo!**'
                )
                .setColor(0xFF6B6B)
                .setTimestamp()
                .setFooter({ text: '©PromoPing • Todos os direitos reservados' });

            // Criar botão para abrir o modal
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('abrir_formulario_bug')
                        .setLabel('Reportar Bug')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🐛')
                );

            // Enviar mensagem no canal escolhido
            await targetChannel.send({
                embeds: [bugPanelEmbed],
                components: [row]
            });

            // Confirmar configuração
            const confirmEmbed = new EmbedBuilder()
                .setTitle('Painel de Reportar Bugs Configurado!')
                .setDescription(`O painel de reportar bugs foi enviado para ${targetChannel}`)
                .setColor(0x00ff00)
                .setTimestamp();

            await message.reply({ embeds: [confirmEmbed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando setup-bug:', error);
            await message.reply(' **Erro interno!** Tente novamente em alguns minutos.');
        }
    }
};
