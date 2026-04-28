const Command = require("../../abstract/command");
const {
  ensureJoinable,
  ensureSameVoice,
  ensureVoice,
  getActor,
  getGuildMember,
  respond,
} = require("./_shared");

module.exports = class PlaylistCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "playlist",
      aliases: ["pl"],
      description: "Queue a playlist URL or playlist search result.",
      usage: ["playlist <playlist url or search>"],
      examples: [
        "playlist https://www.youtube.com/playlist?list=...",
        "playlist chill lofi playlist",
      ],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages", "Connect", "Speak"],
      cooldown: 3,
      options: [
        { type: 3, name: "query", description: "Playlist URL or search", required: true },
      ],
    });
  }

  async perform(target, query) {
    if (!query?.trim()) {
      return respond(target, "Playlist", ["Give me a playlist URL or a playlist search phrase."]);
    }

    const member = getGuildMember(target);
    const actor = getActor(target);
    const noVoice = ensureVoice(member);
    if (noVoice) return respond(target, "Playlist", [noVoice]);
    const joinableError = ensureJoinable(target, member);
    if (joinableError) return respond(target, "Playlist", [joinableError]);

    const existing = this.client.music.getPlayer(target.guild.id);
    const sameVoiceError = ensureSameVoice(existing, member);
    if (sameVoiceError) return respond(target, "Playlist", [sameVoiceError]);

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
      return { error: error?.message || "Playlist search failed." };
    });

    if (result?.error) {
      return respond(target, "Playlist Search Failed", [result.error]);
    }

    if (!result?.tracks?.length || result.type !== "PLAYLIST") {
      return respond(target, "Playlist", [
        "That search did not resolve to a playlist.",
        "Try a direct playlist link or a clearer playlist name.",
      ]);
    }

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

  async run({ message, args }) {
    return this.perform(message, args.join(" "));
  }

  async exec({ interaction }) {
    return this.perform(interaction, interaction.options.getString("query"));
  }
};
