const { successEmbed } = require("../_helpers");

module.exports = {
    name: "music",
    aliases: ["musica", "player"],
    description: "Mostra o estado atual do módulo de música neste runtime.",
    category: "Music",
    usage: "!music [status]",
    execute: async (client, message) => {
        const lavalinkUrl = process.env.LAVALINK_URL || process.env.LAVALINK_HOST || "";
        const lavalinkPassword = process.env.LAVALINK_PASSWORD || process.env.LAVALINK_AUTH || "";
        const configured = Boolean(lavalinkUrl && lavalinkPassword);

        return message.reply({
            embeds: [successEmbed("Music", [
                `Infra Lavalink configurada: **${configured ? "Sim" : "Não"}**`,
                configured
                    ? "Os comandos legados de música ainda dependem de integração adicional do runtime atual."
                    : "O módulo de música está desligado porque não há um nó Lavalink configurado no ambiente.",
                "",
                "Para ativar música de forma completa ainda é preciso ligar o player legado ao runtime principal.",
                "Até lá, o `!ajuda music` mostra o estado real em vez de esconder o módulo.",
            ])],
        });
    },
};
