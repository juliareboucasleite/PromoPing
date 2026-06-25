const { successEmbed } = require("../_helpers");

module.exports = {
    name: "painel",
    aliases: ["panel", "paineis"],
    description: "Lists available PromoPing panels and setup commands.",
    category: "Paineis",
    usage: "!panel",
    execute: async (client, message, args, botInstance) => {
        const prefix = message.guild ? await botInstance.getGuildPrefix(message.guild.id) : "!";
        return message.reply({
            embeds: [successEmbed("Available Panels", [
                `\`${prefix}community-panel #channel\` — community resources panel`,
                `\`${prefix}invite-panel #channel\` — server invite panel`,
                `\`${prefix}sponsor-panel #channel\` — sponsorship / support panel`,
                `\`${prefix}review-panel #channel\` — PromoPing reviews panel`,
                `\`${prefix}product-buy #channel\` — product buy / help panel`,
                `\`${prefix}product-review #channel\` — product reviews (customers only)`,
                `\`${prefix}ticket #channel\` — general support ticket panel`,
                `\`${prefix}setup-bug #channel\` — bug report button`,
                `\`${prefix}setup-sugestao #channel\` — feature suggestion button`,
                `\`${prefix}verify setup #channel @role\` — verification panel`,
            ])],
        });
    },
};
