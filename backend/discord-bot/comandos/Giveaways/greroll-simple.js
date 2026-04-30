module.exports = {
    name: "greroll",
    aliases: ["giveawayreroll"],
    description: "Refaz o sorteio de um giveaway já encerrado.",
    category: "Giveaways",
    usage: "!greroll <message-id> [vencedores]",
    execute: async (client, message, args, botInstance) => {
        if (!message.guild) {
            return message.reply("Este comando só funciona dentro de um servidor.");
        }

        if (!message.member.permissions.has("ManageGuild")) {
            return message.reply("Precisas da permissão `Gerir Servidor` para refazer giveaways.");
        }

        const messageId = String(args[0] || "").trim();
        const winnerCount = args[1] ? Number.parseInt(args[1], 10) : null;
        if (!messageId) {
            return message.reply("Usa `!greroll <message-id> [vencedores]`.");
        }

        const [rows] = await botInstance.dbPool.execute(
            "SELECT * FROM discord_giveaways WHERE GuildId = ? AND MessageId = ? LIMIT 1",
            [message.guild.id, messageId]
        );

        if (!rows[0]) {
            return message.reply("Não encontrei esse giveaway neste servidor.");
        }

        if (!rows[0].Ended) {
            return message.reply("Esse giveaway ainda está ativo. Usa `!gend` primeiro se quiseres encerrá-lo.");
        }

        const winners = await botInstance.finalizeGiveaway(rows[0], {
            reroll: true,
            winnerCount: winnerCount || rows[0].WinnerCount,
        });

        return message.reply(
            winners.length
                ? `Novo sorteio concluído. Vencedores: ${winners.map((id) => `<@${id}>`).join(", ")}`
                : "Novo sorteio concluído, mas ninguém participou."
        );
    },
};
