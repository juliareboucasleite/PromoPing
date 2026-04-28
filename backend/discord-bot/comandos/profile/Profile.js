const Command = require("../../abstract/command");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");

module.exports = class ProfileSummary extends Command {
    constructor(...args) {
        super(...args, {
            name: "profile",
            aliases: ["pf", "pr"],
            description: "Show a clean text summary of a user's bot profile and relationship state.",
            usage: ["profile [user]"],
            category: "Utilities",
            userPerms: ["ViewChannel", "SendMessages"],
            botPerms: ["ViewChannel", "SendMessages"],
            cooldown: 5,
            guildOnly: true,
        });
    }

    async respond(target, title, lines, ephemeral = false) {
        return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
    }

    async getBadges(userId) {
        const badges = [];
        const fetched = await this.client.util
            .fetchDetails(`https://badge.pogyclientbot.xyz/getbadges?userid=${userId}`)
            .catch(() => null);
        if (!fetched) return badges;

        const map = [
            ["isDeveloper", "Developer"],
            ["isCommunityManager", "Community Manager"],
            ["isOwner", "Owner"],
            ["isAdmin", "Admin"],
            ["isManager", "Manager"],
            ["isModerator", "Moderator"],
            ["isStaff", "Staff"],
            ["isSupporter", "Supporter"],
            ["isBugHunters", "Bug Hunters"],
            ["isSpecialOnes", "Special Ones"],
        ];

        for (const [key, label] of map) {
            if (fetched[key]) badges.push(label);
        }

        return badges;
    }

    async perform(target, userId) {
        const user = await this.client.users.fetch(userId).catch(() => null);
        if (!user) return this.respond(target, "Profile", ["User not found."], true);

        const marriage = await this.client.database.marryData.get(user.id);
        const badges = await this.getBadges(user.id);
        const lines = [
            `User: **${user.tag}**`,
            `Badges: ${badges.length ? badges.join(", ") : "None"}`,
        ];

        if (marriage?.married && marriage.partner) {
            const partner = await this.client.users.fetch(marriage.partner).catch(() => null);
            const days = marriage.marriedAt ? Math.floor((Date.now() - marriage.marriedAt) / 86400000) : 0;
            lines.push(`Partner: **${partner?.tag || marriage.partner}**`);
            lines.push(`Married: <t:${Math.floor(marriage.marriedAt / 1000)}:f>`);
            lines.push(`Days together: **${days}**`);
        }

        return this.respond(target, "Profile", lines);
    }

    async run({ message, args }) {
        const userId = args[0] ? await this.client.util.userQuery(args[0]) : message.author.id;
        if (!userId) return message.reply({ content: "User not found.", allowedMentions: { parse: [] } });
        return this.perform(message, userId);
    }

    async exec({ interaction }) {
        const user = interaction.options.getUser("user") || interaction.user;
        return this.perform(interaction, user.id);
    }
};
