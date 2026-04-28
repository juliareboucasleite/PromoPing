/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
const { applyAntiNukeViolation, getGuildAntiNukeConfig } = require("../toolkit/helpers/antinuke-manager");

module.exports = class channelCreate extends Event {
    get name() {
        return 'channelCreate';
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
                type: 10,
                limit: 1,
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
                thresholdKey: "channelCreate",
                reason: "Anti Channel Create | PogyClient Anti-Nuke",
                summary: "Channel creation blocked",
                details: { channelId: channel.id, channelName: channel.name },
                revert: () => channel.delete("Anti Channel Create").catch(() => {}),
            });
        }
        catch (err) {
            return;
        }
    }
};


