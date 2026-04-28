const { PermissionFlagsBits } = require('discord.js');
const { successEmbed } = require('../_helpers');

module.exports = {
    name: 'clear',
    aliases: ['purge', 'limpar'],
    description: 'Apaga mensagens do canal (1-100).',
    usage: '!clear <quantidade>',
    category: 'Moderation',
    slash: {
        options: [
            { type: 4, name: 'quantidade', description: 'Número de mensagens (1-100)', required: true, min_value: 1, max_value: 100 },
        ],
    },
    execute: async (client, message, args, bot) => {
        if (!message.guild) return message.reply('Este comando só funciona em servidores.');
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('Não tens permissão para gerir mensagens.');
        }
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('Não tenho permissão para gerir mensagens.');
        }

        const n = parseInt(args[0], 10);
        if (!Number.isFinite(n) || n < 1 || n > 100) {
            const prefix = await bot.getGuildPrefix(message.guild.id);
            return message.reply(`Uso: \`${prefix}clear <1-100>\``);
        }

        try {
            const deleted = await message.channel.bulkDelete(n + 1, true);
            const reply = await message.channel.send({
                embeds: [successEmbed('Mensagens apagadas', [`Foram apagadas **${Math.max(0, deleted.size - 1)}** mensagens.`])],
            });
            setTimeout(() => reply.delete().catch(() => {}), 5000);
        } catch (error) {
            return message.channel.send(`Falha ao apagar: ${error.message} (mensagens com mais de 14 dias não podem ser apagadas em massa).`);
        }
    },
};
