const Command = require("../../abstract/command");
const { EmbedBuilder } = require("discord.js");

module.exports = class reactionrole extends Command {
  constructor(...args) {
    super(...args, {
      name: "reactionrole",
      aliases: ["rr"],
      description: "Manage reaction roles",
      usage: ["reactionrole add <messageLink> <emoji> <role>"],
      category: "Server",
      userPerms: ["ManageRoles"],
      botPerms: [
        "ManageRoles",
        "AddReactions",
        "EmbedLinks",
        "ViewChannel",
        "SendMessages",
      ],
      cooldown: 5,
      guildOnly: true,
      options: [
        {
          type: 3,
          name: "subcommand",
          description: "Subcommand (add/remove)",
          required: true,
        },
        {
          type: 3,
          name: "message",
          description: "The message link",
          required: false,
        },
        {
          type: 3,
          name: "emoji",
          description: "The emoji to react with",
          required: false,
        },
        {
          type: 8,
          name: "role",
          description: "The role to assign",
          required: false,
        },
      ],
    });
  }

  async run({ message, args }) {
    if (!message.member.permissions.has("ManageRoles"))
      return message.reply(
        "❌ You need `Manage Roles` permission to use this command."
      );

    const sub = args[0];
    if (!sub)
      return message.reply(
        "⚙️ Usage: `reactionrole add <messageLink> <emoji> <role>`"
      );

    if (sub.toLowerCase() === "add") {
      const messageLink = args[1];
      const emoji = args[2];
      const role =
        message.mentions.roles.first() ||
        message.guild.roles.cache.get(args[3]);

      if (!messageLink || !emoji || !role) {
        return message.reply(
          "❌ Usage: `reactionrole add <messageLink> <emoji> <role>`"
        );
      }

      // Extract channel + message ID from link
      const match = messageLink.match(
        /https:\/\/discord\.com\/channels\/\d+\/(\d+)\/(\d+)/
      );
      if (!match) return message.reply("❌ Invalid message link.");

      const channelId = match[1];
      const messageId = match[2];

      const targetChannel = await this.client.channels
        .fetch(channelId)
        .catch(() => null);
      if (!targetChannel) return message.reply("❌ Channel not found.");

      const targetMessage = await targetChannel.messages
        .fetch(messageId)
        .catch(() => null);
      if (!targetMessage) return message.reply("❌ Message not found.");

      // Add the reaction
      try {
        await targetMessage.react(emoji);
      } catch {
        return message.reply(
          "❌ I couldn’t react with that emoji. Make sure it’s valid."
        );
      }

      // Save to DB
      await this.client.db.push(`reactionroles_${message.guild.id}`, {
        messageId,
        channelId,
        emoji,
        roleId: role.id,
      });

      return message.reply({
        embeds: [
          new EmbedBuilder()
            
            .setTitle("✅ Reaction Role Added")
            .setDescription(
              `React with ${emoji} on [this message](${messageLink}) to get ${role}`
            ),
        ],
      });
    }
  }

  async exec({ interaction }) {
    const sub = interaction.options.getString("subcommand");
    if (!interaction.member.permissions.has("ManageRoles"))
      return interaction.reply({
        content: "❌ You need `Manage Roles` permission.",
        ephemeral: true,
      });

    if (sub.toLowerCase() === "add") {
      const messageLink = interaction.options.getString("message");
      const emoji = interaction.options.getString("emoji");
      const role = interaction.options.getRole("role");

      if (!messageLink || !emoji || !role) {
        return interaction.reply({
          content: "❌ Usage: `/reactionrole add <messageLink> <emoji> <role>`",
          ephemeral: true,
        });
      }

      // Extract channel + message ID from link
      const match = messageLink.match(
        /https:\/\/discord\.com\/channels\/\d+\/(\d+)\/(\d+)/
      );
      if (!match)
        return interaction.reply({
          content: "❌ Invalid message link.",
          ephemeral: true,
        });

      const channelId = match[1];
      const messageId = match[2];

      const targetChannel = await interaction.client.channels
        .fetch(channelId)
        .catch(() => null);
      if (!targetChannel)
        return interaction.reply({
          content: "❌ Channel not found.",
          ephemeral: true,
        });

      const targetMessage = await targetChannel.messages
        .fetch(messageId)
        .catch(() => null);
      if (!targetMessage)
        return interaction.reply({
          content: "❌ Message not found.",
          ephemeral: true,
        });

      // Add the reaction
      try {
        await targetMessage.react(emoji);
      } catch {
        return interaction.reply({
          content: "❌ I couldn’t react with that emoji.",
          ephemeral: true,
        });
      }

      // Save to DB
      await this.client.db.push(`reactionroles_${interaction.guild.id}`, {
        messageId,
        channelId,
        emoji,
        roleId: role.id,
      });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            
            .setTitle("✅ Reaction Role Added")
            .setDescription(
              `React with ${emoji} on [this message](${messageLink}) to get ${role}`
            ),
        ],
      });
    }
  }
};



