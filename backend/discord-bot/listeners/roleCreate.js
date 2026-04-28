const Event = require("../abstract/event");
const {
    roleHasDangerousPermissions,
} = require("../toolkit/helpers/moderation-security");
const { applyAntiNukeViolation, getGuildAntiNukeConfig, isTrustedExecutor } = require("../toolkit/helpers/antinuke-manager");

module.exports = class RoleCreate extends Event {
    get name() {
        return "roleCreate";
    }

    get once() {
        return false;
    }

    async run(role) {
        try {
            const antiNukeData = await getGuildAntiNukeConfig(this.client, role.guild.id);
            if (!antiNukeData?.enabled) return;

            const logs = await role.guild.fetchAuditLogs({ type: 30, limit: 1 }).catch(() => null);
            const log = logs?.entries?.first();
            if (!log || log.target.id !== role.id) return;

            const executorId = log.executor?.id;
            if (isTrustedExecutor(this.client, role.guild, executorId, antiNukeData.whitelistusers)) return;

            const executor = await role.guild.members.fetch(executorId).catch(() => null);
            const botMember = role.guild.members.cache.get(this.client.user.id);
            if (!executor || !botMember || executor.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) return;

            const dangerous =
                roleHasDangerousPermissions(role) ||
                role.position >= botMember.roles.highest.position;
            if (!dangerous) return;

            await applyAntiNukeViolation({
                client: this.client,
                guild: role.guild,
                antiNukeData,
                executorId,
                thresholdKey: "roleCreate",
                reason: "Dangerous role creation blocked by PogyClient",
                summary: "Dangerous role creation blocked",
                details: { roleId: role.id, roleName: role.name },
                revert: () => role.delete("Antinuke blocked dangerous role creation.").catch(() => {}),
            });
        } catch {
            return;
        }
    }
};
