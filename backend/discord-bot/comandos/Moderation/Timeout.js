const { PermissionFlagsBits } = require('discord.js');
const { successEmbed, resolveMember, parseDuration, formatDuration } = require('../_helpers');

const MAX_MS = 28 * 24 * 60 * 60 * 1000;

module.exports = {
    name: 'timeout',
    aliases: ['mute', 'tmute'],
    description: 'Aplica timeout (mute) a um membro.',
    usage: '!timeout <@utilizador> <duração> [motivo]',
    category: 'Moderation',
    slash: {
        options: [
            { type: 6, name: 'utilizador', description: 'Membro', required: true },
            { type: 3, name: 'duracao', description: 'Duração (ex: 10m, 1h, 1d)', required: true },
            { type: 3, name: 'motivo', description: 'Motivo', required: false },
        ],
    },
    execute: async (client, message, args, bot) => {
        if (!message.guild) return message.reply('Este comando só funciona em servidores.');
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('Não tens permissão para silenciar membros.');
        }
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('Não tenho permissão para silenciar membros.');
        }

        const target = await resolveMember(message, args[0]);
        const ms = parseDuration(args[1]);
        if (!target || !ms) {
            const prefix = await bot.getGuildPrefix(message.guild.id);
            return message.reply(`Uso: \`${prefix}timeout <@utilizador> <duração> [motivo]\``);
        }
        if (ms > MAX_MS) return message.reply('Duração máxima é 28 dias.');
        if (target.id === message.author.id) return message.reply('Não te podes silenciar a ti próprio.');
        if (!target.moderatable) return message.reply('Não consigo silenciar este membro.');
        if (
            target.roles.highest.position >= message.member.roles.highest.position
            && message.guild.ownerId !== message.member.id
        ) {
            return message.reply('Não podes silenciar alguém com cargo igual ou superior.');
        }

        const motivo = args.slice(2).join(' ').trim() || 'Sem motivo indicado.';
        try {
            await target.timeout(ms, `Timeout por ${message.author.tag}: ${motivo}`.slice(0, 512));
        } catch (error) {
            return message.reply(`Falha: ${error.message}`);
        }

        await message.reply({
            embeds: [successEmbed('Membro silenciado', [
                `**Utilizador:** ${target.user.tag} (\`${target.id}\`)`,
                `**Duração:** ${formatDuration(ms)}`,
                `**Motivo:** ${motivo}`,
                `**Por:** ${message.author.tag}`,
            ])],
        });
    },
};
