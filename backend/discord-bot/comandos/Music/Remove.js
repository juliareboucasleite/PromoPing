const Command = require("../../abstract/command");
const { ensureSameVoice, getGuildMember, parseNumber, respond } = require("./_shared");

module.exports = class RemoveCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "remove",
      aliases: ["rm"],
      description: "Remove a queued track by its queue index.",
      usage: ["remove <position>"],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages"],
      cooldown: 2,
      options: [{ type: 4, name: "position", description: "Queue position", required: true }],
    });
  }

  async perform(target, value) {
    const player = this.client.music.getPlayer(target.guild.id);
    if (!player || !player.queue.length) return respond(target, "Music", ["There are no queued tracks to remove."]);
    const err = ensureSameVoice(player, getGuildMember(target));
    if (err) return respond(target, "Music", [err]);
    const index = parseNumber(value, 0);
    if (index < 1 || index > player.queue.length) {
      return respond(target, "Music", ["Provide a valid queue position."]);
    }
    const removed = player.queue[index - 1];
    player.queue.remove(index - 1);
    return respond(target, "Music", [`Removed **${removed.title}** from the queue.`], { ephemeral: false });
  }

  async run({ message, args }) { return this.perform(message, args[0]); }
  async exec({ interaction }) { return this.perform(interaction, interaction.options.getInteger("position")); }
};
