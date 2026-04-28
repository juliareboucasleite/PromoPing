const { PermissionFlagsBits } = require('discord.js');
const { successEmbed } = require('../_helpers');

module.exports = {
    name: 'unlock',
    aliases: ['destrancar'],
    description: 'Destranca o canal, permitindo membros enviarem mensagens.',
    usage: '!unlock [#canal]',
    category: 'Moderation',
    slash: {
        options: [
            { type: 7, name: 'canal', description: 'Canal a destrancar (default: actual)', required: false },
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

        const channel = message.mentions.channels.first() || message.channel;
        try {
            await channel.permissionOverwrites.edit(
                message.guild.roles.everyone,
                { SendMessages: null },
                { reason: `Unlock por ${message.author.tag}` }
            );
        } catch (error) {
            return message.reply(`Falha ao destrancar: ${error.message}`);
        }
        await message.reply({ embeds: [successEmbed('Canal destrancado', [`<#${channel.id}> foi destrancado por ${message.author.tag}.`])] });
    },
};
