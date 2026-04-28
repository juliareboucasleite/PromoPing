const { PermissionFlagsBits } = require('discord.js');
const { successEmbed, resolveMember } = require('../_helpers');

module.exports = {
    name: 'unmute',
    aliases: ['untimeout', 'removetimeout', 'removemute'],
    description: 'Remove timeout (mute) de um membro.',
    usage: '!unmute <@utilizador>',
    category: 'Moderation',
    slash: {
        options: [
            { type: 6, name: 'utilizador', description: 'Membro', required: true },
        ],
    },
    execute: async (client, message, args, bot) => {
        if (!message.guild) return message.reply('Este comando só funciona em servidores.');
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('Não tens permissão.');
        }
        const target = await resolveMember(message, args[0]);
        if (!target) {
            const prefix = await bot.getGuildPrefix(message.guild.id);
            return message.reply(`Uso: \`${prefix}unmute <@utilizador>\``);
        }
        if (!target.isCommunicationDisabled()) {
            return message.reply('Esse membro não está silenciado.');
        }
        try {
            await target.timeout(null, `Unmute por ${message.author.tag}`);
        } catch (error) {
            return message.reply(`Falha: ${error.message}`);
        }
        await message.reply({ embeds: [successEmbed('Mute removido', [`${target.user.tag} já pode falar novamente.`])] });
    },
};
