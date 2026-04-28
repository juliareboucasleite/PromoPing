const Command = require("../../abstract/command");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const { getApplicationConfig, saveApplicationConfig } = require("../../../toolkit/helpers/applications");

function respond(target, title, lines, ephemeral = true) {
  return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
}

module.exports = class ApplyQuestionCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "applyquestion",
      aliases: ["setapplyquestion"],
      description: "Edit one of the application questions.",
      usage: ["applyquestion <1-5> <question>"],
      examples: ["applyquestion 1 Why do you want this role?"],
      category: "Welcome",
      slash: false,
      userPerms: ["ManageGuild"],
      botPerms: ["SendMessages", "ViewChannel"],
      cooldown: 3,
      options: [
        { type: 4, name: "index", description: "Question number", required: true },
        { type: 3, name: "question", description: "Question text", required: true },
      ],
    });
  }

  async perform(target, rawIndex, question) {
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 1 || index > 5) {
      return respond(target, "Applications", ["Question number must be between 1 and 5."]);
    }

    const config = await getApplicationConfig(this.client, target.guild.id);
    config.questions[index - 1] = String(question || "").trim();
    await saveApplicationConfig(this.client, target.guild.id, config);

    return respond(target, "Applications", [
      `Updated question **${index}**.`,
      config.questions[index - 1],
    ], false);
  }

  async run({ message, args }) {
    return this.perform(message, args[0], args.slice(1).join(" "));
  }

  async exec({ interaction }) {
    return this.perform(
      interaction,
      interaction.options.getInteger("index"),
      interaction.options.getString("question")
    );
  }
};
