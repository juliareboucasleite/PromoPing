const { ensureSameVoice, getMember, respond } = require("./_shared");

module.exports = {
  name: "resume",
  aliases: ["unpause", "continuar"],
  description: "Retoma a musica pausada.",
  category: "Music",
  usage: "!resume",
  execute: async (client, message) => {
    const queue = client.music.getPlayer(message.guild?.id);
    if (!queue?.currentTrack) {
      return respond(message, "Musica", ["Nao ha nenhuma musica ativa neste servidor."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "Musica", [error]);

    queue.node.resume();
    return respond(message, "Musica", ["Reproducao retomada."]);
  },
};
