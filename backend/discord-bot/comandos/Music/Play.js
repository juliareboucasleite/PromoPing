const {
  ensureJoinable,
  ensureSameVoice,
  ensureVoice,
  getMember,
  queueTracks,
  respond,
} = require("./_shared");

module.exports = {
  name: "play",
  aliases: ["p"],
  description: "Toca uma musica ou adiciona uma playlist a fila.",
  category: "Music",
  usage: "!play <nome ou link>",
  execute: async (client, message, args) => {
    if (!message.guild) {
      return message.reply("Este comando so funciona dentro de um servidor.");
    }

    const query = args.join(" ").trim();
    if (!query) {
      return respond(message, "Musica", ["Usa `!play <nome ou link>` para tocar algo."]);
    }

    const member = getMember(message);
    const noVoice = ensureVoice(member);
    if (noVoice) return respond(message, "Musica", [noVoice]);

    const joinableError = ensureJoinable(message, member);
    if (joinableError) return respond(message, "Musica", [joinableError]);

    const existing = client.music.getPlayer(message.guild.id);
    const sameVoiceError = ensureSameVoice(existing, member, client.music);
    if (sameVoiceError) return respond(message, "Musica", [sameVoiceError]);

    try {
      const queue = await client.music.createPlayer({
        guild: message.guild,
        member,
        textId: message.channel.id,
      });

      const result = await client.music.search(query, message.author);
      if (!result?.tracks?.length) {
        return respond(message, "Musica", ["Nao encontrei nenhuma musica para essa pesquisa."]);
      }

      const wasPlaying = Boolean(queue.currentTrack);
      await queue.node.play(result);

      if (result.playlist) {
        return client.music.presentControlPanel(message, queue, message.author.id, {
          title: "Playlist adicionada",
          lines: [
            `**${result.playlist.title || "Playlist"}**`,
            `Faixas: **${result.tracks.length}**`,
            `Fila atual: **${queueTracks(queue).length}**`,
            `Canal de voz: **${member.voice.channel.name}**`,
          ],
        });
      }

      const track = result.tracks[0];
      return client.music.presentControlPanel(message, queue, message.author.id, {
        title: wasPlaying ? "Musica adicionada" : "A tocar agora",
        lines: [
          `**${track.title}**`,
          `${track.author || "Artista desconhecido"}`,
          `Duracao: \`${client.music.formatDuration(track.durationMS || track.duration || 0)}\``,
          `Fila atual: **${queueTracks(queue).length}**`,
        ],
      });
    } catch (error) {
      return respond(message, "Erro de musica", [
        String(error?.message || error || "Nao consegui tocar essa musica.").slice(0, 300),
      ]);
    }
  },
};
