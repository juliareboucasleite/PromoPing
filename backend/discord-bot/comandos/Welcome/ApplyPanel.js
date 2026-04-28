const Command = require("../../abstract/command");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const { buildApplicationPanel, getApplicationConfig, saveApplicationConfig } = require("../../../toolkit/helpers/applications");

function respond(target, title, lines, ephemeral = true) {
  return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
}

module.exports = class ApplyPanelCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "applypanel",
      aliases: ["sendapplypanel"],
      description: "Send the application panel in the current channel.",
      usage: ["applypanel"],
      examples: ["applypanel"],
      category: "Welcome",
      slash: false,
      userPerms: ["ManageGuild"],
      botPerms: ["SendMessages", "ViewChannel"],
      cooldown: 3,
    });
  }

  async execute(target) {
    const config = await getApplicationConfig(this.client, target.guild.id);
    if (!config.enabled || !config.reviewChannelId) {
      return respond(target, "Applications", ["Run `applysetup` first before sending the panel."]);
    }

    await target.channel.send(buildApplicationPanel(this.client, config)).catch(() => null);
    config.panelChannelId = target.channel.id;
    await saveApplicationConfig(this.client, target.guild.id, config);
    return respond(target, "Applications", ["Application panel sent."], false);
  }

  async run({ message }) {
    return this.execute(message);
  }

  async exec({ interaction }) {
    return this.execute(interaction);
  }
};
