const { getLinkedUser, setDiscordNotificationPreference } = require('../../utils/discordProductService');

module.exports = {
    name: 'iniciar',
    aliases: ['start', 'on', 'ativar'],
    category: 'Produtos',
    description: 'Ativa alertas de preço por Discord DM.',
    execute: async (client, message) => {
        try {
            const user = await getLinkedUser(message.author.id);
            if (!user) {
                return message.reply('**Não estás ligado ao PromoPing.** Usa `!login` para conectar a tua conta.');
            }

            await setDiscordNotificationPreference(user.ReferenciaID, true);

            await message.reply(
                '**Alertas por Discord ativados.**\n' +
                'O monitoramento de preços é feito automaticamente pela plataforma PromoPing.\n' +
                'Receberás DMs quando houver alterações relevantes nos teus produtos.'
            );

            console.log(`[DISCORD] Alertas Discord ativados por ${message.author.username}`);
        } catch (error) {
            console.error('[DISCORD] Erro no comando iniciar:', error);
            await message.reply('**Erro interno.** Tenta novamente dentro de alguns minutos.');
        }
    },
};
