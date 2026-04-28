/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
const { applyAntiNukeViolation, getGuildAntiNukeConfig } = require("../toolkit/helpers/antinuke-manager");
module.exports = class guildUpdate extends Event {
  get name() {
    return "guildUpdate";
  }

  get once() {
    return false;
  }

  async run(oldGuild, newGuild) {
    try {
      const antiNukeData = await getGuildAntiNukeConfig(this.client, newGuild?.id);
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
      if (!antiNukeData?.enabled) return;

      const logs = await newGuild
        ?.fetchAuditLogs({
          type: 1,
          limit: 1,
        })
        .catch(() => {});
      let log = logs.entries.first();
      log = log?.createdTimestamp > twoMinutesAgo ? log : null;
      if (!log) return;
      const user = log.executor;
      if (!user) return;

      if (oldGuild.vanityURLCode != newGuild?.vanityURLCode) {
        if (!antiNukeData.antivanity) return;
        if (user.id === this.client.config.Client.VanityGuard) return;

        await applyAntiNukeViolation({
          client: this.client,
          guild: newGuild,
          antiNukeData,
          executorId: user.id,
          thresholdKey: "channelUpdate",
          reason: "Anti Vanity Update | PogyClient Anti-Nuke",
          summary: "Vanity URL tamper reverted",
          details: {
            previousVanity: oldGuild.vanityURLCode,
            nextVanity: newGuild.vanityURLCode,
          },
          revert: () => this.client.util.updateVanity(newGuild, oldGuild.vanityURLCode),
        });
        return;
      } else {
        const options = {
          name: oldGuild.name,
          verificationLevel: oldGuild.verificationLevel,
          explicitContentFilter: oldGuild.explicitContentFilter,
          afkTimeout: oldGuild.afkTimeout,
          description: oldGuild.description,
          preferredLocale: oldGuild.preferredLocale,
          reason: `Anti Guild Update | Synpase Antinuke`,
        };
        if (oldGuild.systemChannel)
          options.systemChannel = oldGuild.systemChannel;
        if (oldGuild.afkChannel) options.afkChannel = oldGuild.afkChannel;
        if (oldGuild.rulesChannel) options.rulesChannel = oldGuild.rulesChannel;
        if (oldGuild.publicUpdatesChannel)
          options.publicUpdatesChannel = oldGuild.publicUpdatesChannel;
        if (oldGuild.widgetChannel)
          options.widgetChannel = oldGuild.widgetChannel;
        if (oldGuild.systemChannelFlags)
          options.systemChannelFlags = oldGuild.systemChannelFlags;
        if (oldGuild.rulesChannel) options.rulesChannel = oldGuild.rulesChannel;
        if (oldGuild.systemChannel)
          options.systemChannel = oldGuild.systemChannel;
        if (oldGuild.publicUpdatesChannelId)
          options.publicUpdatesChannelId = oldGuild.publicUpdatesChannelId;

        await applyAntiNukeViolation({
          client: this.client,
          guild: newGuild,
          antiNukeData,
          executorId: user.id,
          thresholdKey: "channelUpdate",
          reason: "Anti Guild Update | PogyClient Anti-Nuke",
          summary: "Guild settings update reverted",
          details: { guildId: newGuild.id },
          revert: () => newGuild?.edit(options).catch(() => {}),
        });
        return;
      }
    } catch (error) {
      return;
    }
  }
};


