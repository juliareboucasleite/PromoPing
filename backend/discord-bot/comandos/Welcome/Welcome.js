const Command = require("../../abstract/command");
const {
    getGuildProfile,
    normalizeWelcomeMessage,
    respond,
} = require("./_shared");

module.exports = class WelcomeCommand extends Command {
    constructor(...args) {
        super(...args, {
            name: "welcome",
            aliases: ["wel"],
            description: "Configure the main welcome channel and message.",
            usage: ["welcome <set|message|delete|test|status>"],
            category: "Welcome",
            userPerms: ["ManageGuild"],
            botPerms: ["ViewChannel", "SendMessages"],
            cooldown: 5,
            options: [
                {
                    type: 1,
                    name: "set",
                    description: "Set the welcome channel",
                    options: [{ type: 7, name: "channel", description: "Welcome channel", required: true }],
                },
                {
                    type: 1,
                    name: "message",
                    description: "Set the welcome message",
                    options: [{ type: 3, name: "text", description: "Message text", required: true }],
                },
                { type: 1, name: "delete", description: "Disable welcome messages" },
                { type: 1, name: "test", description: "Preview the welcome flow" },
                { type: 1, name: "status", description: "Show current welcome configuration" },
            ],
        });
    }

    async showStatus(target, profile) {
        return respond(target, "Welcome", [
            `Channel: ${profile.welcome.channel ? `<#${profile.welcome.channel}>` : "Not configured"}`,
            `Message: ${profile.welcome.content ? `\`${profile.welcome.content}\`` : "Not configured"}`,
        ]);
    }

    async run({ message, args }) {
        const action = (args[0] || "status").toLowerCase();
        const profile = await getGuildProfile(this.client, message.guild.id);

        if (action === "set") {
            const channel =
                message.mentions.channels.first() ||
                message.guild.channels.cache.get(args[1]);
            if (!channel) {
                return respond(message, "Welcome", ["Provide a valid channel."]);
            }
            profile.welcome.channel = channel.id;
            await this.client.database.guildData.putWelcome(message.guild.id, profile.welcome);
            return respond(message, "Welcome", [`Welcome channel set to ${channel}.`]);
        }

        if (action === "message") {
            const content = normalizeWelcomeMessage(
                args.slice(1).join(" "),
                "Welcome $user_mention to $guild_name!"
            );
            profile.welcome.content = content;
            await this.client.database.guildData.putWelcome(message.guild.id, profile.welcome);
            return respond(message, "Welcome", [`Welcome message updated to: ${content}`]);
        }

        if (action === "delete") {
            profile.welcome = { channel: null, content: null, embeds: null };
            await this.client.database.guildData.putWelcome(message.guild.id, profile.welcome);
            return respond(message, "Welcome", ["Welcome messages were disabled."]);
        }

        if (action === "test") {
            if (!profile.welcome.channel) {
                return respond(message, "Welcome", ["Set a welcome channel first."]);
            }
            this.client.emit("guildMemberAdd", message.member);
            return respond(message, "Welcome", ["Triggered a welcome preview for your account."]);
        }

        return this.showStatus(message, profile);
    }

    async exec({ interaction }) {
        const subcommand = interaction.options.getSubcommand(false) || "status";
        const profile = await getGuildProfile(this.client, interaction.guild.id);

        if (subcommand === "set") {
            profile.welcome.channel = interaction.options.getChannel("channel").id;
            await this.client.database.guildData.putWelcome(interaction.guild.id, profile.welcome);
            return respond(interaction, "Welcome", [`Welcome channel set to <#${profile.welcome.channel}>.`]);
        }

        if (subcommand === "message") {
            profile.welcome.content = normalizeWelcomeMessage(
                interaction.options.getString("text"),
                "Welcome $user_mention to $guild_name!"
            );
            await this.client.database.guildData.putWelcome(interaction.guild.id, profile.welcome);
            return respond(interaction, "Welcome", [`Welcome message updated to: ${profile.welcome.content}`]);
        }

        if (subcommand === "delete") {
            profile.welcome = { channel: null, content: null, embeds: null };
            await this.client.database.guildData.putWelcome(interaction.guild.id, profile.welcome);
            return respond(interaction, "Welcome", ["Welcome messages were disabled."]);
        }

        if (subcommand === "test") {
            if (!profile.welcome.channel) {
                return respond(interaction, "Welcome", ["Set a welcome channel first."]);
            }
            this.client.emit("guildMemberAdd", interaction.member);
            return respond(interaction, "Welcome", ["Triggered a welcome preview for your account."]);
        }

        return this.showStatus(interaction, profile);
    }
};
