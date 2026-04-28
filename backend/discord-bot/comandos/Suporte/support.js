const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "support",
    aliases: [],
    description: "Mostra como pedir suporte no PromoPing.",
    category: "Suporte",
    execute: async (client, message) => {
        const embed = new EmbedBuilder()
            .setTitle("Suporte PromoPing")
            .setDescription(
                [
                    "Para abrir suporte diretamente pelo bot, usa `!suporte` com a tua mensagem.",
                    "Exemplo: `!suporte Preciso de ajuda com as notificacoes`.",
                    "",
                    "Tambem podes usar o widget de suporte no site do PromoPing.",
                ].join("\n")
            )
            .setColor(0x5865f2)
            .setTimestamp();

        await message.reply({ embeds: [embed] }).catch(() => {});
    },
};
