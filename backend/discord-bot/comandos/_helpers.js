const { EmbedBuilder } = require('discord.js');
const mysql = require('../mysql2-compat');

const ORANGE = 0xFFA500;

function successEmbed(title, lines = [], { footer, thumbnail } = {}) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(ORANGE)
        .setTimestamp();
    if (lines.length) embed.setDescription(Array.isArray(lines) ? lines.join('\n') : String(lines));
    if (footer) embed.setFooter({ text: footer });
    if (thumbnail) embed.setThumbnail(thumbnail);
    return embed;
}

async function resolveMember(message, raw) {
    if (!raw) return null;
    const id = message.mentions.members.first()?.id
        || raw.replace(/[<@!&>]/g, '').trim();
    if (!/^\d{15,22}$/.test(id)) return null;
    return message.guild.members.fetch(id).catch(() => null);
}

async function resolveUser(client, raw) {
    if (!raw) return null;
    const id = raw.replace(/[<@!>]/g, '').trim();
    if (!/^\d{15,22}$/.test(id)) return null;
    return client.users.fetch(id).catch(() => null);
}

function parseDuration(input) {
    if (!input) return null;
    const m = String(input).trim().match(/^(\d+)\s*(s|seg|m|min|h|hr|d|dia|w|sem)?$/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    const unit = (m[2] || 'm').toLowerCase();
    const map = { s: 1e3, seg: 1e3, m: 6e4, min: 6e4, h: 36e5, hr: 36e5, d: 864e5, dia: 864e5, w: 6048e5, sem: 6048e5 };
    return n * (map[unit] || 6e4);
}

function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h${m % 60 ? ` ${m % 60}min` : ''}`;
    const d = Math.floor(h / 24);
    return `${d}d${h % 24 ? ` ${h % 24}h` : ''}`;
}

function getDbConfig(bot) {
    return bot?.dbConfig || {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'papv5',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
    };
}

async function withDb(bot, fn) {
    const conn = await mysql.createConnection(getDbConfig(bot));
    try {
        return await fn(conn);
    } finally {
        await conn.end().catch(() => {});
    }
}

function isAdminOrOwner(message, bot) {
    if (!message.guild || !message.member) return false;
    if (message.guild.ownerId === message.member.id) return true;
    if (typeof bot?.isAdmin === 'function' && bot.isAdmin(message.member)) return true;
    return message.member.permissions.has('Administrator');
}

function sanitize(text, max = 200) {
    return String(text || '').replace(/[`@]/g, '').slice(0, max);
}

module.exports = {
    ORANGE,
    successEmbed,
    resolveMember,
    resolveUser,
    parseDuration,
    formatDuration,
    getDbConfig,
    withDb,
    isAdminOrOwner,
    sanitize,
};
