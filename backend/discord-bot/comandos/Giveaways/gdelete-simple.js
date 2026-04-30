module.exports = {
    name: "gdelete",
    aliases: ["giveawaydelete"],
    description: "Apaga o registo de um giveaway e tenta remover a mensagem.",
    category: "Giveaways",
    usage: "!gdelete <message-id>",
    execute: async (client, message, args, botInstance) => {
        if (!message.guild) {
            return message.reply("Este comando só funciona dentro de um servidor.");
        }

        if (!message.member.permissions.has("ManageGuild")) {
            return message.reply("Precisas da permissão `Gerir Servidor` para apagar giveaways.");
        }

        const messageId = String(args[0] || "").trim();
        if (!messageId) {
            return message.reply("Usa `!gdelete <message-id>`.");
        }

        const [rows] = await botInstance.dbPool.execute(
            "SELECT * FROM discord_giveaways WHERE GuildId = ? AND MessageId = ? LIMIT 1",
            [message.guild.id, messageId]
        );

        if (!rows[0]) {
            return message.reply("Não encontrei esse giveaway neste servidor.");
        }

        const row = rows[0];
        const channel = message.guild.channels.cache.get(row.ChannelId)
            || await message.guild.channels.fetch(row.ChannelId).catch(() => null);
        if (channel?.messages?.fetch) {
            const targetMessage = await channel.messages.fetch(row.MessageId).catch(() => null);
            if (targetMessage) {
                await targetMessage.delete().catch(() => {});
            }
        }

        await botInstance.dbPool.execute(
            "DELETE FROM discord_giveaways WHERE MessageId = ?",
            [row.MessageId]
        );

        return message.reply("Giveaway removido.");
    },
};
