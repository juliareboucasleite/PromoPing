const { ensureSameVoice, getMember, parseNumber, queueTracks, respond } = require("./_shared");

module.exports = {
  name: "remove",
  aliases: ["rm"],
  description: "Remove uma musica da fila pela posicao.",
  category: "Music",
  usage: "!remove <posicao>",
  execute: async (client, message, args) => {
    const queue = client.music.getPlayer(message.guild?.id);
    const tracks = queueTracks(queue);
    if (!queue || !tracks.length) {
      return respond(message, "Musica", ["Nao ha musicas na fila para remover."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "Musica", [error]);

    const index = parseNumber(args[0], 0);
    if (index < 1 || index > tracks.length) {
      return respond(message, "Musica", ["Usa uma posicao valida da fila."]);
    }

    const removed = queue.node.remove(index - 1);
    return respond(message, "Musica", [
      `Removida **${removed?.title || "a musica"}** da fila.`,
    ]);
  },
};
