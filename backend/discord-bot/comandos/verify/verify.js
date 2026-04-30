const { successEmbed } = require("../_helpers");

function normalizeVerificationText(value) {
    const text = String(value || "").trim();
    if (!text) return "Clica no botão abaixo para receber acesso ao servidor.";
    return text.slice(0, 700);
}

function normalizeButtonLabel(value) {
    const text = String(value || "").trim();
    if (!text) return "Verificar";
    return text.slice(0, 80);
}

module.exports = {
    name: "verify",
    aliases: ["verification", "verificar", "verifu"],
    description: "Configura o painel de verificação com botão e cargo.",
    category: "Verify",
    usage: "!verify <status|setup|message|button|resend|disable>",
    execute: async (client, message, args, botInstance) => {
        if (!message.guild) {
            return message.reply("Este comando só funciona dentro de um servidor.");
        }

        if (!message.member.permissions.has("ManageGuild")) {
            return message.reply("Precisas da permissão `Gerir Servidor` para configurar a verificação.");
        }

        const action = String(args[0] || "status").toLowerCase();
        const settings = await botInstance.getVerificationSettings(message.guild.id);

        if (action === "setup") {
            const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
            const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);
            if (!channel || !role) {
                return message.reply("Usa `!verify setup #canal @cargo`.");
            }

            const me = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
            if (!me || role.position >= me.roles.highest.position) {
                return message.reply("Não consigo atribuir esse cargo porque ele está acima do meu cargo mais alto.");
            }

            await botInstance.dbPool.execute(
                `UPDATE discord_verification_settings
                    SET ChannelId = ?, RoleId = ?, Enabled = TRUE, UpdatedAt = CURRENT_TIMESTAMP
                  WHERE GuildId = ?`,
                [channel.id, role.id, message.guild.id]
            );

            const panelMessage = await botInstance.sendVerificationPanel(message.guild, channel.id);
            return message.reply({
                embeds: [successEmbed("Verificação Configurada", [
                    `Canal: ${channel}`,
                    `Cargo: ${role}`,
                    `Mensagem enviada: [abrir painel](${panelMessage.url})`,
                ])],
            });
        }

        if (action === "message") {
            const messageText = normalizeVerificationText(args.slice(1).join(" "));
            await botInstance.dbPool.execute(
                `UPDATE discord_verification_settings
                    SET MessageText = ?, UpdatedAt = CURRENT_TIMESTAMP
                  WHERE GuildId = ?`,
                [messageText, message.guild.id]
            );
            return message.reply("Texto de verificação atualizado. Usa `!verify resend` para publicar o painel novamente.");
        }

        if (action === "button") {
            const buttonLabel = normalizeButtonLabel(args.slice(1).join(" "));
            await botInstance.dbPool.execute(
                `UPDATE discord_verification_settings
                    SET ButtonLabel = ?, UpdatedAt = CURRENT_TIMESTAMP
                  WHERE GuildId = ?`,
                [buttonLabel, message.guild.id]
            );
            return message.reply("Texto do botão atualizado. Usa `!verify resend` para publicar o painel novamente.");
        }

        if (action === "resend") {
            const targetChannel = message.mentions.channels.first()
                || message.guild.channels.cache.get(args[1])
                || (settings.ChannelId
                    ? message.guild.channels.cache.get(settings.ChannelId) || await message.guild.channels.fetch(settings.ChannelId).catch(() => null)
                    : null);

            if (!targetChannel) {
                return message.reply("Primeiro usa `!verify setup #canal @cargo` ou menciona um canal em `!verify resend #canal`.");
            }

            const panelMessage = await botInstance.sendVerificationPanel(message.guild, targetChannel.id);
            return message.reply(`Painel reenviado: ${panelMessage.url}`);
        }

        if (action === "disable") {
            await botInstance.dbPool.execute(
                `UPDATE discord_verification_settings
                    SET Enabled = FALSE, UpdatedAt = CURRENT_TIMESTAMP
                  WHERE GuildId = ?`,
                [message.guild.id]
            );
            return message.reply("A verificação foi desativada.");
        }

        return message.reply({
            embeds: [successEmbed("Verify", [
                `Ativo: **${settings.Enabled ? "Sim" : "Não"}**`,
                `Canal: ${settings.ChannelId ? `<#${settings.ChannelId}>` : "Não configurado"}`,
                `Cargo: ${settings.RoleId ? `<@&${settings.RoleId}>` : "Não configurado"}`,
                `Botão: ${settings.ButtonLabel || "Verificar"}`,
                `Mensagem atual: ${settings.MessageText || "Não configurada"}`,
                "",
                "Comandos:",
                "`!verify setup #canal @cargo`",
                "`!verify message Clica no botão para desbloquear o servidor.`",
                "`!verify button Entrar`",
                "`!verify resend`",
            ])],
        });
    },
};
