const { ensureSameVoice, getMember, respond } = require("./_shared");

module.exports = {
  name: "nowplaying",
  aliases: ["np", "tocando"],
  description: "Mostra a musica atual.",
  category: "Music",
  usage: "!nowplaying",
  execute: async (client, message) => {
    const queue = client.music.getPlayer(message.guild?.id);
    if (!queue?.currentTrack) {
      return respond(message, "A tocar", ["Nao ha nada a tocar agora."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "A tocar", [error]);

    return respond(message, "A tocar agora", client.music.buildNowPlayingLines(queue));
  },
};
