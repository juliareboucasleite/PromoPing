const { successEmbed } = require("../_helpers");

module.exports = {
    name: "music",
    aliases: ["musica", "player"],
    description: "Mostra o estado atual do modulo de musica e os comandos principais.",
    category: "Music",
    usage: "!music",
    execute: async (client, message) => {
        const lavalinkUrl = process.env.LAVALINK_URL || process.env.LAVALINK_HOST || "";
        const lavalinkPassword = process.env.LAVALINK_PASSWORD || process.env.LAVALINK_AUTH || "";
        const configured = Boolean(lavalinkUrl && lavalinkPassword);
        const runtimeReady = Boolean(client.music?.ensureReady?.());
        const queue = message.guild ? client.music?.getPlayer?.(message.guild.id) : null;
        const currentTrack = queue?.currentTrack;

        return message.reply({
            embeds: [successEmbed("Music", [
                `Runtime nativo ativo: **${runtimeReady ? "Sim" : "Nao"}**`,
                `Infra Lavalink configurada: **${configured ? "Sim" : "Nao"}**`,
                currentTrack
                    ? `A tocar agora: **${currentTrack.title}**`
                    : "Nao ha nenhuma musica a tocar neste servidor.",
                "",
                "Comandos: `!play`, `!skip`, `!pause`, `!resume`, `!queue`, `!nowplaying`, `!volume`, `!loop`, `!mstop`.",
                "O `!play` abre um painel com botoes para pausar, passar, repetir, ver fila e parar a sessao.",
                configured
                    ? "O bot ja consegue tocar musica; o Lavalink fica disponivel como infra adicional."
                    : "O bot toca musica pelo runtime nativo atual mesmo sem Lavalink configurado.",
            ])],
        });
    },
};
