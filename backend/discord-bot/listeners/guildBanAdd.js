/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
const { applyAntiNukeViolation, getGuildAntiNukeConfig } = require("../toolkit/helpers/antinuke-manager");

module.exports = class guildBanAdd extends Event {
  get name() {
    return 'guildBanAdd';
  }

  get once() {
    return false;
  }

  async run(ban) {
    try {
      const guildId = ban?.guild.id;
      const antiNukeData = await getGuildAntiNukeConfig(this.client, guildId);
      if (!antiNukeData?.enabled) return;
      const logs = await ban?.guild?.fetchAuditLogs({
        type: 22,
        limit: 1
      }).catch(() => { });

      const log = logs.entries.first();
      if (!log) return;
      const user = log.executor;
      if (!user) return;

      await applyAntiNukeViolation({
        client: this.client,
        guild: ban.guild,
        antiNukeData,
        executorId: user.id,
        thresholdKey: "bans",
        reason: "Anti Ban | PogyClient Anti-Nuke",
        summary: "Unauthorized ban reverted",
        details: { targetUserId: ban?.user?.id },
        revert: () => ban?.guild.bans.remove(ban?.user?.id, 'Anti Ban | PogyClient Anti-Nuke').catch(() => {}),
      });
    } catch (err) {
      return;
    }
  }
};


