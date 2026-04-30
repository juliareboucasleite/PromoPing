const { successEmbed } = require("../_helpers");

module.exports = {
    name: "glist",
    aliases: ["giveawaylist"],
    description: "Lista os giveaways ativos deste servidor.",
    category: "Giveaways",
    usage: "!glist",
    execute: async (client, message, args, botInstance) => {
        if (!message.guild) {
            return message.reply("Este comando só funciona dentro de um servidor.");
        }

        const [rows] = await botInstance.dbPool.execute(
            `SELECT *
               FROM discord_giveaways
              WHERE GuildId = ?
              ORDER BY Ended ASC, EndsAt ASC
              LIMIT 10`,
            [message.guild.id]
        );

        if (!rows.length) {
            return message.reply("Ainda não há giveaways registados neste servidor.");
        }

        const lines = rows.map((row, index) => (
            `${index + 1}. **${row.Prize}** • mensagem \`${row.MessageId}\` • ${row.Ended ? "encerrado" : `termina <t:${Math.floor(new Date(row.EndsAt).getTime() / 1000)}:R>`}`
        ));

        return message.reply({
            embeds: [successEmbed("Giveaways", lines)],
        });
    },
};
