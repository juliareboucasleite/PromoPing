const { EmbedBuilder } = require('discord.js');
const voiceManager = require('../voice/VoiceManager');

module.exports = {
    name: 'sair',
    aliases: ['leave', 'desconectar', 'dc'],
    description: 'Desconecta o bot do canal de voz e limpa a fila.',
    execute: async (client, message, args, botInstance) => {
        try {
            const guildId = message.guild.id;

            if (!voiceManager.isConnected(guildId)) {
                return await message.reply('O bot não está conectado a nenhum canal de voz!');
            }

            await voiceManager.leave(guildId);

            const embed = new EmbedBuilder()
                .setTitle('👋 Bot desconectado')
                .setDescription('Sai do canal de voz e limpou a fila de músicas.')
                .setColor(0xff0000)
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando sair:', error);
            return await message.reply('❌ ' + error.message);
        }
    }
};
