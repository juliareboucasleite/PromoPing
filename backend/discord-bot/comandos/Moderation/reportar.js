const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mysql = require('../../mysql2-compat');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'reportar',
    aliases: ['bug', 'report', 'reportbug'],
    description: 'Reporta um bug ou problema encontrado no sistema. O bug será enviado para o painel administrativo.',
    execute: async (client, message, args, botInstance) => {
        try {
            // Sempre mostrar o painel interativo
            const embed = new EmbedBuilder()
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
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🐛')
                );

            return await message.reply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando reportar:', error);
            await message.reply('**Erro interno!** Tente novamente em alguns minutos.');
        }
    }
};
