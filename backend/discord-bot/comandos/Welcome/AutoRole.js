const Command = require("../../abstract/command");
const {
    getGuildProfile,
    respond,
    validateAutoRole,
} = require("./_shared");

module.exports = class AutoRoleCommand extends Command {
    constructor(...args) {
        super(...args, {
            name: "autorole",
            aliases: ["roleauto", "autoroles"],
            description: "Configure guarded autoroles for human members and bots.",
            usage: ["autorole <add|remove|show|clear>"],
            category: "Welcome",
            userPerms: ["ManageGuild"],
            botPerms: ["ViewChannel", "SendMessages", "ManageRoles"],
            cooldown: 5,
            options: [
                {
                    type: 1,
                    name: "add",
                    description: "Add a role to autorole",
                    options: [
                        { type: 8, name: "role", description: "Role to add", required: true },
                        {
                            type: 3,
                            name: "type",
                            description: "Audience",
                            choices: [
                                { name: "Humans", value: "human" },
                                { name: "Bots", value: "bot" },
                            ],
                            required: true,
                        },
                    ],
                },
                {
                    type: 1,
                    name: "remove",
                    description: "Remove a role from autorole",
                    options: [{ type: 8, name: "role", description: "Role to remove", required: true }],
                },
                { type: 1, name: "show", description: "Show configured autoroles" },
                { type: 1, name: "clear", description: "Clear all autoroles" },
            ],
        });
    }

    async addRole(target, type, role) {
        const gate = validateAutoRole(this.client, target, role);
        if (!gate.ok) return respond(target, "Autorole", [gate.error]);

        const profile = await getGuildProfile(this.client, target.guild.id);
        const bucket = type === "bot" ? profile.autorole.botRoles : profile.autorole.humanRoles;
        if (bucket.includes(role.id)) {
            return respond(target, "Autorole", ["That role is already configured for this autorole bucket."]);
        }
        if (bucket.length >= 3) {
            return respond(target, "Autorole", ["Each autorole bucket is capped at 3 roles."]);
        }

        bucket.push(role.id);
        profile.autorole.enabled = profile.autorole.botRoles.length > 0 || profile.autorole.humanRoles.length > 0;
        await this.client.database.guildData.putAutorole(target.guild.id, profile.autorole);
        return respond(target, "Autorole", [`Added **${role.name}** to **${type}** autoroles.`]);
    }

    async removeRole(target, role) {
        const profile = await getGuildProfile(this.client, target.guild.id);
        const hadRole =
            profile.autorole.botRoles.includes(role.id) ||
            profile.autorole.humanRoles.includes(role.id);
        if (!hadRole) {
            return respond(target, "Autorole", ["That role is not configured for autorole."]);
        }

        profile.autorole.botRoles = profile.autorole.botRoles.filter((id) => id !== role.id);
        profile.autorole.humanRoles = profile.autorole.humanRoles.filter((id) => id !== role.id);
        profile.autorole.enabled = profile.autorole.botRoles.length > 0 || profile.autorole.humanRoles.length > 0;
        await this.client.database.guildData.putAutorole(target.guild.id, profile.autorole);
        return respond(target, "Autorole", [`Removed **${role.name}** from autorole.`]);
    }

    async show(target) {
        const profile = await getGuildProfile(this.client, target.guild.id);
        const human = profile.autorole.humanRoles.length
            ? profile.autorole.humanRoles.map((id) => `<@&${id}>`).join(", ")
            : "None";
        const bot = profile.autorole.botRoles.length
            ? profile.autorole.botRoles.map((id) => `<@&${id}>`).join(", ")
            : "None";
        return respond(target, "Autorole", [
            `Enabled: **${profile.autorole.enabled ? "Yes" : "No"}**`,
            `Human roles: ${human}`,
            `Bot roles: ${bot}`,
        ]);
    }

    async clear(target) {
        const profile = await getGuildProfile(this.client, target.guild.id);
        profile.autorole.botRoles = [];
        profile.autorole.humanRoles = [];
        profile.autorole.enabled = false;
        await this.client.database.guildData.putAutorole(target.guild.id, profile.autorole);
        return respond(target, "Autorole", ["Cleared all autorole assignments."]);
    }

    async run({ message, args }) {
        const action = (args[0] || "show").toLowerCase();
        if (action === "clear") return this.clear(message);
        if (action === "show" || action === "list") return this.show(message);

        if (action === "remove" || action === "delete") {
            const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
            if (!role) return respond(message, "Autorole", ["Provide a valid role."]);
            return this.removeRole(message, role);
        }

        if (action === "add" || action === "set") {
            const type = args[1]?.toLowerCase();
            const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);
            if (!["human", "bot"].includes(type)) return respond(message, "Autorole", ["Choose `human` or `bot` when adding autoroles."]);
            if (!role) return respond(message, "Autorole", ["Provide a valid role."]);
            return this.addRole(message, type, role);
        }

        return respond(message, "Autorole", ["Use `autorole add`, `autorole remove`, `autorole show`, or `autorole clear`."]);
    }

    async exec({ interaction }) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "clear") return this.clear(interaction);
        if (subcommand === "show") return this.show(interaction);
        if (subcommand === "remove") return this.removeRole(interaction, interaction.options.getRole("role"));
        if (subcommand === "add") {
            return this.addRole(
                interaction,
                interaction.options.getString("type"),
                interaction.options.getRole("role")
            );
        }
    }
};
