const Event = require("../abstract/event");
const {
    roleHasDangerousPermissions,
} = require("../toolkit/helpers/moderation-security");
const { applyAntiNukeViolation, getGuildAntiNukeConfig, isTrustedExecutor } = require("../toolkit/helpers/antinuke-manager");

module.exports = class RoleUpdate extends Event {
    get name() {
        return "roleUpdate";
    }

    get once() {
        return false;
    }

    async run(oldRole, newRole) {
        try {
            const antiNukeData = await getGuildAntiNukeConfig(this.client, newRole.guild.id);
            if (!antiNukeData?.enabled) return;

            const logs = await newRole.guild.fetchAuditLogs({ type: 31, limit: 1 }).catch(() => null);
            const log = logs?.entries?.first();
            if (!log || log.target.id !== newRole.id) return;

            const executorId = log.executor?.id;
            if (isTrustedExecutor(this.client, newRole.guild, executorId, antiNukeData.whitelistusers)) return;

            const executor = await newRole.guild.members.fetch(executorId).catch(() => null);
            const botMember = newRole.guild.members.cache.get(this.client.user.id);
            if (!executor || !botMember || executor.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) return;

            const becameDangerous =
                roleHasDangerousPermissions(newRole) ||
                newRole.position >= botMember.roles.highest.position;
            if (!becameDangerous) return;

            await applyAntiNukeViolation({
                client: this.client,
                guild: newRole.guild,
                antiNukeData,
                executorId,
                thresholdKey: "roleUpdate",
                reason: "Dangerous role update blocked by PogyClient",
                summary: "Dangerous role update reverted",
                details: { roleId: newRole.id, roleName: newRole.name },
                revert: () => newRole.edit({
                    name: oldRole.name,
                    color: oldRole.color,
                    hoist: oldRole.hoist,
                    mentionable: oldRole.mentionable,
                    permissions: oldRole.permissions,
                    reason: "Antinuke reverted dangerous role update.",
                }).catch(() => {}),
            });
        } catch {
            return;
        }
    }
};
