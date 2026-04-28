/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
const { applyAntiNukeViolation, getGuildAntiNukeConfig } = require("../toolkit/helpers/antinuke-manager");

module.exports = class channelDelete extends Event {
    get name() {
        return 'channelDelete';
    }

    get once() {
        return false;
    }

    async run(channel) {
        try {
            const guildId = channel?.guild.id;
            const antiNukeData = await getGuildAntiNukeConfig(this.client, guildId);
            if (!antiNukeData?.enabled) return;
            const logs = await channel?.guild.fetchAuditLogs({
                type: 12,
                limit: 1
            }).catch(() => { });

            const log = logs.entries.first();
            if (!log) return;
            const user = log.executor;
            if (!user) return;

            await applyAntiNukeViolation({
                client: this.client,
                guild: channel.guild,
                antiNukeData,
                executorId: user.id,
                thresholdKey: "channelDelete",
                reason: "Anti Channel Delete | PogyClient Anti-Nuke",
                summary: "Channel deletion blocked",
                details: { channelName: channel?.name, channelId: channel?.id },
                revert: () => channel?.clone({ name: channel?.name }).catch(() => {}),
            });
        } catch (err) {
            return;
        }
    }
};


