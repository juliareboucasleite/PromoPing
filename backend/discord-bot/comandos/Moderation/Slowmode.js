const { PermissionFlagsBits } = require('discord.js');
const { successEmbed, parseDuration, formatDuration } = require('../_helpers');

module.exports = {
    name: 'slowmode',
    aliases: ['slow'],
    description: 'Define o slowmode do canal (segundos ou 0 para desligar).',
    usage: '!slowmode <segundos|0>',
    category: 'Moderation',
    slash: {
        options: [
            { type: 4, name: 'segundos', description: 'Slowmode (0 desliga, max 21600)', required: true, min_value: 0, max_value: 21600 },
        ],
    },
    execute: async (client, message, args, bot) => {
        if (!message.guild) return message.reply('Este comando só funciona em servidores.');
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('Não tens permissão para gerir canais.');
        }
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('Não tenho permissão para gerir canais.');
        }

        let secs = parseInt(args[0], 10);
        if (!Number.isFinite(secs)) {
            const ms = parseDuration(args[0]);
            secs = ms ? Math.floor(ms / 1000) : NaN;
        }
        if (!Number.isFinite(secs) || secs < 0 || secs > 21600) {
            const prefix = await bot.getGuildPrefix(message.guild.id);
            return message.reply(`Uso: \`${prefix}slowmode <0-21600 seg>\``);
        }

        try {
            await message.channel.setRateLimitPerUser(secs, `Slowmode por ${message.author.tag}`);
        } catch (error) {
            return message.reply(`Falha: ${error.message}`);
        }

        await message.reply({
            embeds: [successEmbed('Slowmode actualizado', [
                secs === 0 ? 'Slowmode desligado.' : `Slowmode: **${formatDuration(secs * 1000)}**`,
            ])],
        });
    },
};
