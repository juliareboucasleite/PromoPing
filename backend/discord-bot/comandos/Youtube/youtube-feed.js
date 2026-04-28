const mysql = require("../../mysql2-compat");

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
    if (!entryMatch) {
        return null;
    }

    const entry = entryMatch[1];
    const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/i);

    return {
        id: extractTag(entry, "yt:videoId") || extractTag(entry, "id"),
        title: extractTag(entry, "title"),
        author: extractTag(entry, "name") || extractTag(entry, "author"),
        link: linkMatch ? decodeXml(linkMatch[1]) : null,
    };
}

class YoutubeFeed {
    constructor(client, dbConfig) {
        this.client = client;
        this.dbConfig = dbConfig;
    }

    async fetchSubscriptions(connection) {
        const [rows] = await connection.execute(
            `SELECT Id, YoutubeChannelId, DiscordChannelId, PingEveryone, LastVideoId
             FROM youtube_feed_channels
             WHERE IsActive = TRUE
               AND YoutubeChannelId IS NOT NULL
               AND DiscordChannelId IS NOT NULL`
        );

        return rows;
    }

    async fetchLatestVideo(channelId) {
        const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
        if (!response.ok) {
            throw new Error(`YouTube RSS respondeu com ${response.status}`);
        }

        const xml = await response.text();
        return extractLatestVideo(xml);
    }

    async checkyt() {
        let connection;

        try {
            connection = await mysql.createConnection(this.dbConfig);
            const subscriptions = await this.fetchSubscriptions(connection);

            for (const entry of subscriptions) {
                try {
                    const latestVideo = await this.fetchLatestVideo(entry.YoutubeChannelId);
                    if (!latestVideo?.id) {
                        continue;
                    }

                    if (!entry.LastVideoId) {
                        await connection.execute(
                            "UPDATE youtube_feed_channels SET LastVideoId = ?, LastCheckedAt = CURRENT_TIMESTAMP WHERE Id = ?",
                            [latestVideo.id, entry.Id]
                        );
                        continue;
                    }

                    if (entry.LastVideoId === latestVideo.id) {
                        await connection.execute(
                            "UPDATE youtube_feed_channels SET LastCheckedAt = CURRENT_TIMESTAMP WHERE Id = ?",
                            [entry.Id]
                        );
                        continue;
                    }

                    const channel = await this.client.channels.fetch(entry.DiscordChannelId).catch(() => null);
                    if (!channel) {
                        continue;
                    }

                    const message =
                        `${entry.PingEveryone ? "@everyone " : ""}` +
                        `**${latestVideo.author || "Canal YouTube"}** publicou um novo vídeo.\n` +
                        `**${latestVideo.title || "Novo vídeo"}**\n` +
                        `${latestVideo.link || `https://www.youtube.com/watch?v=${latestVideo.id}`}`;

                    await channel.send({
                        content: message,
                        allowedMentions: entry.PingEveryone ? { parse: ["everyone"] } : { parse: [] },
                    });

                    await connection.execute(
                        `UPDATE youtube_feed_channels
                         SET LastVideoId = ?, LastCheckedAt = CURRENT_TIMESTAMP
                         WHERE Id = ?`,
                        [latestVideo.id, entry.Id]
                    );
                } catch (error) {
                    console.error(`[DISCORD] Erro ao processar feed YouTube ${entry.YoutubeChannelId}:`, error.message);
                }
            }
        } catch (error) {
            console.error("[DISCORD] Erro no monitoramento de YouTube:", error.message);
        } finally {
            if (connection) {
                await connection.end().catch(() => {});
            }
        }
    }
}

module.exports = YoutubeFeed;
