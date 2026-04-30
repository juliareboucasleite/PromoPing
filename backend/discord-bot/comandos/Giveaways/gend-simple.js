module.exports = {
    name: "gend",
    aliases: ["giveawayend"],
    description: "Encerra manualmente um giveaway pelo ID da mensagem.",
    category: "Giveaways",
    usage: "!gend <message-id>",
    execute: async (client, message, args, botInstance) => {
        if (!message.guild) {
            return message.reply("Este comando só funciona dentro de um servidor.");
        }

        if (!message.member.permissions.has("ManageGuild")) {
            return message.reply("Precisas da permissão `Gerir Servidor` para encerrar giveaways.");
        }

        const messageId = String(args[0] || "").trim();
        if (!messageId) {
            return message.reply("Usa `!gend <message-id>`.");
        }

        const [rows] = await botInstance.dbPool.execute(
            "SELECT * FROM discord_giveaways WHERE GuildId = ? AND MessageId = ? LIMIT 1",
            [message.guild.id, messageId]
        );

        if (!rows[0]) {
            return message.reply("Não encontrei esse giveaway neste servidor.");
        }

        if (rows[0].Ended) {
            return message.reply("Esse giveaway já foi encerrado. Usa `!greroll` para sortear novamente.");
        }

        const winners = await botInstance.finalizeGiveaway(rows[0]);
        return message.reply(
            winners.length
                ? `Giveaway encerrado com sucesso. Vencedores: ${winners.map((id) => `<@${id}>`).join(", ")}`
                : "Giveaway encerrado, mas ninguém participou."
        );
    },
};
