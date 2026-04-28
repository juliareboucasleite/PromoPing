const Event = require("../abstract/event");
const {
    roleHasDangerousPermissions,
} = require("../toolkit/helpers/moderation-security");
const { applyAntiNukeViolation, getGuildAntiNukeConfig, isTrustedExecutor } = require("../toolkit/helpers/antinuke-manager");

module.exports = class GuildMemberUpdate extends Event {
    get name() {
        return "guildMemberUpdate";
    }

    get once() {
        return false;
    }

    async run(oldMember, newMember) {
        if (oldMember.nickname !== newMember.nickname) {
            const data = await this.client.database.stickynickData.get(
                newMember.id,
                newMember.guild.id
            );
            if (data?.nick && newMember.nickname !== data.nick) {
                await newMember.setNickname(data.nick).catch(() => {});
            }
        }

        try {
            const antiNukeData = await getGuildAntiNukeConfig(this.client, newMember.guild.id);
            if (!antiNukeData?.enabled) return;

            const addedRoleIds = newMember.roles.cache
                .filter((role) => !oldMember.roles.cache.has(role.id))
                .map((role) => role.id);
            if (!addedRoleIds.length) return;

            const logs = await newMember.guild.fetchAuditLogs({ type: 25, limit: 1 }).catch(() => null);
            const log = logs?.entries?.first();
            if (!log || log.target.id !== newMember.id) return;

            const executorId = log.executor?.id;
            if (isTrustedExecutor(this.client, newMember.guild, executorId, antiNukeData.whitelistusers)) return;

            const executor = await newMember.guild.members.fetch(executorId).catch(() => null);
            const botMember = newMember.guild.members.cache.get(this.client.user.id);
            if (!executor || !botMember || executor.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) return;

            const dangerousRoles = newMember.roles.cache.filter((role) =>
                addedRoleIds.includes(role.id) &&
                (roleHasDangerousPermissions(role) || role.position >= botMember.roles.highest.position)
            );
            if (!dangerousRoles.size) return;

            await applyAntiNukeViolation({
                client: this.client,
                guild: newMember.guild,
                antiNukeData,
                executorId,
                thresholdKey: "roleUpdate",
                reason: "Dangerous role grant blocked by PogyClient",
                summary: "Dangerous role grant reverted",
                details: { targetMemberId: newMember.id, roleIds: dangerousRoles.map((role) => role.id) },
                revert: () => newMember.roles.remove(dangerousRoles, "Antinuke removed dangerous role grants.").catch(() => {}),
            });
        } catch {
            return;
        }
    }
};
