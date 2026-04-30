const { ensureSameVoice, getMember, respond } = require("./_shared");

module.exports = {
  name: "loop",
  aliases: ["repeat"],
  description: "Define o loop para none, track, queue ou autoplay.",
  category: "Music",
  usage: "!loop <none|track|queue|autoplay>",
  execute: async (client, message, args) => {
    const queue = client.music.getPlayer(message.guild?.id);
    if (!queue) {
      return respond(message, "Musica", ["Nao ha um player ativo neste servidor."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "Musica", [error]);

    const mode = String(args[0] || "").toLowerCase();
    if (!mode) {
      return respond(message, "Musica", [
        `Loop atual: **${client.music.formatRepeatMode(queue.repeatMode)}**`,
        "Usa `!loop none`, `!loop track`, `!loop queue` ou `!loop autoplay`.",
      ]);
    }

    queue.setRepeatMode(client.music.parseRepeatMode(mode));
    return respond(message, "Musica", [
      `Loop definido para **${client.music.formatRepeatMode(queue.repeatMode)}**.`,
    ]);
  },
};
