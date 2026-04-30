const { ensureSameVoice, getMember, parseSeek, respond } = require("./_shared");

module.exports = {
  name: "seek",
  aliases: ["avancar"],
  description: "Salta para um ponto da musica atual.",
  category: "Music",
  usage: "!seek <30s|2m|1h>",
  execute: async (client, message, args) => {
    const queue = client.music.getPlayer(message.guild?.id);
    if (!queue?.currentTrack) {
      return respond(message, "Musica", ["Nao ha nada a tocar agora."]);
    }

    const error = ensureSameVoice(queue, getMember(message), client.music);
    if (error) return respond(message, "Musica", [error]);

    const position = parseSeek(args[0]);
    if (position === null) {
      return respond(message, "Musica", ["Usa `!seek 30s`, `!seek 2m` ou `!seek 1h`."]);
    }

    await queue.node.seek(position);
    return respond(message, "Musica", [
      `Avancei para \`${client.music.formatDuration(position)}\`.`,
    ]);
  },
};
