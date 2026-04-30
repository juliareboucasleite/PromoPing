const { ensureSameVoice, getMember, respond } = require("./_shared");

module.exports = {
  name: "pause",
  aliases: [],
  description: "Pausa a musica atual.",
  category: "Music",
  usage: "!pause",
  execute: async (client, message) => {
    const queue = client.music.getPlayer(message.guild?.id);
    if (!queue?.currentTrack) {
      return respond(message, "Musica", ["Nao ha nada a tocar agora."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "Musica", [error]);

    queue.node.pause();
    return respond(message, "Musica", ["Reproducao pausada."]);
  },
};
