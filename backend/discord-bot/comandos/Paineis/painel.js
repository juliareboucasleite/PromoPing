const { successEmbed } = require("../_helpers");

module.exports = {
    name: "painel",
    aliases: ["panel", "paineis"],
    description: "Resume os painéis e setups prontos do bot.",
    category: "Paineis",
    usage: "!painel",
    execute: async (client, message, args, botInstance) => {
        const prefix = message.guild ? await botInstance.getGuildPrefix(message.guild.id) : "!";
        return message.reply({
            embeds: [successEmbed("Painéis Disponíveis", [
                `\`${prefix}community-panel #canal\` - painel com links da comunidade`,
                `\`${prefix}invite-panel #canal\` - painel de convites`,
                `\`${prefix}review-panel #canal\` - painel para avaliações`,
                `\`${prefix}ticket\` - painel de tickets no canal atual`,
                `\`${prefix}setup-bug\` - botão para reportar bugs`,
                `\`${prefix}setup-sugestao\` - botão para sugestões`,
                `\`${prefix}verify setup #canal @cargo\` - painel de verificação`,
            ])],
        });
    },
};
