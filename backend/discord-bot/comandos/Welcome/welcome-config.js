const { successEmbed } = require("../_helpers");

function normalizeWelcomeText(value) {
    const text = String(value || "").trim();
    if (!text) return "Bem-vindo(a) {user} a {guild}!";
    return text.slice(0, 500);
}

module.exports = {
    name: "welcome",
    aliases: ["wel", "boasvindas"],
    description: "Configura mensagens de boas-vindas e cargo automático.",
    category: "Welcome",
    usage: "!welcome <status|set|message|role|test|enable|disable>",
    execute: async (client, message, args, botInstance) => {
        if (!message.guild) {
            return message.reply("Este comando só funciona dentro de um servidor.");
        }

        const action = String(args[0] || "status").toLowerCase();
        const needsAdmin = ["set", "message", "role", "test", "enable", "disable"];
        if (needsAdmin.includes(action) && !message.member.permissions.has("ManageGuild")) {
            return message.reply("Precisas da permissão `Gerir Servidor` para configurar o welcome.");
        }

        const settings = await botInstance.getWelcomeSettings(message.guild.id);

        if (action === "set") {
            const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
            if (!channel) {
                return message.reply("Usa `!welcome set #canal`.");
            }

            await botInstance.dbPool.execute(
                `UPDATE discord_welcome_settings
                    SET ChannelId = ?, Enabled = TRUE, UpdatedAt = CURRENT_TIMESTAMP
                  WHERE GuildId = ?`,
                [channel.id, message.guild.id]
            );

            return message.reply({
                embeds: [successEmbed("Welcome Configurado", [
                    `Canal: ${channel}`,
                    "Usa `!welcome message <texto>` para personalizar a mensagem.",
                    "Placeholders: `{user}`, `{username}`, `{guild}`.",
                ])],
            });
        }

        if (action === "message") {
            const template = normalizeWelcomeText(args.slice(1).join(" "));
            await botInstance.dbPool.execute(
                `UPDATE discord_welcome_settings
                    SET MessageTemplate = ?, UpdatedAt = CURRENT_TIMESTAMP
                  WHERE GuildId = ?`,
                [template, message.guild.id]
            );
            return message.reply(`Mensagem de welcome atualizada para:\n${template}`);
        }

        if (action === "role") {
            const rawRole = String(args[1] || "").toLowerCase();
            if (["off", "none", "clear", "remove"].includes(rawRole)) {
                await botInstance.dbPool.execute(
                    `UPDATE discord_welcome_settings
                        SET AutoRoleId = NULL, UpdatedAt = CURRENT_TIMESTAMP
                      WHERE GuildId = ?`,
                    [message.guild.id]
                );
                return message.reply("O cargo automático do welcome foi removido.");
            }

            const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
            if (!role) {
                return message.reply("Usa `!welcome role @cargo` ou `!welcome role off`.");
            }

            const me = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
            if (!me || role.position >= me.roles.highest.position) {
                return message.reply("Não consigo atribuir esse cargo porque ele está acima do meu cargo mais alto.");
            }

            await botInstance.dbPool.execute(
                `UPDATE discord_welcome_settings
                    SET AutoRoleId = ?, UpdatedAt = CURRENT_TIMESTAMP
                  WHERE GuildId = ?`,
                [role.id, message.guild.id]
            );
            return message.reply(`Cargo automático definido para ${role}.`);
        }

        if (action === "enable") {
            await botInstance.dbPool.execute(
                `UPDATE discord_welcome_settings
                    SET Enabled = TRUE, UpdatedAt = CURRENT_TIMESTAMP
                  WHERE GuildId = ?`,
                [message.guild.id]
            );
            return message.reply("O sistema de welcome foi ativado.");
        }

        if (action === "disable") {
            await botInstance.dbPool.execute(
                `UPDATE discord_welcome_settings
                    SET Enabled = FALSE, UpdatedAt = CURRENT_TIMESTAMP
                  WHERE GuildId = ?`,
                [message.guild.id]
            );
            return message.reply("O sistema de welcome foi desativado.");
        }

        if (action === "test") {
            if (!settings.ChannelId) {
                return message.reply("Primeiro define um canal com `!welcome set #canal`.");
            }

            const channel = message.guild.channels.cache.get(settings.ChannelId)
                || await message.guild.channels.fetch(settings.ChannelId).catch(() => null);
            if (!channel || !channel.isTextBased || !channel.isTextBased()) {
                return message.reply("O canal configurado já não existe.");
            }

            await channel.send({
                content: botInstance.renderTemplate(
                    settings.MessageTemplate || "Bem-vindo(a) {user} a {guild}!",
                    message.member,
                    message.guild
                ),
            });

            return message.reply("Pré-visualização de welcome enviada.");
        }

        return message.reply({
            embeds: [successEmbed("Welcome", [
                `Ativo: **${settings.Enabled ? "Sim" : "Não"}**`,
                `Canal: ${settings.ChannelId ? `<#${settings.ChannelId}>` : "Não configurado"}`,
                `Mensagem: ${settings.MessageTemplate || "Não configurada"}`,
                `Cargo automático: ${settings.AutoRoleId ? `<@&${settings.AutoRoleId}>` : "Nenhum"}`,
                "",
                "Comandos:",
                "`!welcome set #canal`",
                "`!welcome message Bem-vindo(a) {user} a {guild}!`",
                "`!welcome role @cargo`",
                "`!welcome test`",
            ])],
        });
    },
};
