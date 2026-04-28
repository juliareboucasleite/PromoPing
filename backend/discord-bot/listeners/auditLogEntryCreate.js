/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
const { applyAntiNukeViolation, getGuildAntiNukeConfig } = require("../toolkit/helpers/antinuke-manager");

module.exports = class GuildAuditLogEntryCreate extends Event {
    get name() {
        return 'guildAuditLogEntryCreate';
    }

    get once() {
        return false;
    }

    async run(entry, guild) {
        try {
            if (entry.action == 21) {
                const logs = await guild?.fetchAuditLogs({
                    type: 21,
                    limit: 1
                }).catch(() => {});
                const log = logs.entries.first();
                if (!log) return;

                const antiNukeData = await getGuildAntiNukeConfig(this.client, guild?.id);
                if (!antiNukeData?.enabled) return;

                const user = log.executor;
                if (!user) return;

                await applyAntiNukeViolation({
                    client: this.client,
                    guild,
                    antiNukeData,
                    executorId: user.id,
                    thresholdKey: "kicks",
                    reason: "Anti Member Prune | PogyClient Anti-Nuke",
                    summary: "Mass member prune blocked",
                    details: {
                        action: "member_prune",
                        removedMembers: log.extra?.membersRemoved ?? null,
                        days: log.extra?.deleteMemberDays ?? null,
                    },
                });
                return;
            }

            if (entry.action == 80) {
                const logs = await guild?.fetchAuditLogs({
                    type: 80,
                    limit: 1
                }).catch(() => {});
                const log = logs.entries.first();
                if (!log) return;

                const antiNukeData = await getGuildAntiNukeConfig(this.client, guild?.id);
                if (!antiNukeData?.enabled) return;

                const user = log.executor;
                if (!user) return;

                await applyAntiNukeViolation({
                    client: this.client,
                    guild,
                    antiNukeData,
                    executorId: user.id,
                    thresholdKey: "botAdd",
                    reason: "Anti Bot Add | PogyClient Anti-Nuke",
                    summary: "Suspicious bot add blocked",
                    details: {
                        targetBotId: log.target?.account?.id,
                        action: "bot_add",
                    },
                    revert: async () => {
                        let bot = guild?.members.cache.get(log.target?.account?.id);
                        if (!bot && log.target?.account?.id) {
                            bot = await guild?.members.fetch(log.target.account.id).catch(() => null);
                        }
                        await bot?.kick({ reason: "Anti Bot Add | PogyClient Anti-Nuke" }).catch(() => {});
                    },
                });
                return;
            }
        } catch (err) {
            console.error(err);
        }
    }
};


