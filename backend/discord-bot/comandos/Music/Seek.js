const Command = require("../../abstract/command");
const { ensureSameVoice, getGuildMember, parseSeek, respond } = require("./_shared");

module.exports = class SeekCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "seek",
      aliases: [],
      description: "Seek within the current track.",
      usage: ["seek <seconds|1m|2h>"],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages"],
      cooldown: 2,
      options: [{ type: 3, name: "time", description: "Seek target", required: true }],
    });
  }

  async perform(target, value) {
    const player = this.client.music.getPlayer(target.guild.id);
    if (!player || !player.queue.current) return respond(target, "Music", ["Nothing is playing right now."]);
    const err = ensureSameVoice(player, getGuildMember(target));
    if (err) return respond(target, "Music", [err]);
    const position = parseSeek(value);
    if (position === null) return respond(target, "Music", ["Provide a valid seek time like `90`, `30s`, or `2m`."]);
    await player.seek(position);
    return respond(target, "Music", [`Seeked to \`${this.client.music.formatDuration(position)}\`.`], { ephemeral: false });
  }

  async run({ message, args }) { return this.perform(message, args[0]); }
  async exec({ interaction }) { return this.perform(interaction, interaction.options.getString("time")); }
};
