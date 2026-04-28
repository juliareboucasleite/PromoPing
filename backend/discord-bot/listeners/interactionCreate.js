/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
const { BaseInteraction } = require("discord.js");
const {
  buildApplicationModal,
  createSubmission,
  reviewSubmission,
} = require("../toolkit/helpers/applications");
const {
  closeTicketChannel,
  createTicketChannel,
} = require("../toolkit/helpers/tickets");


module.exports = class interactionCreate extends Event {
  get name() {
    return "interactionCreate";
  }
  get once() {
    return false;
  }

  /**
   * @param {BaseInteraction} interaction
   */
  async run(interaction) {
    try {
      if (!interaction?.guild || interaction?.channel.type == 1)
        return interaction?.reply({
          content: "This command is not available in DMs!",
          flags: 64,
        });

      if (!interaction?.guild.config) {
        interaction.guild.config = await this.client.database.guildData.get(
          interaction?.guild.id
        );
      }
      interaction.guild.config = await this.client.database.guildData.get(
        interaction?.guild.id
      );

      /**
       * ✅ Ticket Interaction Handling
  

      /**
       * ✅ Other interactions (your existing checks)
       */
      if (interaction?.isButton() && interaction.customId === "ticket:create") {
        await interaction.deferReply({ flags: 64 }).catch(() => null);
        const result = await createTicketChannel(interaction, this.client);
        if (result?.error) {
          return interaction.editReply({ content: result.error }).catch(() => null);
        }
        return interaction.editReply({
          content: `Your ticket has been opened: ${result.channel}`,
        }).catch(() => null);
      }

      if (interaction?.isButton() && interaction.customId === "ticket:close") {
        await interaction.deferReply({ flags: 64 }).catch(() => null);
        const result = await closeTicketChannel(interaction, this.client);
        if (result?.error) {
          return interaction.editReply({ content: result.error }).catch(() => null);
        }
        return interaction.editReply({ content: "Closing this ticket in 3 seconds..." }).catch(() => null);
      }

      if (interaction?.isButton() && interaction.customId === "application:start") {
        const config = await this.client.database.guildData.get(interaction.guild.id);
        return interaction.showModal(buildApplicationModal(config?.applications || {}));
      }

      if (interaction?.isModalSubmit() && interaction.customId === "application:submit") {
        await interaction.deferReply({ flags: 64 }).catch(() => null);
        const result = await createSubmission(interaction, this.client);
        if (result?.error) {
          return interaction.editReply({ content: result.error }).catch(() => null);
        }
        return interaction.editReply({
          content: `Application #${result.submission.applicationId} submitted successfully.`,
        }).catch(() => null);
      }

      if (interaction?.isButton() && interaction.customId.startsWith("application:")) {
        const [, decision, submissionId] = interaction.customId.split(":");
        if (["approve", "deny"].includes(decision)) {
          const result = await reviewSubmission(interaction, this.client, decision, submissionId);
          if (result?.error) {
            return interaction.reply({ content: result.error, flags: 64 }).catch(() => null);
          }
          return;
        }
      }

      if (interaction?.isButton() && interaction?.customId == "verify_server") {
        return this.client.emit("serverVerificationCreate", interaction);
      }

      if (
        interaction?.isButton() &&
        interaction?.customId.startsWith("giveaway-")
      ) {
        let id = interaction?.customId.split("-")[1];
        let giveaway = this.client.giveawayManager.giveaways.find(
          (g) => g.messageId === id
        );
        if (!giveaway)
          return interaction?.reply({
            content: `This giveaway is not found!`,
            flags: 64,
          });
        if (giveaway.ended)
          return interaction?.reply({
            content: `This giveaway is ended!`,
            flags: 64,
          });
        if (giveaway.entered.includes(interaction?.user.id)) {
          giveaway.entered = giveaway.entered.filter(
            (u) => u !== interaction?.user.id
          );
          this.client.giveawayManager.editData(giveaway);
          const button = await this.client.giveawayManager.embedButton(
            giveaway
          );
          interaction?.message?.edit({
            components: [this.client.util.row().addComponents(button)],
          });
          return interaction?.reply({
            content: `You have left the giveaway successfully!`,
            flags: 64,
          });
        }
        interaction?.reply({
          content: `You have joined the giveaway successfully!`,
          flags: 64,
        });
        giveaway.entered.push(interaction?.user.id);
        this.client.giveawayManager.editData(giveaway);
        const button = await this.client.giveawayManager.embedButton(giveaway);
        interaction?.message?.edit({
          components: [this.client.util.row().addComponents(button)],
        });
      }

      if (
        interaction?.isModalSubmit() &&
        interaction?.customId === "modal_verification_sumbit"
      ) {
        return this.client.emit("serverVerificationSubmit", interaction);
      }

      if (
        interaction?.isButton() &&
        interaction?.customId.startsWith("setup_")
      ) {
        if (interaction?.user.id !== interaction?.guild?.ownerId)
          return interaction.reply({
            content: `Only the server owner can use this button!`,
            flags: 64,
          });
        await interaction?.reply({
          content: `Setup has been started!`,
          flags: 64,
        });
        this.client.commandFunctions.SetupFunction.setup(interaction, true);
      }

      if (interaction?.isButton() && interaction?.customId == "eval_delete") {
        return interaction?.message?.delete().catch(() => {});
      }

      // ✅ Slash command handling
      if (interaction?.type != 2) return;
      const command = this.client.commands.get(interaction?.commandName);
      if (!command) return;

      // ... (rest of your command permission checks unchanged)

      const cmdr = await command.exec({ interaction });
      await this.client.dashboardTelemetry?.command(
        interaction,
        command.name,
        command.category
      );
      return cmdr;
    } catch (error) {
      return;
    }
  }
};



