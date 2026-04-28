const Command = require("../../abstract/command");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const { getApplicationConfig } = require("../../../toolkit/helpers/applications");

function respond(target, title, lines, ephemeral = true) {
  return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
}

module.exports = class ApplyConfigCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "applyconfig",
      aliases: ["applicationconfig"],
      description: "Show the current application configuration.",
      usage: ["applyconfig"],
      examples: ["applyconfig"],
      category: "Welcome",
      slash: false,
      userPerms: ["ManageGuild"],
      botPerms: ["SendMessages", "ViewChannel"],
      cooldown: 3,
    });
  }

  async execute(target) {
    const config = await getApplicationConfig(this.client, target.guild.id);
    return respond(target, "Application Config", [
      `Enabled: **${config.enabled ? "Yes" : "No"}**`,
      `Panel channel: **${config.panelChannelId ? `<#${config.panelChannelId}>` : "Not set"}**`,
      `Review channel: **${config.reviewChannelId ? `<#${config.reviewChannelId}>` : "Not set"}**`,
      "",
      ...config.questions.map((question, index) => `${index + 1}. ${question}`),
    ], false);
  }

  async run({ message }) {
    return this.execute(message);
  }

  async exec({ interaction }) {
    return this.execute(interaction);
  }
};
