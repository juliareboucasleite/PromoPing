const { ensureSameVoice, getMember, queueTracks, respond } = require("./_shared");

module.exports = {
  name: "shuffle",
  aliases: ["misturar"],
  description: "Mistura a fila atual.",
  category: "Music",
  usage: "!shuffle",
  execute: async (client, message) => {
    const queue = client.music.getPlayer(message.guild?.id);
    if (!queue) {
      return respond(message, "Musica", ["Nao ha um player ativo neste servidor."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "Musica", [error]);

    if (!queueTracks(queue).length) {
      return respond(message, "Musica", ["Nao ha musicas suficientes na fila para misturar."]);
    }

    queue.tracks.shuffle();
    return respond(message, "Musica", ["Fila misturada."]);
  },
};
