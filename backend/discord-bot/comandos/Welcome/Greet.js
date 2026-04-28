const Command = require("../../abstract/command");
const {
    getGuildProfile,
    normalizeWelcomeMessage,
    respond,
} = require("./_shared");

module.exports = class GreetCommand extends Command {
    constructor(...args) {
        super(...args, {
            name: "greet",
            aliases: ["greetping"],
            description: "Configure lightweight join pings with auto-delete behavior.",
            usage: ["greet <add|remove|message|disable|test|list> [channel]"],
            category: "Welcome",
            userPerms: ["ManageGuild"],
            botPerms: ["ViewChannel", "SendMessages"],
            cooldown: 5,
            slash: false,
        });
    }

    async run({ message, args }) {
        const action = (args[0] || "list").toLowerCase();
        const profile = await getGuildProfile(this.client, message.guild.id);

        if (action === "test") {
            if (!profile.greet.enabled) return respond(message, "Greet", ["Greet is not enabled."]);
            this.client.emit("guildMemberAdd", message.member);
            return respond(message, "Greet", ["Triggered a greet preview for your account."]);
        }

        if (action === "disable") {
            profile.greet.enabled = false;
            profile.greet.channel = [];
            await this.client.database.guildData.putGreet(message.guild.id, profile.greet);
            return respond(message, "Greet", ["Greet was disabled and its channels were cleared."]);
        }

        if (action === "message") {
            profile.greet.content = normalizeWelcomeMessage(
                args.slice(1).join(" "),
                "Welcome $user_mention to $guild_name!"
            );
            await this.client.database.guildData.putGreet(message.guild.id, profile.greet);
            return respond(message, "Greet", [`Greet message updated to: ${profile.greet.content}`]);
        }

        if (action === "remove") {
            const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
            if (!channel) return respond(message, "Greet", ["Provide a valid channel to remove."]);
            profile.greet.channel = profile.greet.channel.filter((id) => id !== channel.id);
            profile.greet.enabled = profile.greet.channel.length > 0;
            await this.client.database.guildData.putGreet(message.guild.id, profile.greet);
            return respond(message, "Greet", [`Removed ${channel} from greet delivery.`]);
        }

        if (action === "add") {
            const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]) || message.channel;
            if (profile.greet.channel.includes(channel.id)) {
                return respond(message, "Greet", [`${channel} is already in the greet list.`]);
            }
            if (profile.greet.channel.length >= 3) {
                return respond(message, "Greet", ["You can only configure greet for up to 3 channels."]);
            }
            profile.greet.channel.push(channel.id);
            profile.greet.enabled = true;
            await this.client.database.guildData.putGreet(message.guild.id, profile.greet);
            return respond(message, "Greet", [`Added ${channel} to greet delivery.`]);
        }

        const channels = profile.greet.channel.length
            ? profile.greet.channel.map((id) => `<#${id}>`).join(", ")
            : "None";
        return respond(message, "Greet", [
            `Enabled: **${profile.greet.enabled ? "Yes" : "No"}**`,
            `Channels: ${channels}`,
            `Message: ${profile.greet.content || "Not configured"}`,
        ]);
    }
};
