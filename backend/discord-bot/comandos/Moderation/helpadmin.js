const { EmbedBuilder } = require("discord.js");
const { buildModules } = require("../Sistema/helpCatalog");

module.exports = {
    name: "helpadmin",
    aliases: ["admin", "comandosadmin", "ha"],
    description: "Lista comandos e setups administrativos do bot.",
    category: "Moderation",
    usage: "!helpadmin",
    execute: async (client, message, args, botInstance) => {
        if (!message.guild) {
            return message.reply("Este comando só pode ser usado num servidor.");
        }

        const member = message.member;
        const userId = message.author?.id || member?.user?.id;
        const adminIds = Array.isArray(botInstance.adminIds) ? botInstance.adminIds : [];
        const adminRoleIds = Array.isArray(botInstance.adminRoleIds) ? botInstance.adminRoleIds : [];
        const hasAdminRole = adminRoleIds.length > 0 && adminRoleIds.some((roleId) => member.roles.cache.has(roleId));
        const isInAdminList = userId && adminIds.includes(userId);
        const hasManageGuild = member.permissions.has("ManageGuild");

        if (!hasAdminRole && !isInAdminList && !hasManageGuild) {
            return message.reply("Apenas staff ou utilizadores com `Gerir Servidor` podem usar este comando.");
        }

        const prefix = await botInstance.getGuildPrefix(message.guild.id);
        const modules = buildModules(prefix);
        const adminModules = modules.filter((module) => [
            "birthday",
            "comunidade",
            "giveaways",
            "moderation",
            "painel",
            "suporte",
            "verify",
            "welcome",
            "youtube",
        ].includes(module.key));

        const embed = new EmbedBuilder()
            .setTitle("PromoPing • Help Admin")
            .setDescription("Resumo dos módulos que exigem setup, permissões ou manutenção de staff.")
            .setColor(0x5865F2)
            .addFields(
                {
                    name: "Moderação",
                    value: [
                        `\`${prefix}clear 20\``,
                        `\`${prefix}lock\` / \`${prefix}unlock\``,
                        `\`${prefix}hide\` / \`${prefix}unhide\``,
                        `\`${prefix}ban\`, \`${prefix}kick\`, \`${prefix}timeout\`, \`${prefix}unmute\``,
                    ].join("\n"),
                    inline: false,
                },
                {
                    name: "Setups Mais Usados",
                    value: [
                        `\`${prefix}welcome set #canal\``,
                        `\`${prefix}verify setup #canal @cargo\``,
                        `\`${prefix}birthday channel #canal\``,
                        `\`${prefix}youtube enable <canal-youtube> #canal true\``,
                        `\`${prefix}gstart 1h 1 Prémio\``,
                    ].join("\n"),
                    inline: false,
                },
                {
                    name: "Painéis",
                    value: [
                        `\`${prefix}painel\``,
                        `\`${prefix}community-panel #canal\``,
                        `\`${prefix}invite-panel #canal\``,
                        `\`${prefix}sponsor-panel #canal\``,
                        `\`${prefix}review-panel #canal\``,
                        `\`${prefix}ticket\``,
                    ].join("\n"),
                    inline: false,
                },
                {
                    name: "Módulos Guiados",
                    value: adminModules.map((module) => `• \`${prefix}ajuda ${module.key}\` — ${module.summary}`).join("\n"),
                    inline: false,
                }
            )
            .setFooter({ text: "Usa ajuda por módulo para ver exemplos completos." })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    },
};
