const { ensureSameVoice, getMember, respond } = require("./_shared");

module.exports = {
  name: "skip",
  aliases: ["next", "s"],
  description: "Salta a musica atual.",
  category: "Music",
  usage: "!skip",
  execute: async (client, message) => {
    const queue = client.music.getPlayer(message.guild?.id);
    if (!queue?.currentTrack) {
      return respond(message, "Musica", ["Nao ha nada a tocar agora."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "Musica", [error]);

    queue.node.skip();
    return respond(message, "Musica", ["Musica atual ignorada."]);
  },
};
