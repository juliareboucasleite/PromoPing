const Command = require("../../abstract/command");
const { ensureSameVoice, getGuildMember, respond } = require("./_shared");

module.exports = class NowPlayingCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "nowplaying",
      aliases: ["np"],
      description: "Show the currently playing track.",
      usage: ["nowplaying"],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages"],
      cooldown: 3,
    });
  }

  async execute(target) {
    const player = this.client.music.getPlayer(target.guild.id);
    if (!player || !player.queue.current) return respond(target, "Now Playing", ["Nothing is playing right now."]);
    const sameVoiceError = ensureSameVoice(player, getGuildMember(target));
    if (sameVoiceError) return respond(target, "Now Playing", [sameVoiceError]);
    return respond(target, "Now Playing", this.client.music.buildNowPlayingLines(player), {
      ephemeral: false,
    });
  }

  async run({ message }) { return this.execute(message); }
  async exec({ interaction }) { return this.execute(interaction); }
};
