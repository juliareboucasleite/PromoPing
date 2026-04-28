const { PermissionFlagsBits } = require('discord.js');
const { successEmbed, resolveMember } = require('../_helpers');

module.exports = {
    name: 'kick',
    aliases: ['expulsar'],
    description: 'Expulsa um membro do servidor.',
    usage: '!kick <@utilizador|id> [motivo]',
    category: 'Moderation',
    slash: {
        options: [
            { type: 6, name: 'utilizador', description: 'Membro a expulsar', required: true },
            { type: 3, name: 'motivo', description: 'Motivo do kick', required: false },
        ],
    },
    execute: async (client, message, args, bot) => {
        if (!message.guild) return message.reply('Este comando só funciona em servidores.');
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('Não tens permissão para expulsar membros.');
        }
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('Não tenho permissão para expulsar membros.');
        }

        const target = await resolveMember(message, args[0]);
        if (!target) {
            const prefix = await bot.getGuildPrefix(message.guild.id);
            return message.reply(`Uso: \`${prefix}kick <@utilizador|id> [motivo]\``);
        }
        if (target.id === message.author.id) return message.reply('Não te podes expulsar a ti próprio.');
        if (!target.kickable) return message.reply('Não consigo expulsar este membro.');
        if (
            target.roles.highest.position >= message.member.roles.highest.position
            && message.guild.ownerId !== message.member.id
        ) {
            return message.reply('Não podes expulsar alguém com cargo igual ou superior ao teu.');
        }

        const motivo = args.slice(1).join(' ').trim() || 'Sem motivo indicado.';
        await target.send({ content: `Foste expulso de **${message.guild.name}**. Motivo: ${motivo}` }).catch(() => {});
        try {
            await target.kick(`Kick por ${message.author.tag}: ${motivo}`.slice(0, 512));
        } catch (error) {
            return message.reply(`Falha ao expulsar: ${error.message}`);
        }

        await message.reply({
            embeds: [successEmbed('Membro expulso', [
                `**Utilizador:** ${target.user.tag} (\`${target.id}\`)`,
                `**Motivo:** ${motivo}`,
                `**Por:** ${message.author.tag}`,
            ])],
        });
    },
};
