const Command = require("../../abstract/command");
const Birthday = require("../../models/birthday");
const BirthdaySettings = require("../../models/birthdaySettings");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const { sanitizeText } = require("../../../toolkit/helpers/moderation-security");

function respond(target, title, lines, ephemeral = true) {
    return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
}

function isValidDateString(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

module.exports = class BirthdayCommand extends Command {
    constructor(...args) {
        super(...args, {
            name: "birthday",
            aliases: ["bday"],
            description: "Manage user birthdays and server birthday delivery settings.",
            usage: [
                "birthday set <YYYY-MM-DD>",
                "birthday check [@user]",
                "birthday remove",
                "birthday channel <#channel>",
                "birthday role <@role>",
                "birthday message <custom message>",
                "birthday toggle <on|off>",
            ],
            category: "Utilities",
            userPerms: ["SendMessages"],
            botPerms: ["ViewChannel", "SendMessages"],
            slash: false,
        });
    }

    async getSettings(guildId) {
        let settings = await BirthdaySettings.findOne({ guildId });
        if (!settings) {
            settings = await BirthdaySettings.create({ guildId });
        }
        return settings;
    }

    async run({ message, args }) {
        const sub = (args[0] || "status").toLowerCase();
        const guildId = message.guild.id;
        const userId = message.author.id;

        if (sub === "set") {
            const date = args[1];
            if (!isValidDateString(date)) {
                return respond(message, "Birthday", ["Use the format `YYYY-MM-DD`, for example `2001-09-17`."]);
            }

            await Birthday.findOneAndUpdate({ userId, guildId }, { date }, { upsert: true });
            return respond(message, "Birthday", [`Your birthday has been set to **${date}**.`]);
        }

        if (sub === "check") {
            const target = message.mentions.users.first() || message.author;
            const data = await Birthday.findOne({ userId: target.id, guildId });
            if (!data) return respond(message, "Birthday", ["That user has not set a birthday yet."]);
            return respond(message, "Birthday", [`**${target.username}** has their birthday set to **${data.date}**.`]);
        }

        if (sub === "remove") {
            await Birthday.deleteOne({ userId, guildId });
            return respond(message, "Birthday", ["Your saved birthday was removed."]);
        }

        if (["channel", "role", "message", "toggle", "status"].includes(sub)) {
            if (!message.member.permissions.has("Administrator")) {
                return respond(message, "Birthday", ["Only administrators can manage server birthday settings."]);
            }
        }

        if (sub === "channel") {
            const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
            if (!channel) return respond(message, "Birthday", ["Mention a valid channel."]);
            const settings = await this.getSettings(guildId);
            settings.channelId = channel.id;
            await settings.save();
            return respond(message, "Birthday", [`Birthday announcements will be sent in ${channel}.`]);
        }

        if (sub === "role") {
            const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
            if (!role) return respond(message, "Birthday", ["Mention a valid role."]);
            const settings = await this.getSettings(guildId);
            settings.roleId = role.id;
            await settings.save();
            return respond(message, "Birthday", [`Birthday role set to **${role.name}**.`]);
        }

        if (sub === "message") {
            const customMessage = sanitizeText(args.slice(1).join(" "), {
                fallback: "Happy Birthday, {user}!",
                maxLength: 220,
            });
            const settings = await this.getSettings(guildId);
            settings.message = customMessage;
            await settings.save();
            return respond(message, "Birthday", [`Birthday message updated to: ${customMessage}`]);
        }

        if (sub === "toggle") {
            const state = (args[1] || "").toLowerCase();
            if (!["on", "off", "enable", "disable"].includes(state)) {
                return respond(message, "Birthday", ["Use `birthday toggle on` or `birthday toggle off`."]);
            }
            const settings = await this.getSettings(guildId);
            settings.enabled = ["on", "enable"].includes(state);
            await settings.save();
            return respond(message, "Birthday", [`Birthday announcements are now **${settings.enabled ? "enabled" : "disabled"}**.`]);
        }

        const settings = await this.getSettings(guildId);
        return respond(message, "Birthday", [
            `Enabled: **${settings.enabled ? "Yes" : "No"}**`,
            `Channel: ${settings.channelId ? `<#${settings.channelId}>` : "Not configured"}`,
            `Role: ${settings.roleId ? `<@&${settings.roleId}>` : "Not configured"}`,
            `Message: ${settings.message || "Not configured"}`,
        ]);
    }
};
