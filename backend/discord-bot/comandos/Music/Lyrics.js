const Command = require("../../abstract/command");
const { chunkLyrics, ensureSameVoice, getActor, getGuildMember, respond } = require("./_shared");

module.exports = class LyricsCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "lyrics",
      aliases: ["ly"],
      description: "Fetch lyrics for the current track or a search query.",
      usage: ["lyrics [song]"],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages"],
      cooldown: 4,
      options: [{ type: 3, name: "query", description: "Song name", required: false }],
    });
  }

  async perform(target, query) {
    let track = null;
    const player = this.client.music.getPlayer(target.guild.id);
    if (!query) {
      if (!player || !player.queue.current) return respond(target, "Lyrics", ["Nothing is playing right now, so provide a song name."]);
      const err = ensureSameVoice(player, getGuildMember(target));
      if (err) return respond(target, "Lyrics", [err]);
      track = player.queue.current;
    } else {
      const result = await this.client.music.search(query, getActor(target)).catch((error) => ({
        error: error?.message || "Lyrics search failed.",
      }));
      if (result?.error) {
        return respond(target, "Music Offline", [
          result.error,
          "Start Lavalink first, then try the lyrics lookup again.",
        ]);
      }
      track = result?.tracks?.[0] || null;
    }

    if (!track) return respond(target, "Lyrics", ["I couldn't resolve a track for that lyrics lookup."]);
    const lyrics = await this.client.music.fetchLyrics(track);
    if (!lyrics) return respond(target, "Lyrics", [`I couldn't find lyrics for **${track.title}**.`]);

    const pages = chunkLyrics(lyrics);
    return respond(target, "Lyrics", [
      `**${track.title}**`,
      `${track.author || "Unknown Artist"}`,
      `Sections: **${pages.length}**`,
      "",
      pages[0],
      ...(pages.length > 1 ? ["", "Use a more specific song search if you want a tighter lyrics match."] : []),
    ], { ephemeral: false });
  }

  async run({ message, args }) { return this.perform(message, args.join(" ")); }
  async exec({ interaction }) { return this.perform(interaction, interaction.options.getString("query")); }
};
