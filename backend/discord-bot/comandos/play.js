const { EmbedBuilder } = require('discord.js');
const voiceManager = require('../voice/VoiceManager');

module.exports = {
    name: 'play',
    aliases: ['p', 'tocar', 'toca'],
    description: 'Reproduz uma música do YouTube no canal de voz.',
    usage: '!play <URL do YouTube>',
    execute: async (client, message, args, botInstance) => {
        try {
            if (!args[0]) {
                return await message.reply('**Uso:** `!play <URL do YouTube>`\n**Exemplo:** `!play https://www.youtube.com/watch?v=dQw4w9WgXcQ`');
            }

            const url = args[0];
            
            // Verificar se o membro está em um canal de voz
            if (!message.member.voice?.channel) {
                return await message.reply('Você precisa estar em um canal de voz para usar este comando!');
            }

            await message.reply('Carregando música...');

            // Adicionar à fila
            const track = await voiceManager.addToQueue(message.member, url);

            const embed = new EmbedBuilder()
                .setTitle('Música adicionada à fila!')
                .setDescription(`**${track.title}**`)
                .addFields(
                    { name: 'Duração', value: formatDuration(track.duration), inline: true },
                    { name: 'Solicitado por', value: track.requestedBy, inline: true }
                )
                .setThumbnail(track.thumbnail)
                .setColor(0x00ff00)
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando play:', error);
            
            let errorMessage = 'Erro ao reproduzir música.';
            
            if (error.message.includes('URL do YouTube inválida')) {
                errorMessage = 'URL do YouTube inválida! Certifique-se de usar um link válido do YouTube.';
            } else if (error.message.includes('canal de voz')) {
                errorMessage = '❌ ' + error.message;
            } else {
                errorMessage = 'Erro ao processar a música. Verifique se a URL é válida e tente novamente.';
            }

            return await message.reply(errorMessage);
        }
    }
};

function formatDuration(seconds) {
    if (!seconds || seconds === 0) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
