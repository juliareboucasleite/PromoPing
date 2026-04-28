/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require('../abstract/event');
const { applyAntiNukeViolation, getGuildAntiNukeConfig } = require("../toolkit/helpers/antinuke-manager");
module.exports = class webhookUpdate extends Event {
    get name() {
        return 'webhooksUpdate';
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
                type: 50,
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
                thresholdKey: "webhookUpdate",
                reason: "Webhook Update | PogyClient Anti-Nuke",
                summary: "Webhook update blocked",
                details: { channelId: channel.id },
                revert: async () => {
                    const webhooks = await channel?.fetchWebhooks().catch(() => null);
                    for (const webhook of webhooks?.map?.((entry) => entry) ?? []) {
                        await webhook.delete().catch(() => {});
                    }
                },
            });
        }
        catch (err) {
            return;
        }
    }
};


