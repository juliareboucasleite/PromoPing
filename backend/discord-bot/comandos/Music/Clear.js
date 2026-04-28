const Command = require("../../abstract/command");
const { ensureSameVoice, getGuildMember, queueCount, respond } = require("./_shared");

module.exports = class ClearCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "clear",
      aliases: ["cq"],
      description: "Clear the upcoming queue without leaving voice.",
      usage: ["clear"],
      examples: ["clear"],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages"],
      cooldown: 2,
    });
  }

  async execute(target) {
    const player = this.client.music.getPlayer(target.guild.id);
    if (!player) return respond(target, "Queue", ["There is no active player in this server."]);
    const err = ensureSameVoice(player, getGuildMember(target));
    if (err) return respond(target, "Queue", [err]);

    const before = queueCount(player);
    if (!before) {
      return respond(target, "Queue", ["There are no upcoming tracks to clear."]);
    }

    player.queue.clear();
    return respond(target, "Queue Cleared", [
      `Removed **${before}** queued track(s).`,
      "The current track will keep playing until it ends.",
    ], { ephemeral: false });
  }

  async run({ message }) {
    return this.execute(message);
  }

  async exec({ interaction }) {
    return this.execute(interaction);
  }
};
