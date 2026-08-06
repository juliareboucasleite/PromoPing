const { getLinkedUser, setDiscordNotificationPreference } = require('../../utils/discordProductService');

module.exports = {
    name: 'parar',
    aliases: ['stop', 'off', 'desativar'],
    category: 'Produtos',
    description: 'Desativa alertas de preço por Discord DM.',
    execute: async (client, message) => {
        try {
            const user = await getLinkedUser(message.author.id);
            if (!user) {
                return message.reply('**Não estás ligado ao PromoPing.** Usa `!login` para conectar a tua conta.');
            }

            await setDiscordNotificationPreference(user.ReferenciaID, false);

            await message.reply(
                '**Alertas por Discord desativados.**\n' +
                'Os teus produtos continuam a ser monitorizados no site.\n' +
                'Usa `!iniciar` quando quiseres voltar a receber DMs.'
            );

            console.log(`[DISCORD] Alertas Discord desativados por ${message.author.username}`);
        } catch (error) {
            console.error('[DISCORD] Erro no comando parar:', error);
            await message.reply('**Erro interno.** Tenta novamente dentro de alguns minutos.');
        }
    },
};
