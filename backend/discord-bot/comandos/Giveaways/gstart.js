const { EmbedBuilder } = require("discord.js");
const { formatDuration, parseDuration, successEmbed } = require("../_helpers");

module.exports = {
    name: "gstart",
    aliases: ["giveawaystart"],
    description: "Inicia um giveaway simples no canal atual.",
    category: "Giveaways",
    usage: "!gstart <tempo> <vencedores> <prémio>",
    execute: async (client, message, args, botInstance) => {
        if (!message.guild) {
            return message.reply("Este comando só funciona dentro de um servidor.");
        }

        if (!message.member.permissions.has("ManageGuild")) {
            return message.reply("Precisas da permissão `Gerir Servidor` para iniciar giveaways.");
        }

        const durationMs = parseDuration(args[0]);
        const winnerCount = Number.parseInt(args[1], 10);
        const prize = args.slice(2).join(" ").trim();

        if (!durationMs || durationMs < 30000) {
            return message.reply("Usa um tempo válido, por exemplo `30s`, `10m`, `2h` ou `1d`.");
        }

        if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 20) {
            return message.reply("O número de vencedores deve estar entre 1 e 20.");
        }

        if (!prize) {
            return message.reply("Indica o prémio do giveaway.");
        }

        const endsAt = new Date(Date.now() + durationMs);
        const embed = new EmbedBuilder()
            .setTitle("Giveaway Ativo")
            .setDescription([
                `Prémio: **${prize}**`,
                `Vencedores: **${winnerCount}**`,
                `Termina: <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
                "Reage com 🎉 para participar.",
            ].join("\n"))
            .setColor(0xf59e0b)
            .setTimestamp();

        const giveawayMessage = await message.channel.send({ embeds: [embed] });
        await giveawayMessage.react("🎉").catch(() => {});

        await botInstance.dbPool.execute(
            `INSERT INTO discord_giveaways
                (GuildId, ChannelId, MessageId, HostUserId, Prize, WinnerCount, ReactionEmoji, EndsAt, Ended)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
            [
                message.guild.id,
                message.channel.id,
                giveawayMessage.id,
                message.author.id,
                prize.slice(0, 255),
                winnerCount,
                "🎉",
                endsAt,
            ]
        );

        return message.reply({
            embeds: [successEmbed("Giveaway Criado", [
                `Mensagem: ${giveawayMessage.url}`,
                `Duração: **${formatDuration(durationMs)}**`,
                `Prémio: **${prize}**`,
                `Vencedores: **${winnerCount}**`,
            ])],
        });
    },
};
