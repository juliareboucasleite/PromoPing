const { EmbedBuilder } = require('discord.js');
const voiceManager = require('../voice/VoiceManager');

module.exports = {
    name: 'lista',
    aliases: ['queue', 'fila', 'fila-de-musicas'],
    description: 'Mostra a fila de músicas atual.',
    execute: async (client, message, args, botInstance) => {
        try {
            const guildId = message.guild.id;

            if (!voiceManager.isConnected(guildId)) {
                return await message.reply('❌ O bot não está conectado a nenhum canal de voz!');
            }

            const queueData = voiceManager.getQueue(guildId);

            if (!queueData || (!queueData.current && queueData.queue.length === 0)) {
                return await message.reply('❌ A fila está vazia!');
            }

            const embed = new EmbedBuilder()
                .setTitle('🎵 Fila de Músicas')
                .setColor(0x0099ff)
                .setTimestamp();

            // Música atual
            if (queueData.current) {
                const status = queueData.isPaused ? '⏸️ Pausada' : '▶️ Tocando';
                embed.addFields({
                    name: `${status} - Agora`,
                    value: `**${queueData.current.title}**\nSolicitado por: ${queueData.current.requestedBy}`,
                    inline: false
                });
            }

            // Próximas músicas
            if (queueData.queue.length > 0) {
                const queueList = queueData.queue
                    .slice(0, 10) // Limitar a 10 músicas
                    .map((track, index) => {
                        const duration = formatDuration(track.duration);
                        return `**${index + 1}.** ${track.title} (${duration}) - ${track.requestedBy}`;
                    })
                    .join('\n');

                const remaining = queueData.queue.length > 10 
                    ? `\n*... e mais ${queueData.queue.length - 10} música(s)*`
                    : '';

                embed.addFields({
                    name: '📋 Próximas Músicas',
                    value: queueList + remaining,
                    inline: false
                });

                embed.setFooter({ text: `Total: ${queueData.queue.length} música(s) na fila` });
            } else {
                embed.setFooter({ text: 'Nenhuma música na fila' });
            }

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando lista:', error);
            return await message.reply('❌ Erro ao exibir a fila. Tente novamente.');
        }
    }
};

function formatDuration(seconds) {
    if (!seconds || seconds === 0) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
