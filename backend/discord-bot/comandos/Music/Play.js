const Command = require("../../abstract/command");
const {
  ensureJoinable,
  ensureSameVoice,
  ensureVoice,
  getActor,
  getGuildMember,
  queueCount,
  respond,
} = require("./_shared");

module.exports = class PlayCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "play",
      aliases: ["p"],
      description: "Play a track or playlist through Lavalink.",
      usage: ["play <query or url>"],
      examples: ["play joji slow dancing in the dark", "play https://youtube.com/watch?v=dQw4w9WgXcQ"],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages", "Connect", "Speak"],
      cooldown: 3,
      options: [
        { type: 3, name: "query", description: "Song name or url", required: true },
      ],
    });
  }

  async perform(target, query) {
    if (!query?.trim()) {
      return respond(target, "Music", ["Give me a song name, search phrase, or direct link."]);
    }

    const member = getGuildMember(target);
    const actor = getActor(target);
    const noVoice = ensureVoice(member);
    if (noVoice) return respond(target, "Music", [noVoice]);
    const joinableError = ensureJoinable(target, member);
    if (joinableError) return respond(target, "Music", [joinableError]);

    const existing = this.client.music.getPlayer(target.guild.id);
    const sameVoiceError = ensureSameVoice(existing, member);
    if (sameVoiceError) return respond(target, "Music", [sameVoiceError]);

    let player;
    try {
      player = await this.client.music.createPlayer({
        guild: target.guild,
        member,
        textId: target.channel.id,
      });
    } catch (error) {
      return respond(target, "Music Offline", [
        error?.message || "The music node is offline right now.",
        "Start Lavalink first, then try again.",
      ]);
    }

    const result = await this.client.music.search(query, actor).catch((error) => {
      return { error: error?.message || "Search failed." };
    });

    if (result?.error) {
      return respond(target, "Music Search Failed", [result.error]);
    }

    if (!result?.tracks?.length) {
      return respond(target, "Music", ["I couldn't find anything for that search."]);
    }

    if (result.type === "PLAYLIST") {
      player.queue.add(result.tracks);
      if (!player.playing && !player.paused) {
        await player.play();
      }
      return respond(target, "Playlist Added", [
        `**${result.playlistName || "Playlist"}**`,
        `Tracks: **${result.tracks.length}**`,
        `Queue size: **${player.queue.totalSize}**`,
        `Voice: **${member.voice.channel.name}**`,
      ], { ephemeral: false });
    }

    const track = result.tracks[0];
    player.queue.add(track);
    if (!player.playing && !player.paused) {
      await player.play();
      return respond(target, "Now Playing", [
        `**${track.title}**`,
        `${track.author || "Unknown Artist"}`,
        `Duration: \`${this.client.music.formatDuration(track.length)}\``,
        `Queue size: **${player.queue.totalSize}**`,
      ], { ephemeral: false });
    }

    return respond(target, "Queued", [
      `**${track.title}**`,
      `${track.author || "Unknown Artist"}`,
      `Queue size: **${queueCount(player)}**`,
    ], { ephemeral: false });
  }

  async run({ message, args }) {
    return this.perform(message, args.join(" "));
  }

  async exec({ interaction }) {
    return this.perform(interaction, interaction.options.getString("query"));
  }
};
