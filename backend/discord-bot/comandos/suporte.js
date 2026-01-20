const { EmbedBuilder } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'suporte',
    aliases: ['support'],
    description: 'Cria um ticket de suporte. Use no privado do bot ou no servidor.',
    execute: async (client, message, args, botInstance) => {
        try {
            // Se for mensagem privada (DM), criar ticket
            if (!message.guild) {
                // Juntar todos os argumentos como mensagem do ticket
                if (args.length === 0) {
                    const embed = new EmbedBuilder()
                        .setTitle('🎫 Criar Ticket de Suporte')
                        .setDescription(
                            'Para criar um ticket, use o comando seguido da sua dúvida ou problema.\n\n' +
                            '**Exemplos com slash command:**\n' +
                            '`/suporte mensagem: Preciso de ajuda com notificações`\n' +
                            '`/suporte mensagem: Tenho um problema ao fazer login`\n\n' +
                            '**Exemplos com comando de texto:**\n' +
                            '`!suporte Preciso de ajuda com notificações`\n' +
                            '`!suporte Tenho um problema ao fazer login`'
                        )
                        .setColor(0x5865F2)
                        .setTimestamp()
                        .setFooter({ text: '©PromoPing • Todos os direitos reservados' });
                    return await message.reply({ embeds: [embed] });
                }

                const ticketMessage = args.join(' ');
                // Criar ticket usando a função do bot
                await botInstance.handleDirectMessageTicket(message, ticketMessage);
                return;
            }

            // Se for no servidor, mostrar informações sobre como criar ticket via DM
            const embed = new EmbedBuilder()
                .setTitle('🎫 Sistema de Suporte via Mensagem Privada')
                .setDescription(
                    '**Como criar um ticket via mensagem privada:**\n\n' +
                    '1. Envie uma mensagem privada para este bot\n' +
                    '2. Use o comando `/suporte` ou `!suporte` seguido da sua dúvida ou problema\n' +
                    '3. Um ticket será criado automaticamente no servidor\n' +
                    '4. Nossa equipe de suporte responderá o mais breve possível\n\n' +
                    '**Exemplos com slash command:**\n' +
                    '`/suporte mensagem: Preciso de ajuda com notificações`\n\n' +
                    '**Exemplos com comando de texto:**\n' +
                    '`!suporte Preciso de ajuda com notificações`\n' +
                    '`!suporte Tenho um problema ao fazer login`'
                )
                .addFields({
                    name: '💡 Dica',
                    value: 'Você também pode usar `/ticket` ou `!ticket` no privado do bot para criar um ticket.',
                    inline: false
                })
                .setColor(0x5865F2)
                .setTimestamp()
                .setFooter({ text: '©PromoPing • Todos os direitos reservados' });

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando suporte:', error);
            await message.reply(' **Erro interno!** Tente novamente em alguns minutos.');
        }
    }
};

