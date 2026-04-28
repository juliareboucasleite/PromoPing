const Command = require("../../abstract/command");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");

module.exports = class BlacklistWord extends Command {
  constructor(...args) {
    super(...args, {
      name: "blacklistword",
      aliases: ["badwordblock"],
      description:
        "Create a Blacklist Words AutoMod rule with a custom block message",
      usage: ["blacklistword enable"],
      category: "Moderation",
      userPerms: ["Administrator"],
      botPerms: ["ManageGuild"],
      guildOnly: true,
    });
  }

  async run({ message }) {
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply(
        "❌ You need **Administrator** permissions to use this command."
      );
    }

    // List of blocked words (contains offensive language for realism)
    const blockedWords = [
      "fuck",
      "shit",
      "bitch",
      "asshole",
      "dick",
      "piss",
      "bastard",
      "damn",
      "cunt",
      "faggot",
      "slut",
      "whore",
      "nigger",
      "fucker",
      "motherfucker",
      "cock",
      "penis",
      "vagina",
      "douche",
      "twat",
      "arsehole",
      "prick",
    ];

    try {
      await message.guild.autoModerationRules.create({
        name: "Blacklist Words",
        creatorId: message.author.id,
        enabled: true,
        eventType: 1, // MESSAGE_SEND
        triggerType: 1, // KEYWORD
        triggerMetadata: {
          keywordFilter: blockedWords,
        },
        actions: [
          {
            type: 1, // BLOCK_MESSAGE
            metadata: {
              customMessage: "❌ That word is not allowed!",
            },
          },
        ],
      });

      const embed = new EmbedBuilder()
        
        .setDescription(
          `✅ **Blacklist Words** rule created successfully!\n\n**Blocked words:** ${blockedWords.join(
            ", "
          )}`
        );

      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return message.channel.send(
        "❌ Failed to create **Blacklist Words** rule. Check my permissions and try again."
      );
    }
  }

  async exec({ interaction }) {
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {
      return interaction.reply({
        content:
          "❌ You need **Administrator** permissions to use this command.",
        ephemeral: true,
      });
    }

    const blockedWords = [
      "fuck",
      "shit",
      "bitch",
      "asshole",
      "dick",
      "piss",
      "bastard",
      "damn",
      "cunt",
      "faggot",
      "slut",
      "whore",
      "nigger",
      "fucker",
      "motherfucker",
      "cock",
      "penis",
      "vagina",
      "douche",
      "twat",
      "arsehole",
      "prick",
    ];

    try {
      await interaction.guild.autoModerationRules.create({
        name: "Blacklist Words",
        creatorId: interaction.user.id,
        enabled: true,
        eventType: 1,
        triggerType: 1,
        triggerMetadata: {
          keywordFilter: blockedWords,
        },
        actions: [
          {
            type: 1,
            metadata: {
              customMessage: "❌ That word is not allowed!",
            },
          },
        ],
      });

      const embed = new EmbedBuilder()
        
        .setDescription(
          `✅ **Blacklist Words** rule created successfully!\n\n**Blocked words:** ${blockedWords.join(
            ", "
          )}`
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error(err);
      return interaction.reply({
        content:
          "❌ Failed to create **Blacklist Words** rule. Check my permissions and try again.",
        ephemeral: true,
      });
    }
  }
};



