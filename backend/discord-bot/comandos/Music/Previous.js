const Command = require("../../abstract/command");
const { ensureSameVoice, getGuildMember, respond } = require("./_shared");

module.exports = class PreviousCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "previous",
      aliases: ["back"],
      description: "Play the previously played track again.",
      usage: ["previous"],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages"],
      cooldown: 2,
    });
  }

  async execute(target) {
    const player = this.client.music.getPlayer(target.guild.id);
    if (!player) return respond(target, "Music", ["There is no active player in this server."]);
    const err = ensureSameVoice(player, getGuildMember(target));
    if (err) return respond(target, "Music", [err]);
    const track = player.getPrevious(true);
    if (!track) return respond(target, "Music", ["There is no previous track to replay."]);
    await player.play(track);
    return respond(target, "Music", [`Replaying **${track.title}**.`], { ephemeral: false });
  }

  async run({ message }) { return this.execute(message); }
  async exec({ interaction }) { return this.execute(interaction); }
};
