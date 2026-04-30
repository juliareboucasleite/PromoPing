const { ensureSameVoice, getMember, parseNumber, respond } = require("./_shared");

module.exports = {
  name: "queue",
  aliases: ["q", "fila"],
  description: "Mostra a fila atual.",
  category: "Music",
  usage: "!queue [pagina]",
  execute: async (client, message, args) => {
    const queue = client.music.getPlayer(message.guild?.id);
    if (!queue) {
      return respond(message, "Fila", ["Nao ha um player ativo neste servidor."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "Fila", [error]);

    const pages = client.music.queuePages(queue);
    const page = Math.max(1, Math.min(parseNumber(args[0], 1), pages.length));

    return respond(message, "Fila", [
      "Agora:",
      ...client.music.buildNowPlayingLines(queue),
      "",
      `Proximas musicas (${page}/${pages.length}):`,
      pages[page - 1],
    ]);
  },
};
