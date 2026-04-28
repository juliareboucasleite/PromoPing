const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

module.exports = {
    name: 'sugerir',
    aliases: ['sugestao', 'suggestion', 'suggest'],
    description: 'Sugere uma nova funcionalidade ou melhoria para o site ou bot. A sugestão será enviada para o painel administrativo.',
    execute: async (client, message, args, botInstance) => {
        try {
            // Sempre mostrar o painel interativo
            const embed = new EmbedBuilder()
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

            return await message.reply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('[DISCORD] Erro no comando sugerir:', error);
            await message.reply('❌ **Erro interno!** Tente novamente em alguns minutos.');
        }
    }
};
