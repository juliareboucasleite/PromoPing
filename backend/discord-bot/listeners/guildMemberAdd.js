const Event = require("../abstract/event");
const {
    roleHasDangerousPermissions,
} = require("../toolkit/helpers/moderation-security");
const { applyAntiNukeViolation, getGuildAntiNukeConfig, isTrustedExecutor } = require("../toolkit/helpers/antinuke-manager");

module.exports = class GuildMemberAdd extends Event {
    get name() {
        return "guildMemberAdd";
    }

    get once() {
        return false;
    }

    async run(member) {
        try {
            if (member.user.bot) {
                await this.handleBotJoin(member);
            }

            const profile = await this.client.database.guildData.get(member.guild.id);
            if (!profile) return;

            await this.handleWelcome(member, profile);
            await this.handleAutoRole(member, profile);
            await this.handleGreet(member, profile);
        } catch {
            return;
        }
    }

    async handleBotJoin(member) {
        const antiNukeData = await getGuildAntiNukeConfig(this.client, member.guild.id);
        if (!antiNukeData?.enabled) return;

        const logs = await member.guild.fetchAuditLogs({ type: 28, limit: 1 }).catch(() => null);
        const log = logs?.entries?.first();
        if (!log || member.id !== log.target.id) return;

        const executorId = log.executor?.id;
        if (isTrustedExecutor(this.client, member.guild, executorId, antiNukeData.whitelistusers)) return;

        const executor = await member.guild.members.fetch(executorId).catch(() => null);
        const botMember = member.guild.members.resolve(this.client.user);
        if (!executor || !botMember || executor.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) {
            return;
        }

        await applyAntiNukeViolation({
            client: this.client,
            guild: member.guild,
            antiNukeData,
            executorId,
            thresholdKey: "botAdd",
            reason: "Unauthorized bot add blocked by PogyClient",
            summary: "Unauthorized bot add blocked",
            details: { botId: member.id },
            revert: () => member.kick("Antinuke blocked unauthorized bot add.").catch(() => {}),
        });
    }

    async handleWelcome(member, profile) {
        if (!profile.welcome?.channel) return;
        const channel = member.guild.channels.cache.get(profile.welcome.channel);
        if (!channel?.isTextBased?.()) return;

        const raw = profile.welcome.content || "Welcome $user_mention to $guild_name!";
        const content = await this.client.util.replaceOriginal(raw, member);
        await channel.send({
            content,
            allowedMentions: { users: [member.id], parse: [] },
        }).catch(() => {});
    }

    async handleAutoRole(member, profile) {
        if (!profile.autorole?.enabled) return;
        const configuredRoles = member.user.bot ? profile.autorole.botRoles : profile.autorole.humanRoles;
        if (!Array.isArray(configuredRoles) || !configuredRoles.length) return;

        const botMember = member.guild.members.resolve(this.client.user);
        const safeRoleIds = configuredRoles.filter((roleId) => {
            const role = member.guild.roles.cache.get(roleId);
            if (!role) return false;
            if (role.managed) return false;
            if (roleHasDangerousPermissions(role)) return false;
            if (!botMember || role.position >= botMember.roles.highest.position) return false;
            return true;
        });

        if (!safeRoleIds.length) return;
        await member.roles.add(safeRoleIds, `Safe autorole system | ${this.client.user.username}`).catch(() => {});
    }

    async handleGreet(member, profile) {
        if (!profile.greet?.enabled || !Array.isArray(profile.greet.channel) || !profile.greet.channel.length) {
            return;
        }

        const content = await this.client.util.replaceOriginal(
            profile.greet.content || "Welcome $user_mention to $guild_name!",
            member
        );

        for (const channelId of profile.greet.channel) {
            const channel = member.guild.channels.cache.get(channelId);
            if (!channel?.isTextBased?.()) continue;

            await channel.send({
                content,
                allowedMentions: { users: [member.id], parse: [] },
            }).then((sent) => {
                setTimeout(() => sent.delete().catch(() => {}), profile.greet.deletetime || 5000);
            }).catch(() => {});
        }
    }
};
