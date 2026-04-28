const Command = require("../../abstract/command");
const { ensureSameVoice, getGuildMember, respond } = require("./_shared");

module.exports = class SkipCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "skip",
      aliases: ["next"],
      description: "Skip the current track.",
      usage: ["skip"],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages"],
      cooldown: 2,
    });
  }

  async execute(target) {
    const player = this.client.music.getPlayer(target.guild.id);
    if (!player || !player.queue.current) return respond(target, "Music", ["Nothing is playing right now."]);
    const err = ensureSameVoice(player, getGuildMember(target));
    if (err) return respond(target, "Music", [err]);
    player.skip();
    return respond(target, "Music", ["Skipped the current track."], { ephemeral: false });
  }

  async run({ message }) { return this.execute(message); }
  async exec({ interaction }) { return this.execute(interaction); }
};
