const Command = require("../../abstract/command");
const { ChannelType } = require("discord.js");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const { getApplicationConfig, saveApplicationConfig } = require("../../../toolkit/helpers/applications");

function respond(target, title, lines, ephemeral = true) {
  return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
}

module.exports = class ApplySetupCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "applysetup",
      aliases: ["applicationsetup"],
      description: "Configure the application review channel.",
      usage: ["applysetup <reviewchannel>"],
      examples: ["applysetup #staff-apps"],
      category: "Welcome",
      slash: false,
      userPerms: ["ManageGuild"],
      botPerms: ["SendMessages", "ViewChannel"],
      cooldown: 3,
      options: [
        { type: 7, name: "review", description: "Review channel", required: true, channel_types: [ChannelType.GuildText] },
      ],
    });
  }

  async perform(target, reviewChannelId) {
    const channel = target.guild.channels.cache.get(reviewChannelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return respond(target, "Applications", ["Choose a valid review text channel."]);
    }

    const config = await getApplicationConfig(this.client, target.guild.id);
    config.enabled = true;
    config.reviewChannelId = channel.id;
    await saveApplicationConfig(this.client, target.guild.id, config);

    return respond(target, "Application Setup", [
      "Applications are now enabled.",
      `Review channel: ${channel}`,
      `Questions: **${config.questions.length}**`,
    ], false);
  }

  async run({ message, args }) {
    return this.perform(message, args[0]);
  }

  async exec({ interaction }) {
    return this.perform(interaction, interaction.options.getChannel("review")?.id);
  }
};
