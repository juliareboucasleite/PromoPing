const { ensureSameVoice, getMember, respond } = require("./_shared");

module.exports = {
  name: "mstop",
  aliases: ["musicstop", "disconnect", "leave", "dc"],
  description: "Para a reproducao e sai do canal de voz.",
  category: "Music",
  usage: "!mstop",
  execute: async (client, message) => {
    const queue = client.music.getPlayer(message.guild?.id);
    if (!queue) {
      return respond(message, "Musica", ["Nao ha um player ativo neste servidor."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "Musica", [error]);

    await client.music.destroy(message.guild.id, "Painel encerrado: sessao terminada por comando.");
    return respond(message, "Musica", ["Player parado e canal de voz abandonado."]);
  },
};
