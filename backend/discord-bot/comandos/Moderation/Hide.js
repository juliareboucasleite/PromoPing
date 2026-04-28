const { PermissionFlagsBits } = require('discord.js');
const { successEmbed } = require('../_helpers');

module.exports = {
    name: 'hide',
    aliases: ['vanish'],
    description: 'Esconde o canal de @everyone.',
    usage: '!hide [#canal]',
    category: 'Moderation',
    slash: {
        options: [
            { type: 7, name: 'canal', description: 'Canal a esconder', required: false },
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
                { ViewChannel: false },
                { reason: `Hide por ${message.author.tag}` }
            );
        } catch (error) {
            return message.reply(`Falha ao esconder: ${error.message}`);
        }
        await message.reply({ embeds: [successEmbed('Canal escondido', [`<#${channel.id}> foi escondido de @everyone.`])] });
    },
};
