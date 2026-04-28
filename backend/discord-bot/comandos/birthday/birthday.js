const path = require("path");
const mysql = require("../../mysql2-compat");

require("dotenv").config({ path: path.join(__dirname, "../../../../.env") });

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "papv5",
    port: parseInt(process.env.DB_PORT, 10) || 5432,
};

function isValidDateString(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function sanitizeMessageTemplate(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "Happy Birthday, {user}!";
    return trimmed.slice(0, 220);
}

async function replyLines(message, lines) {
    return message.reply(lines.join("\n"));
}

async function getSettings(connection, guildId) {
    const [rows] = await connection.execute(
        "SELECT * FROM discord_birthday_settings WHERE GuildId = ? LIMIT 1",
        [guildId]
    );

    if (rows.length > 0) {
        return rows[0];
    }

    const [result] = await connection.execute(
        `INSERT INTO discord_birthday_settings (GuildId, Enabled, MessageTemplate)
         VALUES (?, FALSE, ?)`,
        [guildId, "Happy Birthday, {user}!"]
    );

    return result.rows?.[0] || {
        GuildId: guildId,
        Enabled: false,
        ChannelId: null,
        RoleId: null,
        MessageTemplate: "Happy Birthday, {user}!",
    };
}

module.exports = {
    name: "birthday",
    aliases: ["bday"],
    description: "Gerencia aniversários dos utilizadores e as definições do servidor.",
    execute: async (client, message, args) => {
        if (!message.guild) {
            return message.reply("Este comando só funciona dentro de um servidor.");
        }

        const connection = await mysql.createConnection(dbConfig);

        try {
            const sub = String(args[0] || "status").toLowerCase();
            const guildId = message.guild.id;
            const userId = message.author.id;

            if (sub === "set") {
                const date = args[1];
                if (!isValidDateString(date)) {
                    return replyLines(message, ["Usa o formato `YYYY-MM-DD`, por exemplo `2001-09-17`."]);
                }

                await connection.execute(
                    `INSERT INTO discord_birthdays (GuildId, UserId, BirthdayDate)
                     VALUES (?, ?, ?)
                     ON CONFLICT (GuildId, UserId)
                     DO UPDATE SET BirthdayDate = EXCLUDED.BirthdayDate, UpdatedAt = CURRENT_TIMESTAMP`,
                    [guildId, userId, date]
                );

                return replyLines(message, [`O teu aniversário ficou definido para **${date}**.`]);
            }

            if (sub === "check") {
                const target = message.mentions.users.first() || message.author;
                const [rows] = await connection.execute(
                    "SELECT BirthdayDate FROM discord_birthdays WHERE GuildId = ? AND UserId = ? LIMIT 1",
                    [guildId, target.id]
                );

                if (rows.length === 0) {
                    return replyLines(message, ["Esse utilizador ainda não definiu um aniversário."]);
                }

                return replyLines(message, [`**${target.username}** tem o aniversário definido para **${rows[0].BirthdayDate}**.`]);
            }

            if (sub === "remove") {
                await connection.execute(
                    "DELETE FROM discord_birthdays WHERE GuildId = ? AND UserId = ?",
                    [guildId, userId]
                );
                return replyLines(message, ["O teu aniversário guardado foi removido."]);
            }

            if (["channel", "role", "message", "toggle", "status"].includes(sub)) {
                if (!message.member.permissions.has("Administrator")) {
                    return replyLines(message, ["Só administradores podem gerir as definições de aniversário do servidor."]);
                }
            }

            if (sub === "channel") {
                const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
                if (!channel) {
                    return replyLines(message, ["Menciona um canal válido."]);
                }

                await connection.execute(
                    "UPDATE discord_birthday_settings SET ChannelId = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE GuildId = ?",
                    [channel.id, guildId]
                );

                return replyLines(message, [`Os avisos de aniversário serão enviados em ${channel}.`]);
            }

            if (sub === "role") {
                const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
                if (!role) {
                    return replyLines(message, ["Menciona um cargo válido."]);
                }

                await connection.execute(
                    "UPDATE discord_birthday_settings SET RoleId = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE GuildId = ?",
                    [role.id, guildId]
                );

                return replyLines(message, [`O cargo de aniversário ficou definido para **${role.name}**.`]);
            }

            if (sub === "message") {
                const customMessage = sanitizeMessageTemplate(args.slice(1).join(" "));
                await connection.execute(
                    "UPDATE discord_birthday_settings SET MessageTemplate = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE GuildId = ?",
                    [customMessage, guildId]
                );

                return replyLines(message, [`A mensagem de aniversário foi atualizada para: ${customMessage}`]);
            }

            if (sub === "toggle") {
                const state = String(args[1] || "").toLowerCase();
                if (!["on", "off", "enable", "disable"].includes(state)) {
                    return replyLines(message, ["Usa `birthday toggle on` ou `birthday toggle off`."]);
                }

                const enabled = ["on", "enable"].includes(state);
                await connection.execute(
                    "UPDATE discord_birthday_settings SET Enabled = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE GuildId = ?",
                    [enabled, guildId]
                );

                return replyLines(message, [`Os avisos de aniversário estão agora **${enabled ? "ativos" : "desativados"}**.`]);
            }

            const settings = await getSettings(connection, guildId);
            return replyLines(message, [
                `Ativo: **${settings.Enabled ? "Sim" : "Não"}**`,
                `Canal: ${settings.ChannelId ? `<#${settings.ChannelId}>` : "Não configurado"}`,
                `Cargo: ${settings.RoleId ? `<@&${settings.RoleId}>` : "Não configurado"}`,
                `Mensagem: ${settings.MessageTemplate || "Não configurada"}`,
            ]);
        } catch (error) {
            console.error("[DISCORD] Erro no comando birthday:", error);
            return message.reply("Ocorreu um erro ao executar o comando de aniversário.");
        } finally {
            await connection.end().catch(() => {});
        }
    },
};
