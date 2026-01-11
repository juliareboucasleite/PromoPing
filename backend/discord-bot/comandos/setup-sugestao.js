const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'setup-sugestao',
    aliases: ['config-sugestao', 'setup-sugerir', 'config-sugerir'],
    description: 'Configura o painel de sugestões. Escolha o canal onde o botão de sugerir aparecerá. (Apenas administradores)',
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
                    .setDescription('Apenas administradores podem configurar o painel de sugestões!')
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
                    return message.reply(' **Canal inválido!** Mencione um canal de texto válido ou use o comando no canal desejado.\n**Exemplo:** `!setup-sugestao #sugestoes`');
                }
            }

            // Criar embed do painel de sugestões
            const sugestaoPanelEmbed = new EmbedBuilder()
                .setTitle('Sugerir Funcionalidade')
                .setDescription(
                    '**Tem uma ideia para melhorar o PromoPing?**\n\n' +
                    'Clique no botão abaixo para abrir o formulário de sugestão.\n\n' +
                    '**O que você pode sugerir:**\n' +
                    '• Novas funcionalidades para o site\n' +
                    '• Melhorias no bot Discord\n' +
                    '• Recursos adicionais\n' +
                    '• Melhorias de interface\n\n' +
                    '**Sua sugestão será enviada diretamente para o painel administrativo!**'
                )
                .setColor(0x3B82F6)
                .setTimestamp()
                .setFooter({ text: '©PromoPing • Todos os direitos reservados' });

            // Criar botão para abrir o modal
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('abrir_formulario_sugestao')
                        .setLabel('Sugerir Funcionalidade')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('💡')
                );

            // Enviar mensagem no canal escolhido
            await targetChannel.send({
                embeds: [sugestaoPanelEmbed],
                components: [row]
            });

            // Confirmar configuração
            const confirmEmbed = new EmbedBuilder()
                .setTitle('Painel de Sugestões Configurado!')
                .setDescription(`O painel de sugestões foi enviado para ${targetChannel}`)
                .setColor(0x00ff00)
                .setTimestamp();

            await message.reply({ embeds: [confirmEmbed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando setup-sugestao:', error);
            await message.reply(' **Erro interno!** Tente novamente em alguns minutos.');
        }
    }
};
