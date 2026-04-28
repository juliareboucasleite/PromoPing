const Event = require("../abstract/event");
const { Collection } = require("discord.js");
const {
    buildAuditReason,
    countUppercaseRatio,
    countVisibleMentions,
    hasInvite,
    hasLink,
    sanitizeText,
    validateRoleOperation,
    validateTargetMember,
} = require("../toolkit/helpers/moderation-security");
const { getGuildAutomodConfig } = require("../toolkit/helpers/automod-manager");
const { applyAntiNukeViolation, getGuildAntiNukeConfig } = require("../toolkit/helpers/antinuke-manager");

module.exports = class MessageCreate extends Event {
    constructor(...args) {
        super(...args);
        this.ratelimits = new Collection();
        this.spamWindows = new Collection();
        this.repeatWindows = new Collection();
    }

    get name() {
        return "messageCreate";
    }

    get once() {
        return false;
    }

    async run(message) {
        try {
            if (!message.guild || message.author.bot || message.channel?.type === 1) return;

            await this.handleAfk(message);

            const guildConfig = await this.getGuildConfig(message.guild.id);
            if (!guildConfig) return;

            if (await this.handleDirectMention(message, guildConfig)) return;

            const antiNukeData = await this.getAntiNukeConfig(message.guild.id);
            if (await this.handleMassMentionAbuse(message, antiNukeData)) return;

            if (await this.handleCustomRoleShortcut(message, guildConfig)) return;

            if (await this.handleAutomod(message, guildConfig)) return;

            await this.handleCommandDispatch(message, guildConfig);
        } catch (error) {
            console.error("messageCreate failed:", error);
        }
    }

    async handleAfk(message) {
        const afkdata = await this.client.database.afkData.get(message.author.id);
        if (!afkdata) return;
        await this.client.database.afkData.deleteAfk(message.author.id);
        await message.channel.send({
            content: `**${message.author.username}**, your AFK has been removed.`,
            allowedMentions: { parse: [] },
        });
    }

    async getGuildConfig(guildId) {
        let config = await this.client.cache.get(`${guildId}1`);
        if (!config) {
            config = await this.client.database.guildData.get(guildId);
            if (config) {
                await this.client.cache.set(`${guildId}1`, config);
            }
        }
        return config;
    }

    async getAntiNukeConfig(guildId) {
        return getGuildAntiNukeConfig(this.client, guildId);
    }

    async handleDirectMention(message, guildConfig) {
        const mentionRegex = new RegExp(`^<@!?${this.client.user.id}>$`);
        if (!mentionRegex.test(message.content.trim())) return false;

        const prefix = guildConfig.prefix || this.client.config.Client.Prefix;
        await message.channel.send({
            content: `Prefix for this server is \`${prefix}\`. Use \`${prefix}help\` to browse commands.`,
            allowedMentions: { parse: [], repliedUser: false },
        });
        return true;
    }

    isAntinukeTrusted(message, antiNukeData) {
        if (!antiNukeData?.enabled) return true;
        if (message.author.id === this.client.user.id) return true;
        if (this.client.util.checkOwner(message.author.id)) return true;
        if (message.author.id === message.guild.ownerId) return true;
        if (antiNukeData.whitelistusers?.includes(message.author.id)) return true;
        return false;
    }

    async handleMassMentionAbuse(message, antiNukeData) {
        const everyoneAbuse =
            message.mentions.everyone &&
            message.member.permissions.has(PermissionsBitField.Flags.MentionEveryone);
        if (!everyoneAbuse) return false;

        if (this.isAntinukeTrusted(message, antiNukeData)) return false;

        await applyAntiNukeViolation({
            client: this.client,
            guild: message.guild,
            antiNukeData,
            executorId: message.author.id,
            thresholdKey: "kicks",
            reason: "Mass mention abuse blocked by PogyClient",
            summary: "Mass mention abuse blocked",
            details: {
                channelId: message.channel.id,
                messageId: message.id,
            },
            revert: () => message.delete().catch(() => {}),
        });
        return true;
    }

    async handleCustomRoleShortcut(message, guildConfig) {
        const mentionRegexPrefix = new RegExp(`^<@!?${this.client.user.id}>`);
        let noprefixdata = await this.client.cache.get(this.client.user.id);
        if (!noprefixdata) {
            noprefixdata = await this.client.database.noprefixUserData.get(this.client.user.id);
            if (noprefixdata) {
                await this.client.cache.set(this.client.user.id, noprefixdata);
            }
        }

        const prefix = message.content.match(mentionRegexPrefix)
            ? message.content.match(mentionRegexPrefix)[0]
            : (guildConfig.prefix || this.client.config.Client.Prefix);

        const noPrefixUsers = Array.isArray(noprefixdata?.userids) ? noprefixdata.userids : [];
        const checkNoPrefix = noPrefixUsers.includes(message.author.id);
        if (!message.content.toLowerCase().startsWith(prefix.toLowerCase()) && !checkNoPrefix) {
            return false;
        }

        const args = message.content.startsWith(prefix)
            ? message.content.slice(prefix.length).trim().split(/ +/)
            : message.content.trim().split(/ +/);

        const cmd = args.shift()?.toLowerCase();
        const roleNames = Array.isArray(guildConfig.CustomRoles)
            ? guildConfig.CustomRoles.map((entry) => entry.name.toLowerCase())
            : [];

        if (!cmd || !roleNames.includes(cmd) || cmd === "manager") {
            return false;
        }

        const customRoleEntry = guildConfig.CustomRoles.find((entry) => entry.name.toLowerCase() === cmd);
        const role = message.guild.roles.cache.get(customRoleEntry?.roleId);
        if (!role) {
            return true;
        }

        const userId = await this.client.util.userQuery(args[0]);
        if (!userId) {
            await message.reply({ content: "Provide a valid user.", allowedMentions: { parse: [] } });
            return true;
        }

        const targetMember = await message.guild.members.fetch(userId).catch(() => null);
        if (!targetMember) {
            await message.reply({ content: "That user is not in this server.", allowedMentions: { parse: [] } });
            return true;
        }

        const managerRole = guildConfig.manager;
        if (managerRole && !message.member.roles.cache.has(managerRole)) {
            await message.reply({
                content: "You do not have the configured manager role required to use custom role shortcuts.",
                allowedMentions: { parse: [] },
            });
            return true;
        }

        const roleGate = validateRoleOperation({
            client: this.client,
            guild: message.guild,
            actorMember: message.member,
            role,
            action: "assign",
            allowDangerous: false,
        });
        if (!roleGate.ok) {
            await message.reply({ content: roleGate.error, allowedMentions: { parse: [] } });
            return true;
        }

        const targetGate = validateTargetMember({
            client: this.client,
            guild: message.guild,
            actorMember: message.member,
            targetMember,
            action: "manage",
            requireModeratable: false,
        });
        if (!targetGate.ok) {
            await message.reply({ content: targetGate.error, allowedMentions: { parse: [] } });
            return true;
        }

        const shouldRemove = targetMember.roles.cache.has(role.id);
        const auditReason = buildAuditReason(
            shouldRemove ? "Custom role remove" : "Custom role add",
            message.author.username,
            `${role.name} -> ${targetMember.user.tag}`
        );

        if (shouldRemove) {
            await targetMember.roles.remove(role.id, auditReason).catch(() => null);
        } else {
            await targetMember.roles.add(role.id, auditReason).catch(() => null);
        }

        await message.reply({
            content: `${shouldRemove ? "Removed" : "Added"} **${role.name}** ${shouldRemove ? "from" : "to"} **${targetMember.user.tag}**.`,
            allowedMentions: { parse: [] },
        });
        return true;
    }

    shouldBypassAutomod(message, automodConfig) {
        if (!automodConfig.enabled) return true;
        if (this.client.util.checkOwner(message.author.id)) return true;
        if (message.author.id === message.guild.ownerId) return true;
        if (automodConfig.exemptChannels?.includes(message.channel.id)) return true;
        if (automodConfig.exemptRoles?.some((roleId) => message.member.roles.cache.has(roleId))) return true;
        return false;
    }

    pushWindow(collection, key, payload, windowMs) {
        const now = Date.now();
        const entries = collection.get(key) ?? [];
        const next = [...entries, payload].filter((entry) => now - entry.timestamp <= windowMs);
        collection.set(key, next);
        return next;
    }

    resolveAutomodViolation(message, automodConfig) {
        const content = message.content ?? "";
        const trimmed = content.trim();
        if (!trimmed) return null;

        const mentionCount = countVisibleMentions(message);
        if (
            automodConfig.massMention.enabled &&
            (
                mentionCount >= automodConfig.massMention.limit ||
                (automodConfig.massMention.blockEveryone && message.mentions.everyone)
            )
        ) {
            return {
                rule: "Mass Mentions",
                reason: "Too many mentions in one message.",
            };
        }

        if (automodConfig.inviteLinks.enabled && hasInvite(trimmed)) {
            return {
                rule: "Invite Links",
                reason: "Invite links are not allowed here.",
            };
        }

        if (automodConfig.externalLinks.enabled && hasLink(trimmed)) {
            return {
                rule: "External Links",
                reason: "External links are not allowed here.",
            };
        }

        if (
            automodConfig.caps.enabled &&
            trimmed.length >= automodConfig.caps.minimumLength &&
            countUppercaseRatio(trimmed) >= automodConfig.caps.ratio
        ) {
            return {
                rule: "Excessive Caps",
                reason: "Please avoid sending messages with excessive capitalization.",
            };
        }

        const spamEntries = this.pushWindow(
            this.spamWindows,
            `${message.guild.id}:${message.author.id}`,
            { timestamp: Date.now(), content: trimmed },
            automodConfig.spam.intervalMs
        );
        if (automodConfig.spam.enabled && spamEntries.length >= automodConfig.spam.maxMessages) {
            return {
                rule: "Spam",
                reason: "Too many messages were sent too quickly.",
            };
        }

        const repeatEntries = this.pushWindow(
            this.repeatWindows,
            `${message.guild.id}:${message.author.id}`,
            { timestamp: Date.now(), content: trimmed.toLowerCase() },
            automodConfig.repeatedMessages.windowMs
        );
        const repeatCount = repeatEntries.filter(
            (entry) => entry.content === trimmed.toLowerCase()
        ).length;
        if (
            automodConfig.repeatedMessages.enabled &&
            repeatCount >= automodConfig.repeatedMessages.threshold
        ) {
            return {
                rule: "Repeated Messages",
                reason: "Repeated messages are not allowed.",
            };
        }

        return null;
    }

    async applyAutomodAction(message, automodConfig, violation) {
        await message.delete().catch(() => {});

        await this.client.dashboardTelemetry?.automod(
            message,
            violation,
            automodConfig.action
        );

        if (automodConfig.action === "timeout" && message.member.moderatable) {
            await message.member
                .timeout(
                    automodConfig.timeoutDurationMs,
                    buildAuditReason("Automod timeout", this.client.user.username, violation.rule)
                )
                .catch(() => {});
        }

        if (automodConfig.action === "kick" && message.member.kickable) {
            await message.member
                .kick(buildAuditReason("Automod kick", this.client.user.username, violation.rule))
                .catch(() => {});
        }

        if (automodConfig.action === "ban" && message.member.bannable) {
            await message.member
                .ban({
                    deleteMessageSeconds: 0,
                    reason: buildAuditReason("Automod ban", this.client.user.username, violation.rule),
                })
                .catch(() => {});
        }

        await message.channel.send({
            content: `Automod blocked a message from **${sanitizeText(message.author.tag, { maxLength: 80 })}**. Rule: **${violation.rule}**. ${violation.reason}`,
            allowedMentions: { parse: [] },
        }).then((notice) => {
            setTimeout(() => notice.delete().catch(() => {}), 8000);
        }).catch(() => {});

        if (automodConfig.logChannelId) {
            const logChannel = message.guild.channels.cache.get(automodConfig.logChannelId);
            if (logChannel?.isTextBased?.()) {
                await logChannel.send({
                    content: [
                        `Automod event in <#${message.channel.id}>`,
                        `User: **${sanitizeText(message.author.tag, { maxLength: 80 })}** (\`${message.author.id}\`)`,
                        `Rule: **${violation.rule}**`,
                        `Action: **${automodConfig.action}**`,
                        `Message: ${sanitizeText(message.content, { fallback: "[empty]", maxLength: 200 })}`,
                    ].join("\n"),
                    allowedMentions: { parse: [] },
                }).catch(() => {});
            }
        }
    }

    async handleAutomod(message, guildConfig) {
        const automodConfig = await getGuildAutomodConfig(this.client, message.guild.id);
        if (this.shouldBypassAutomod(message, automodConfig)) return false;

        const violation = this.resolveAutomodViolation(message, automodConfig);
        if (!violation) return false;

        await this.applyAutomodAction(message, automodConfig, violation);
        return true;
    }

    async handleCommandDispatch(message, guildConfig) {
        const mentionRegexPrefix = new RegExp(`^<@!?${this.client.user.id}>`);
        let noprefixdata = await this.client.cache.get(this.client.user.id);
        if (!noprefixdata) {
            noprefixdata = await this.client.database.noprefixUserData.get(this.client.user.id);
            if (noprefixdata) {
                await this.client.cache.set(this.client.user.id, noprefixdata);
            }
        }

        const prefix = message.content.match(mentionRegexPrefix)
            ? message.content.match(mentionRegexPrefix)[0]
            : (guildConfig.prefix || this.client.config.Client.Prefix);
        const noPrefixUsers = Array.isArray(noprefixdata?.userids) ? noprefixdata.userids : [];
        const checkNoPrefix = noPrefixUsers.includes(message.author.id);

        if (!message.content.toLowerCase().startsWith(prefix.toLowerCase()) && !checkNoPrefix) {
            return;
        }

        const args = message.content.startsWith(prefix)
            ? message.content.slice(prefix.length).trim().split(/ +/)
            : message.content.trim().split(/ +/);
        const cmd = args.shift()?.toLowerCase();

        const command = this.client.commands.get(cmd) || this.client.commands.get(this.client.aliases.get(cmd));
        if (!command) return;
        if (command.ownerOnly && !this.client.util.checkOwner(message.author.id)) return;

        if (!this.client.util.checkOwner(message.author.id)) {
            if (guildConfig.disabledCommands?.includes(command.name)) {
                return message.channel.send({
                    content: "This command is disabled in this server.",
                    allowedMentions: { parse: [] },
                }).then((sent) => setTimeout(() => sent.delete().catch(() => {}), 5000));
            }

            if (guildConfig.disabledChannels?.includes(message.channel.id)) {
                return message.channel.send({
                    content: "This command is disabled in this channel.",
                    allowedMentions: { parse: [] },
                }).then((sent) => setTimeout(() => sent.delete().catch(() => {}), 5000));
            }

            if (guildConfig.blacklisted) {
                return message.channel.send({
                    content: "This guild is blacklisted from using this bot.",
                    allowedMentions: { parse: [] },
                });
            }

            const userdata = await this.client.database.welcomeUserData.get(message.author.id);
            if (userdata?.blacklist) {
                return message.channel.send({
                    content: "You are blacklisted from using this bot.",
                    allowedMentions: { parse: [] },
                });
            }

            const rateLimits = this.ratelimit(message, cmd);
            if (typeof rateLimits === "string") {
                return message.reply({
                    content: `You are being ratelimited. Please wait \`${rateLimits}\` before using this command again.`,
                    allowedMentions: { parse: [] },
                }).then((sent) => setTimeout(() => sent.delete().catch(() => {}), 4000));
            }

            const userPermCheck = command.userPerms
                ? this.client.userPerms.add(command.userPerms)
                : this.client.userPerms;
            const missingUserPerms = message.channel.permissionsFor(message.member).missing(userPermCheck);
            if (missingUserPerms.length) {
                return this.client.util.errorDelete(
                    message,
                    `You are missing the following permissions: ${this.client.util.formatArray(missingUserPerms.map(this.client.util.formatPerms))}`
                );
            }

            if (command.guildOwnerOnly && message.guild.ownerId !== message.author.id) {
                return this.client.util.errorDelete(message, "This command can only be run by the server owner.");
            }

            if (
                command.upFromMe &&
                message.member.roles.highest.position < message.guild.members.resolve(this.client.user).roles.highest.position
            ) {
                return this.client.util.errorDelete(message, "This command can only be run by someone higher than me.");
            }

            const botPermCheck = command.botPerms
                ? this.client.defaultPerms.add(command.botPerms)
                : this.client.defaultPerms;
            const missingBotPerms = message.channel.permissionsFor(this.client.user).missing(botPermCheck);
            if (missingBotPerms.length) {
                return this.client.util.errorButtonEmbed(
                    message,
                    "I do not have enough permission. Click the button below to fix it.",
                    botPermCheck.bitfield.toString()
                );
            }
        }

        const result = await command.run({ message, args });
        await this.client.dashboardTelemetry?.command(
            message,
            command.name,
            command.category
        );
        return result;
    }

    ratelimit(message, cmd) {
        const command = this.client.commands.get(cmd) || this.client.commands.get(this.client.aliases.get(cmd));
        if (!command?.cooldown) return false;

        const cooldown = command.cooldown * 1000;
        const ratelimits = this.ratelimits.get(message.author.id) || {};
        if (!ratelimits[command.name]) {
            ratelimits[command.name] = Date.now() - cooldown;
        }

        const difference = Date.now() - ratelimits[command.name];
        if (difference < cooldown) {
            return this.client.util.millisToDuration(cooldown - difference);
        }

        ratelimits[command.name] = Date.now();
        this.ratelimits.set(message.author.id, ratelimits);
        return true;
    }
};
