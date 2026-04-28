const mysql = require("../../mysql2-compat");

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "papv5",
    port: parseInt(process.env.DB_PORT, 10) || 5432,
};

function extractChannelId(input) {
    const value = String(input || "").trim();
    if (!value) return null;

    if (!value.startsWith("http")) {
        return value;
    }

    const match = value.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/i);
    return match ? match[1] : null;
}

function parseBooleanFlag(input) {
    const value = String(input || "").trim().toLowerCase();
    if (!value) return false;
    return ["true", "1", "yes", "sim", "on"].includes(value);
}

function decodeXml(value) {
    return String(value || "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function extractTag(source, tagName) {
    const match = source.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
    return match ? decodeXml(match[1].trim()) : null;
}

function extractLatestVideo(xml) {
    const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/i);
    if (!entryMatch) return null;

    const entry = entryMatch[1];
    const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/i);

    return {
        id: extractTag(entry, "yt:videoId") || extractTag(entry, "id"),
        title: extractTag(entry, "title"),
        author: extractTag(entry, "name") || extractTag(entry, "author"),
        link: linkMatch ? decodeXml(linkMatch[1]) : null,
    };
}

async function fetchLatestVideo(channelId) {
    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
    if (!response.ok) {
        throw new Error(`YouTube RSS respondeu com ${response.status}`);
    }

    const xml = await response.text();
    const latestVideo = extractLatestVideo(xml);
    if (!latestVideo?.id) {
        throw new Error("Canal inválido ou sem vídeos públicos.");
    }

    return latestVideo;
}

module.exports = {
    name: "youtube",
    aliases: ["ytnotifier", "ytchannel"],
    description: "Ativa ou desativa notificações de novos vídeos de um canal do YouTube.",
    usage: "!youtube <status|enable|disable> [canal-youtube] [#canal-discord] [everyone]",
    execute: async (client, message, args) => {
        if (!message.guild) {
            return message.reply("Este comando só funciona dentro de um servidor.");
        }

        if (!message.member.permissions.has("Administrator")) {
            return message.reply("Precisas de permissões de administrador para gerir notificações do YouTube.");
        }

        const subcommand = String(args[0] || "status").toLowerCase();
        const connection = await mysql.createConnection(dbConfig);

        try {
            if (subcommand === "status") {
                const [rows] = await connection.execute(
                    `SELECT YoutubeChannelId, DiscordChannelId, PingEveryone, LastVideoId, IsActive
                     FROM youtube_feed_channels
                     WHERE DiscordChannelId IS NOT NULL
                       AND IsActive = TRUE
                     ORDER BY Id ASC`
                );

                if (rows.length === 0) {
                    return message.reply(
                        "Nenhuma notificação de YouTube está ativa.\n" +
                        "Uso: `!youtube enable <youtube-channel-id|url /channel/...> <#canal> [true|false]`"
                    );
                }

                const lines = rows.map((row, index) =>
                    `${index + 1}. Canal YouTube: \`${row.YoutubeChannelId}\` | Discord: <#${row.DiscordChannelId}> | Ping everyone: **${row.PingEveryone ? "Sim" : "Não"}**`
                );

                return message.reply(lines.join("\n"));
            }

            if (subcommand === "disable") {
                const [result] = await connection.execute(
                    `UPDATE youtube_feed_channels
                     SET IsActive = FALSE, UpdatedAt = CURRENT_TIMESTAMP
                     WHERE DiscordChannelId = ?
                       AND IsActive = TRUE`,
                    [message.channel.id]
                );

                if (!result.affectedRows) {
                    return message.reply("Não encontrei nenhuma configuração ativa de YouTube para este canal de Discord.");
                }

                return message.reply("As notificações de YouTube foram desativadas para este canal.");
            }

            if (subcommand !== "enable") {
                return message.reply(
                    "Subcomando inválido.\n" +
                    "`!youtube status`\n" +
                    "`!youtube enable <youtube-channel-id|url /channel/...> <#canal> [true|false]`\n" +
                    "`!youtube disable`"
                );
            }

            const channelIdInput = args[1];
            const discordChannel = message.mentions.channels.first() || message.guild.channels.cache.get(args[2]);
            const pingEveryone = parseBooleanFlag(args[3]);
            const youtubeChannelId = extractChannelId(channelIdInput);

            if (!youtubeChannelId) {
                return message.reply(
                    "Canal de YouTube inválido.\n" +
                    "Usa o ID do canal ou uma URL no formato `https://www.youtube.com/channel/UC...`."
                );
            }

            if (!discordChannel) {
                return message.reply("Menciona um canal de Discord válido para receber os avisos.");
            }

            const latestVideo = await fetchLatestVideo(youtubeChannelId);

            const [existing] = await connection.execute(
                `SELECT Id
                 FROM youtube_feed_channels
                 WHERE YoutubeChannelId = ?
                   AND DiscordChannelId = ?
                 LIMIT 1`,
                [youtubeChannelId, discordChannel.id]
            );

            if (existing.length > 0) {
                await connection.execute(
                    `UPDATE youtube_feed_channels
                     SET PingEveryone = ?, LastVideoId = ?, IsActive = TRUE, UpdatedAt = CURRENT_TIMESTAMP
                     WHERE Id = ?`,
                    [pingEveryone, latestVideo.id, existing[0].Id]
                );
            } else {
                await connection.execute(
                    `INSERT INTO youtube_feed_channels
                     (YoutubeChannelId, DiscordChannelId, PingEveryone, LastVideoId, IsActive)
                     VALUES (?, ?, ?, ?, TRUE)`,
                    [youtubeChannelId, discordChannel.id, pingEveryone, latestVideo.id]
                );
            }

            return message.reply(
                `Notificações de YouTube ativadas.\n` +
                `Canal YouTube: \`${youtubeChannelId}\`\n` +
                `Canal Discord: ${discordChannel}\n` +
                `Ping everyone: **${pingEveryone ? "Sim" : "Não"}**\n` +
                `Último vídeo base: **${latestVideo.title || latestVideo.id}**`
            );
        } catch (error) {
            console.error("[DISCORD] Erro no comando youtube:", error.message);
            return message.reply(`Não consegui configurar o YouTube: ${error.message}`);
        } finally {
            await connection.end().catch(() => {});
        }
    },
};
