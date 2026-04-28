const Command = require("../../abstract/command");
const { ensureSameVoice, getGuildMember, parseNumber, respond } = require("./_shared");

module.exports = class QueueCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "queue",
      aliases: ["q"],
      description: "Show the current queue with pagination.",
      usage: ["queue [page]"],
      category: "Music",
      userPerms: ["SendMessages"],
      botPerms: ["ViewChannel", "SendMessages"],
      cooldown: 3,
      options: [{ type: 4, name: "page", description: "Queue page", required: false }],
    });
  }

  async perform(target, pageInput) {
    const player = this.client.music.getPlayer(target.guild.id);
    if (!player) return respond(target, "Queue", ["There is no active player in this server."]);
    const sameVoiceError = ensureSameVoice(player, getGuildMember(target));
    if (sameVoiceError) return respond(target, "Queue", [sameVoiceError]);

    const pages = this.client.music.queuePages(player);
    const page = Math.max(1, Math.min(parseNumber(pageInput, 1), pages.length));
    const current = this.client.music.buildNowPlayingLines(player).join("\n");

    return respond(target, "Queue", [
      `## Now Playing`,
      current,
      "",
      `## Up Next  \`${page}/${pages.length}\``,
      pages[page - 1],
    ], { ephemeral: false });
  }

  async run({ message, args }) {
    return this.perform(message, args[0]);
  }

  async exec({ interaction }) {
    return this.perform(interaction, interaction.options.getInteger("page"));
  }
};
