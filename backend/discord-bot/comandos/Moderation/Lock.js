const { PermissionFlagsBits } = require('discord.js');
const { successEmbed } = require('../_helpers');

module.exports = {
    name: 'lock',
    aliases: ['lockdown'],
    description: 'Tranca o canal, impedindo membros de enviar mensagens.',
    usage: '!lock [#canal]',
    category: 'Moderation',
    slash: {
        options: [
            { type: 7, name: 'canal', description: 'Canal a trancar (default: actual)', required: false },
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
                { SendMessages: false },
                { reason: `Lock por ${message.author.tag}` }
            );
        } catch (error) {
            return message.reply(`Falha ao trancar: ${error.message}`);
        }
        await message.reply({ embeds: [successEmbed('Canal trancado', [`<#${channel.id}> foi trancado por ${message.author.tag}.`])] });
    },
};
