const { EmbedBuilder } = require('discord.js');
const mysql = require('../../mysql2-compat');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

function getDbConfig() {
    return {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'papv5',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
    };
}

module.exports = {
    name: 'memes',
    aliases: ['meme-config', 'meme'],
    description: 'Configure automatic meme posts (API League).',
    category: 'Social',
    execute: async (client, message, args, botInstance) => {
        try {
            if (!message.guild) {
                return message.reply('This command can only be used in a server.');
            }

            const action = (args[0] || 'status').toLowerCase();
            const connection = await mysql.createConnection(getDbConfig());

            if (action === 'status' || action === 'info') {
                const [configs] = await connection.execute(
                    'SELECT * FROM meme_config WHERE IsActive = 1 LIMIT 1'
                );
                const embed = new EmbedBuilder()
                    .setTitle('Memes Channel')
                    .setDescription('Automatic memes from [API League](https://api.apileague.com/)')
                    .setColor(0x5865f2)
                    .setTimestamp();

                const hasKey = Boolean(process.env.API_LEAGUE_API_KEY || process.env.APILEAGUE_API_KEY);
                embed.addFields({
                    name: 'API Key',
                    value: hasKey ? 'Configured' : 'Missing — set `API_LEAGUE_API_KEY` in .env',
                    inline: true,
                });

                if (!configs.length) {
                    const fallback = process.env.DISCORD_MEMES_CHANNEL_ID;
                    embed.addFields({
                        name: 'Status',
                        value: fallback
                            ? `Using env channel <#${fallback}> (not saved in DB)`
                            : 'Not configured',
                        inline: false,
                    });
                } else {
                    const config = configs[0];
                    const channelId = config.ChannelId || config.channelid;
                    const channel = channelId
                        ? await client.channels.fetch(channelId).catch(() => null)
                        : null;
                    embed.addFields(
                        { name: 'Status', value: 'Active', inline: true },
                        { name: 'Channel', value: channel ? `<#${channelId}>` : channelId || 'n/a', inline: true },
                        { name: 'Interval', value: `${config.CheckInterval || 180} min`, inline: true },
                        { name: 'Max meme age', value: `${config.MaxAgeDays || 30} days`, inline: true }
                    );
                }

                await connection.end();
                return message.reply({ embeds: [embed] });
            }

            if (!botInstance.isAdmin(message.member)) {
                await connection.end();
                return message.reply('Only administrators can configure the meme system.');
            }

            if (action === 'test' || action === 'now') {
                await connection.end();
                if (typeof botInstance.postRandomMeme === 'function') {
                    const ok = await botInstance.postRandomMeme(
                        process.env.DISCORD_MEMES_CHANNEL_ID || message.channel.id,
                        { force: true, skipDedup: true }
                    );
                    return message.reply(
                        ok
                            ? 'Random meme posted to the memes channel.'
                            : 'Could not post a meme. Check `API_LEAGUE_API_KEY` and channel permissions.'
                    );
                }
                return message.reply('Meme service is not loaded on the bot.');
            }

            if (action === 'configure' || action === 'config' || action === 'setup') {
                const defaultChannel = process.env.DISCORD_MEMES_CHANNEL_ID || '1442932408239259912';
                const channelId = (args[1] || defaultChannel).replace(/[<#>]/g, '').trim();
                const interval = Math.max(30, parseInt(args[2], 10) || 180);
                const maxAge = Math.max(1, parseInt(args[3], 10) || 30);

                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (!channel?.isTextBased?.()) {
                    await connection.end();
                    return message.reply('Invalid channel. Example: `!memes configure #memes 180`');
                }

                await connection.execute(`
                    CREATE TABLE IF NOT EXISTS meme_config (
                        Id INT AUTO_INCREMENT PRIMARY KEY,
                        ChannelId VARCHAR(50) NOT NULL,
                        CheckInterval INT DEFAULT 180,
                        MaxAgeDays INT DEFAULT 30,
                        IsActive INT DEFAULT 1,
                        LastCheck TIMESTAMP NULL,
                        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                `);

                const [existing] = await connection.execute(
                    'SELECT Id FROM meme_config WHERE IsActive = 1 LIMIT 1'
                );

                if (existing.length) {
                    await connection.execute(
                        `UPDATE meme_config SET ChannelId = ?, CheckInterval = ?, MaxAgeDays = ?, IsActive = 1,
                         LastCheck = NULL, UpdatedAt = NOW() WHERE Id = ?`,
                        [channelId, interval, maxAge, existing[0].Id || existing[0].id]
                    );
                } else {
                    await connection.execute(
                        'INSERT INTO meme_config (ChannelId, CheckInterval, MaxAgeDays, IsActive) VALUES (?, ?, ?, 1)',
                        [channelId, interval, maxAge]
                    );
                }

                await connection.end();

                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Memes configured')
                            .setDescription(
                                `Channel: ${channel}\n` +
                                `Interval: every **${interval}** minutes\n` +
                                `Meme max age: **${maxAge}** days`
                            )
                            .setColor(0x57f287)
                            .setTimestamp(),
                    ],
                });
            }

            await connection.end();
            return message.reply(
                '**Commands:**\n' +
                '`!memes status` — show config\n' +
                '`!memes test` — post one meme now\n' +
                '`/meme` — random meme with **New Meme** button\n' +
                '`!memes configure #channel [minutes] [max-age-days]` — setup'
            );
        } catch (error) {
            console.error('[DISCORD] memes command error:', error);
            return message.reply('Internal error. Please try again.');
        }
    },
};
