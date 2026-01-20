const { EmbedBuilder } = require('discord.js');
const voiceManager = require('../voice/VoiceManager');

module.exports = {
    name: 'resume',
    aliases: ['continuar', 'retomar'],
    description: 'Retoma a reprodução da música pausada.',
    execute: async (client, message, args, botInstance) => {
        try {
            const guildId = message.guild.id;

            if (!voiceManager.isConnected(guildId)) {
                return await message.reply('O bot não está conectado a nenhum canal de voz!');
            }

            voiceManager.resume(guildId);

            const embed = new EmbedBuilder()
                .setTitle('▶️ Música retomada')
                .setDescription('A reprodução foi retomada.')
                .setColor(0x00ff00)
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando resume:', error);
            return await message.reply('❌ ' + error.message);
        }
    }
};
