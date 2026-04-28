const Command = require("../../abstract/command");
const { ensureSameVoice, getGuildMember, respond } = require("./_shared");

module.exports = class StopCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "stop",
      aliases: ["disconnect", "leave"],
      description: "Stop playback, clear the queue, and leave voice.",
      usage: ["stop"],
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
    player.queue.clear();
    await this.client.music.destroy(target.guild.id);
    return respond(target, "Music", ["Stopped playback and left the voice channel."], { ephemeral: false });
  }

  async run({ message }) { return this.execute(message); }
  async exec({ interaction }) { return this.execute(interaction); }
};
