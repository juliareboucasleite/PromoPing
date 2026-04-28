const Command = require("../../abstract/command");
const { ensureSameVoice, getGuildMember, respond } = require("./_shared");

module.exports = class LoopCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "loop",
      aliases: ["repeat"],
      description: "Set loop mode to none, track, or queue.",
      usage: ["loop <none|track|queue>"],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages"],
      cooldown: 2,
      options: [
        {
          type: 3,
          name: "mode",
          description: "Loop mode",
          required: false,
          choices: [
            { name: "none", value: "none" },
            { name: "track", value: "track" },
            { name: "queue", value: "queue" },
          ],
        },
      ],
    });
  }

  async perform(target, mode) {
    const player = this.client.music.getPlayer(target.guild.id);
    if (!player) return respond(target, "Music", ["There is no active player in this server."]);
    const err = ensureSameVoice(player, getGuildMember(target));
    if (err) return respond(target, "Music", [err]);
    const finalMode = ["none", "track", "queue"].includes(mode) ? mode : undefined;
    if (!finalMode) {
      return respond(target, "Music", [
        `Current loop mode: **${player.loop || "none"}**`,
        "Choose `none`, `track`, or `queue` to change it.",
      ], { ephemeral: false });
    }
    player.setLoop(finalMode);
    return respond(target, "Music", [`Loop mode is now **${player.loop}**.`], { ephemeral: false });
  }

  async run({ message, args }) { return this.perform(message, args[0]?.toLowerCase()); }
  async exec({ interaction }) { return this.perform(interaction, interaction.options.getString("mode")); }
};
