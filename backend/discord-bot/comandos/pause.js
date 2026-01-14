const { EmbedBuilder } = require('discord.js');
const voiceManager = require('../voice/VoiceManager');

module.exports = {
    name: 'pause',
    aliases: ['pausar'],
    description: 'Pausa a reprodução da música atual.',
    execute: async (client, message, args, botInstance) => {
        try {
            const guildId = message.guild.id;

            if (!voiceManager.isConnected(guildId)) {
                return await message.reply('❌ O bot não está conectado a nenhum canal de voz!');
            }

            voiceManager.pause(guildId);

            const embed = new EmbedBuilder()
                .setTitle('⏸️ Música pausada')
                .setDescription('Use `!resume` ou `!play` para retomar a reprodução.')
                .setColor(0xffa500)
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando pause:', error);
            return await message.reply('❌ ' + error.message);
        }
    }
};
