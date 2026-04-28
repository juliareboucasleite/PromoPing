/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
const { applyAntiNukeViolation, getGuildAntiNukeConfig } = require("../toolkit/helpers/antinuke-manager");

module.exports = class channelUpdate extends Event {
    get name() {
        return 'channelUpdate';
    }

    get once() {
        return false;
    }

    async run(oldChannel, newChannel) {
        try {
            const guildId = newChannel?.guild.id;
            const antiNukeData = await getGuildAntiNukeConfig(this.client, guildId);
            if (!antiNukeData?.enabled) return;
            const logs = await newChannel?.guild.fetchAuditLogs({
                limit: 1
            }).catch(() => { });
            const log = logs.entries.first();
            if (!log) return;
            const user = log.executor;
            if (!user) return;
            if (newChannel?.id == log.target.id) {
                await applyAntiNukeViolation({
                    client: this.client,
                    guild: newChannel.guild,
                    antiNukeData,
                    executorId: user.id,
                    thresholdKey: "channelUpdate",
                    reason: "Anti Channel Update | PogyClient Anti-Nuke",
                    summary: "Channel update reverted",
                    details: { channelId: newChannel.id, channelName: newChannel.name },
                    revert: () => newChannel?.edit({
                        name: oldChannel.name,
                        type: oldChannel.type,
                        topic: oldChannel.topic,
                        nsfw: oldChannel.nsfw,
                        position: oldChannel.position,
                        rateLimitPerUser: oldChannel.rateLimitPerUser,
                        reason: `Anti Channel Update`
                    }).catch(() => {}),
                });
                return;
            }
        } catch (err) {
            return;
        }
    }
};


