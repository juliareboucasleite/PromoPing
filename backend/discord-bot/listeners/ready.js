/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the Synpase License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const Event = require("../abstract/event");
module.exports = class ready extends Event {
    get name() {
        return "clientReady";
    }
    get once() {
        return true;
    }
    async run() {
        try {
            await this.client.music.init().catch(() => null);
            if (this.client.music.ensureReady()) {
                await this.client.music.waitForNode(8000).catch(() => null);
                const onlineNodes = this.client.music.getConnectedNodes();
                if (onlineNodes.length) {
                    this.client.logger.log(
                        `Music ready with ${onlineNodes.length} Lavalink node(s) online`,
                        "ready"
                    );
                } else {
                    const fallbackNode = this.client.config.Lavalink?.Nodes?.[0];
                    this.client.logger.warn(
                        `Music node offline. Check Lavalink at ${fallbackNode?.url || "your configured node"}.`
                    );
                }
            }
            await this.client.giveawayManager.init()
            this.client.logger.log(
                `Logged in as ${this.client.user.username}`,
                "ready"
            );
            this.client.logger.log(
                `Loaded ${this.client.commands.size} commands!`,
                "cmd"
            );
            this.client.logger.log(
                `Loaded ${this.client.events?.size ?? 0} events!`,
                "cmd"
            );
            const token = this.client.token || this.client.config.Client.Token;
            if (!token) {
                this.client.logger.warn("Skipping command registration because the Discord REST token is missing.");
                return;
            }
            this.client.rest?.setToken(token);
            const commands = this.client.commands
                .filter((c) => c.ownerOnly != true)
                .filter((cd) => cd.category != "Image")
                .filter((c) => c.category != "Fun")
                .map((command) => command.interactionData)
                .filter(Boolean);
            if (!this.client.config.Client.GuildID) {
                await this.client.application?.commands.set(commands);
                this.client.logger.debug(
                    `Updated ${commands.length} interaction command(s) [Discord Side] global`
                );
            } else {
                await this.client.guilds.cache
                    .get(this.client.config.Client.GuildID)
                    .commands.set(commands);
                this.client.logger.debug(
                    `Updated ${commands.length} interaction command(s) [Discord Side]`
                );
            }
            setInterval(() => {
                this.premiumCheckGuild();
                this.client.cache.flush();
                this.client.cacheAntiRaidData();
                this.client.cacheGuildProfiles();
                this.client.cacheAfkProfiles();
                this.client.cacheNoPrefixProfiles();
                this.client.cacheStatusProfiles();
                // this.leaveblacklistedguild();
                // this.changeStatus();
            }, 60000 * 3);
            setInterval(() => {
                this.client.notifier.checkyt();
            }, 60000 * 2);
        } catch (error) {
            console.log(error);
            return;
        }
    }

    

    async premiumCheckGuild() {
        const guilds = await this.client.guilds.fetch();
        for (const guild of guilds) {
            const guildData = await this.client.database.guildData.get(
                guild[0]
            );
            if (guildData.premium) {
                const premiumUntil = guildData.premiumUntil;
                if (premiumUntil < Date.now()) {
                    guildData.premium = false;
                    guildData.premiumUntil = null;
                    await this.client.database.guildData.set(
                        guild[0],
                        guildData
                    );
                }
            }
        }
    }
    // async leaveblacklistedguild() {
    //     const guilds = await this.client.guilds.fetch();
    //     for (let guild of guilds) {
    //         let guildData = await this.client.cache.get(guild[0]);
    //         if (!guildData) {
    //             guildData = await this.client.database.guildData.get(
    //                 guild[0]
    //             );
    //         }
    //         if (guildData.blacklisted) {
    //             guild = this.client.guilds.cache.get(guild[0])
    //             guild.leave();
    //         }
    //     }
    // }
    async changeStatus() {
      const statuses = [
        {
          name: `s?help`,
          type: 2,
        },
        {
          name: `PogyClient Your server's security`,
          type: 3,
        },
        {
          name: `s?setup`,
          type: 2,
        },
        {
          name: `s?ai`,
          type: 2,
        },
        {
          name: `s?antinuke`,
          type: 2,
        },
      ];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      this.client.user.setPresence({
        activities: [status],
      });
      setInterval(async () => {
        const today = new Date();
        const monthDay =
          `${today.getMonth() + 1}`.padStart(2, "0") +
          "-" +
          `${today.getDate()}`.padStart(2, "0");

        const birthdays = await Birthday.find(); // fetch all birthdays
        for (const b of birthdays) {
          const [year, month, day] = b.date.split("-");
          if (`${month}-${day}` === monthDay) {
            const guild = client.guilds.cache.get(b.guildId);
            if (!guild) continue;

            const settings = await BirthdaySettings.findOne({
              guildId: b.guildId,
            });
            if (!settings || !settings.enabled || !settings.channelId) continue;

            const member = await guild.members
              .fetch(b.userId)
              .catch(() => null);
            if (!member) continue;

            const channel = guild.channels.cache.get(settings.channelId);
            if (!channel) continue;

            let msg = settings.message.replace("{user}", `<@${b.userId}>`);
            channel.send({ content: msg });

            // optional role
            if (settings.roleId) {
              member.roles.add(settings.roleId).catch(() => null);
            }
          }
        }
      }, 1000 * 60 * 60);
    }       
};


