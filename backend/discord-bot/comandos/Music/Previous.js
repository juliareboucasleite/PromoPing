const { ensureSameVoice, getMember, respond } = require("./_shared");

module.exports = {
  name: "previous",
  aliases: ["back", "anterior"],
  description: "Volta para a musica anterior do historico.",
  category: "Music",
  usage: "!previous",
  execute: async (client, message) => {
    const queue = client.music.getPlayer(message.guild?.id);
    if (!queue) {
      return respond(message, "Musica", ["Nao ha um player ativo neste servidor."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "Musica", [error]);

    if (!queue.history?.previousTrack) {
      return respond(message, "Musica", ["Nao ha uma musica anterior no historico."]);
    }

    await queue.history.previous(true);
    return respond(message, "Musica", ["Voltei para a musica anterior."]);
  },
};
