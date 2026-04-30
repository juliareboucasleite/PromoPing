const { ensureSameVoice, getMember, queueTracks, respond } = require("./_shared");

module.exports = {
  name: "clearqueue",
  aliases: ["cq", "clearfila"],
  description: "Limpa a fila de musica sem desligar o bot.",
  category: "Music",
  usage: "!clearqueue",
  execute: async (client, message) => {
    const queue = client.music.getPlayer(message.guild?.id);
    if (!queue) {
      return respond(message, "Musica", ["Nao ha um player ativo neste servidor."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "Musica", [error]);

    const amount = queueTracks(queue).length;
    queue.clear();
    return respond(message, "Musica", [`Fila limpa. Removidas **${amount}** musicas.`]);
  },
};
