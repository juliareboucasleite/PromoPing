const Command = require("../../abstract/command");
const { ensureSameVoice, getGuildMember, respond } = require("./_shared");

module.exports = class ShuffleCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "shuffle",
      aliases: [],
      description: "Shuffle the upcoming queue.",
      usage: ["shuffle"],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages"],
      cooldown: 2,
    });
  }

  async execute(target) {
    const player = this.client.music.getPlayer(target.guild.id);
    if (!player || !player.queue.length) return respond(target, "Music", ["There are no upcoming tracks to shuffle."]);
    const err = ensureSameVoice(player, getGuildMember(target));
    if (err) return respond(target, "Music", [err]);
    player.queue.shuffle();
    return respond(target, "Music", ["Shuffled the queue."], { ephemeral: false });
  }

  async run({ message }) { return this.execute(message); }
  async exec({ interaction }) { return this.execute(interaction); }
};
