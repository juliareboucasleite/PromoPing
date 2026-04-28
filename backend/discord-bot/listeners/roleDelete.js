/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
const { applyAntiNukeViolation, getGuildAntiNukeConfig } = require("../toolkit/helpers/antinuke-manager");

module.exports = class roleDelete extends Event {
    get name() {
        return 'roleDelete';
    }

    get once() {
        return false;
    }

    async run(role) {
        try {
            const antiNukeData = await getGuildAntiNukeConfig(this.client, role?.guild.id);
            if (!antiNukeData?.enabled) return;
            const logs = await role?.guild.fetchAuditLogs({
                type: 31,
                limit: 1
            }).catch(() => { });

            const log = logs.entries.first();
            if (!log) return;
            const user = log.executor;
            if (!user) return;

            await applyAntiNukeViolation({
                client: this.client,
                guild: role.guild,
                antiNukeData,
                executorId: user.id,
                thresholdKey: "roleDelete",
                reason: "Anti Role Delete | PogyClient Anti-Nuke",
                summary: "Role deletion reverted",
                details: { roleId: role?.id, roleName: role?.name },
                revert: () => role?.guild.roles.create({
                    name: role?.name,
                    color: role?.color,
                    hoist: role?.hoist,
                    mentionable: role?.mentionable,
                    permissions: role?.permissions,
                    position: role?.position,
                    reason: `Anti Role Delete | Synpase Antinuke`
                }).catch(() => { }),
            });
        } catch (err) {
            return;
        }
    }
};


