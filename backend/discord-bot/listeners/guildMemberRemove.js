/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require('../abstract/event');
const { applyAntiNukeViolation, getGuildAntiNukeConfig } = require("../toolkit/helpers/antinuke-manager");

module.exports = class guildMemberRemove extends Event {
    get name() {
        return 'guildMemberRemove';
    }

    get once() {
        return false;
    }

    async run(member) {
        try {
            const guildId = member?.guild.id;
            const antiNukeData = await getGuildAntiNukeConfig(this.client, guildId);
            if (!antiNukeData?.enabled) return;
            const logs = await member?.guild.fetchAuditLogs({
                type: 20,
                limit: 1
            }).catch(() => { });
            const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
            let log = logs.entries.first();
            log = log?.createdTimestamp > twoMinutesAgo ? log : null;
            if (!log) return;
            const user = log.executor;
            if (!user) return;

            await applyAntiNukeViolation({
                client: this.client,
                guild: member.guild,
                antiNukeData,
                executorId: user.id,
                thresholdKey: "kicks",
                reason: "Anti Member Kick | PogyClient Anti-Nuke",
                summary: "Unauthorized member kick detected",
                details: { targetMemberId: member.id },
            });
        } catch (err) {
            return
        }
    }
};


