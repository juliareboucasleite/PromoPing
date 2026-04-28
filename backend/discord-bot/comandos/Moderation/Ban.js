const { PermissionFlagsBits } = require('discord.js');
const { successEmbed, resolveMember } = require('../_helpers');

module.exports = {
    name: 'ban',
    aliases: ['fuckoff', 'fuckban'],
    description: 'Bane um membro do servidor.',
    usage: '!ban <@utilizador|id> [motivo]',
    category: 'Moderation',
    slash: {
        options: [
            { type: 6, name: 'utilizador', description: 'Membro a banir', required: true },
            { type: 3, name: 'motivo', description: 'Motivo do ban', required: false },
        ],
    },
    execute: async (client, message, args, bot) => {
        if (!message.guild) return message.reply('Este comando só funciona em servidores.');
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('Não tens permissão para banir membros.');
        }
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('Não tenho permissão para banir membros.');
        }

        const target = await resolveMember(message, args[0]);
        if (!target) {
            const prefix = await bot.getGuildPrefix(message.guild.id);
            return message.reply(`Uso: \`${prefix}ban <@utilizador|id> [motivo]\``);
        }
        if (target.id === message.author.id) return message.reply('Não te podes banir a ti próprio.');
        if (target.id === client.user.id) return message.reply('Não me posso banir a mim próprio.');
        if (!target.bannable) return message.reply('Não consigo banir este membro (hierarquia ou permissões).');
        if (
            target.roles.highest.position >= message.member.roles.highest.position
            && message.guild.ownerId !== message.member.id
        ) {
            return message.reply('Não podes banir alguém com cargo igual ou superior ao teu.');
        }

        const motivo = args.slice(1).join(' ').trim() || 'Sem motivo indicado.';
        const auditReason = `Ban por ${message.author.tag}: ${motivo}`.slice(0, 512);

        await target.send({ content: `Foste banido de **${message.guild.name}**. Motivo: ${motivo}` }).catch(() => {});
        try {
            await target.ban({ deleteMessageSeconds: 60 * 60 * 24 * 7, reason: auditReason });
        } catch (error) {
            return message.reply(`Falha ao banir: ${error.message}`);
        }

        await message.reply({
            embeds: [successEmbed('Membro banido', [
                `**Utilizador:** ${target.user.tag} (\`${target.id}\`)`,
                `**Motivo:** ${motivo}`,
                `**Por:** ${message.author.tag}`,
            ])],
        });
    },
};
