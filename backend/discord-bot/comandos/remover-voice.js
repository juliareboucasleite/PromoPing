const { EmbedBuilder } = require('discord.js');
const voiceManager = require('../voice/VoiceManager');

module.exports = {
    name: 'remover',
    aliases: ['remove', 'remover-musica', 'rm'],
    description: 'Remove uma música da fila.',
    usage: '!remover <número da música>',
    execute: async (client, message, args, botInstance) => {
        try {
            const guildId = message.guild.id;

            if (!voiceManager.isConnected(guildId)) {
                return await message.reply('O bot não está conectado a nenhum canal de voz!');
            }

            if (!args[0]) {
                return await message.reply('**Uso:** `!remover <número>`\n**Exemplo:** `!remover 3` (remove a 3ª música da fila)');
            }

            const index = parseInt(args[0]);

            if (isNaN(index) || index < 1) {
                return await message.reply('Por favor, forneça um número válido!');
            }

            const removed = voiceManager.removeFromQueue(guildId, index);

            const embed = new EmbedBuilder()
                .setTitle('✅ Música removida da fila')
                .setDescription(`**${removed.title}**`)
                .setColor(0xff0000)
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando remover:', error);
            return await message.reply('❌ ' + error.message);
        }
    }
};
