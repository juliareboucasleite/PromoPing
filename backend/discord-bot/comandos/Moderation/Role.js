const Command = require("../../abstract/command");

module.exports = class RoleCommand extends Command {
    constructor(...args) {
        super(...args, {
            name: "role",
            aliases: ["addrole"],
            description: "Securely assign or remove roles with hierarchy and permission safeguards.",
            usage: ["role <add|remove|all|human|bot> <user> <role>"],
            category: "Moderation",
            userPerms: ["ManageGuild", "ManageRoles"],
            botPerms: ["ManageRoles", "ViewChannel", "SendMessages"],
            cooldown: 5,
            image: "https://imgur.com/UZHqOkV",
            options: [
                {
                    type: 1,
                    name: "add",
                    description: "Add a role to one member",
                    options: [
                        { type: 6, name: "user", description: "Member to update", required: true },
                        { type: 8, name: "role", description: "Role to add", required: true },
                    ],
                },
                {
                    type: 1,
                    name: "remove",
                    description: "Remove a role from one member",
                    options: [
                        { type: 6, name: "user", description: "Member to update", required: true },
                        { type: 8, name: "role", description: "Role to remove", required: true },
                    ],
                },
                {
                    type: 1,
                    name: "all",
                    description: "Add a role to all cached members missing it",
                    options: [
                        { type: 8, name: "role", description: "Role to add", required: true },
                    ],
                },
                {
                    type: 1,
                    name: "bot",
                    description: "Add a role to cached bots missing it",
                    options: [
                        { type: 8, name: "role", description: "Role to add", required: true },
                    ],
                },
                {
                    type: 1,
                    name: "human",
                    description: "Add a role to cached humans missing it",
                    options: [
                        { type: 8, name: "role", description: "Role to add", required: true },
                    ],
                },
            ],
        });
    }

    resolveRole(message, queryParts) {
        const query = queryParts.join(" ");
        return (
            message.mentions.roles.first() ||
            message.guild.roles.cache.get(queryParts[0]) ||
            message.guild.roles.cache.find(
                (role) => role.name.toLowerCase() === query.toLowerCase()
            )
        );
    }

    async run({ message, args }) {
        const action = args[0]?.toLowerCase();
        if (!action) {
            return message.reply({ content: "Use `role add`, `role remove`, `role all`, `role human`, or `role bot`." });
        }

        if (["all", "bot", "bots", "human", "humans"].includes(action)) {
            const role = this.resolveRole(message, args.slice(1));
            if (!role) {
                return message.reply({ content: "Provide a valid role." });
            }
            const scope =
                action.startsWith("bot") ? "bot" : action.startsWith("human") ? "human" : "all";
            return this.client.commandFunctions.roleFunction.assignBulk(message, role, scope);
        }

        if (!["add", "remove"].includes(action)) {
            return message.reply({ content: "That role action is not supported." });
        }

        const memberId = await this.client.util.userQuery(args[1]);
        if (!memberId) {
            return message.reply({ content: "Provide a valid user." });
        }

        const member = await message.guild.members.fetch(memberId).catch(() => null);
        if (!member) {
            return message.reply({ content: "That user is not in this server." });
        }

        const role = this.resolveRole(message, args.slice(2));
        if (!role) {
            return message.reply({ content: "Provide a valid role." });
        }

        return this.client.commandFunctions.roleFunction.toggleMemberRole(message, member, role, action);
    }

    async exec({ interaction }) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "all") {
            return this.client.commandFunctions.roleFunction.assignBulk(
                interaction,
                interaction.options.getRole("role"),
                "all"
            );
        }

        if (subcommand === "bot") {
            return this.client.commandFunctions.roleFunction.assignBulk(
                interaction,
                interaction.options.getRole("role"),
                "bot"
            );
        }

        if (subcommand === "human") {
            return this.client.commandFunctions.roleFunction.assignBulk(
                interaction,
                interaction.options.getRole("role"),
                "human"
            );
        }

        return this.client.commandFunctions.roleFunction.toggleMemberRole(
            interaction,
            interaction.options.getMember("user"),
            interaction.options.getRole("role"),
            subcommand
        );
    }
};
