const { chunkLyrics, respond } = require("./_shared");

module.exports = {
  name: "lyrics",
  aliases: ["letra"],
  description: "Mostra a letra da musica atual ou da pesquisa indicada.",
  category: "Music",
  usage: "!lyrics [nome da musica]",
  execute: async (client, message, args) => {
    let track = client.music.getPlayer(message.guild?.id)?.currentTrack || null;

    if (!track && args.length) {
      const result = await client.music.search(args.join(" "), message.author).catch(() => null);
      track = result?.tracks?.[0] || null;
    }

    if (!track) {
      return respond(message, "Letras", [
        "Nao ha musica ativa. Usa `!lyrics <nome da musica>` para pesquisar diretamente.",
      ]);
    }

    const lyrics = await client.music.fetchLyrics(track);
    if (!lyrics) {
      return respond(message, "Letras", [`Nao encontrei letra para **${track.title}**.`]);
    }

    const chunks = chunkLyrics(lyrics, 3500);
    await message.reply({
      embeds: [{
        title: `Letras • ${track.title}`,
        color: 0xffa500,
        description: chunks[0],
      }],
      allowedMentions: { parse: [] },
    });

    for (let index = 1; index < chunks.length; index += 1) {
      await message.channel.send({
        embeds: [{
          title: `Letras • ${track.title} (${index + 1}/${chunks.length})`,
          color: 0xffa500,
          description: chunks[index],
        }],
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }
  },
};
