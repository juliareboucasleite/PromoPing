const { ensureSameVoice, getMember, parseNumber, respond } = require("./_shared");

module.exports = {
  name: "volume",
  aliases: ["vol"],
  description: "Altera o volume entre 0 e 200.",
  category: "Music",
  usage: "!volume <0-200>",
  execute: async (client, message, args) => {
    const queue = client.music.getPlayer(message.guild?.id);
    if (!queue) {
      return respond(message, "Musica", ["Nao ha um player ativo neste servidor."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "Musica", [error]);

    const amount = Math.max(0, Math.min(parseNumber(args[0], 80), 200));
    queue.node.setVolume(amount);
    return respond(message, "Musica", [`Volume definido para **${amount}%**.`]);
  },
};
