const Command = require("../../abstract/command");
const { ensureSameVoice, getGuildMember, parseNumber, respond } = require("./_shared");

module.exports = class VolumeCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "volume",
      aliases: ["vol"],
      description: "Set player volume between 0 and 200.",
      usage: ["volume <0-200>"],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages"],
      cooldown: 2,
      options: [{ type: 4, name: "amount", description: "Volume amount", required: true }],
    });
  }

  async perform(target, value) {
    const player = this.client.music.getPlayer(target.guild.id);
    if (!player) return respond(target, "Music", ["There is no active player in this server."]);
    const err = ensureSameVoice(player, getGuildMember(target));
    if (err) return respond(target, "Music", [err]);
    const amount = Math.max(0, Math.min(parseNumber(value, 80), 200));
    await player.setVolume(amount);
    return respond(target, "Music", [`Volume set to **${amount}%**.`], { ephemeral: false });
  }

  async run({ message, args }) { return this.perform(message, args[0]); }
  async exec({ interaction }) { return this.perform(interaction, interaction.options.getInteger("amount")); }
};
