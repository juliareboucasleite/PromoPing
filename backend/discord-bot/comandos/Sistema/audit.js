const Command = require("../../abstract/command");
const { EmbedBuilder } = require("discord.js");

module.exports = class Audit extends Command {
  constructor(...args) {
    super(...args, {
      name: "audit",
      aliases: ["auditlog"],
      description: "View the server's audit logs.",
      usage: ["audit <action|user> [limit]"],
      category: "Utilities",
      userPerms: ["ViewAuditLog", "SendMessages"],
      botPerms: ["EmbedLinks", "ViewAuditLog", "SendMessages"],
      cooldown: 5,
      guildOnly: true,
      options: [
        {
          type: 3,
          name: "action",
          description: "The audit log action type (optional)",
          required: false,
        },
        {
          type: 6,
          name: "user",
          description: "The user to filter audit logs by",
          required: false,
        },
        {
          type: 4,
          name: "limit",
          description: "Number of logs to fetch (max 20)",
          required: false,
        },
      ],
    });
  }

  async run({ message, args }) {
    const guild = message.guild;
    let actionType = args[0];
    let user = null;
    let limit = 5;

    if (args[1]) {
      const fetched = await this.client.util.userQuery(args[1]);
      if (fetched) user = await guild.members.fetch(fetched).catch(() => null);
    }

    if (args[2]) limit = Math.min(parseInt(args[2]) || 5, 20);

    const entries = await guild
      .fetchAuditLogs({
        type: actionType ? actionType.toUpperCase() : null,
        limit,
      })
      .catch(() => null);

    if (!entries) return message.reply("❌ Could not fetch audit logs.");

    let logs = entries.entries
      .filter((e) => (user ? e.executor.id === user.id : true))
      .map(
        (e, i) =>
          `**${i + 1}.** \`${e.action}\` by <@${e.executor.id}> | Target: ${
            e.target?.toString() || "Unknown"
          }`
      )
      .join("\n");

    if (!logs) logs = "No matching audit logs found.";

    const embed = new EmbedBuilder()
      .setTitle(`📝 Audit Logs for ${guild.name}`)
      
      .setDescription(logs)
      .setFooter({
        text: `Requested by ${message.author.tag}`,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  async exec({ interaction }) {
    const guild = interaction.guild;
    const actionType = interaction.options.getString("action");
    const userOption = interaction.options.getUser("user");
    const limit = Math.min(interaction.options.getInteger("limit") || 5, 20);

    const entries = await guild
      .fetchAuditLogs({
        type: actionType ? actionType.toUpperCase() : null,
        limit,
      })
      .catch(() => null);

    if (!entries)
      return interaction.reply({
        content: "❌ Could not fetch audit logs.",
        ephemeral: true,
      });

    let logs = entries.entries
      .filter((e) => (userOption ? e.executor.id === userOption.id : true))
      .map(
        (e, i) =>
          `**${i + 1}.** \`${e.action}\` by <@${e.executor.id}> | Target: ${
            e.target?.toString() || "Unknown"
          }`
      )
      .join("\n");

    if (!logs) logs = "No matching audit logs found.";

    const embed = new EmbedBuilder()
      .setTitle(`📝 Audit Logs for ${guild.name}`)
      
      .setDescription(logs)
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};



