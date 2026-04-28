const Command = require("../../abstract/command");
const { cleanBio, ensureProfile, respond } = require("./_shared");

module.exports = class SetBioCommand extends Command {
    constructor(client) {
        super(client, "setbio", {
            name: "setbio",
            aliases: ["bio"],
            category: "Profile",
            description: "Set your profile bio with mention-safe text cleanup.",
            usage: ["setbio <text>"],
            examples: ["setbio I love coding!", "bio Just a gamer."],
            cooldown: 5,
            slash: false,
        });
    }

    async run({ message, args }) {
        const rawBio = args.join(" ");
        if (!rawBio) {
            return respond(message, "Profile Bio", ["Write your bio text after the command."]);
        }

        const profile = await ensureProfile(message.author.id);
        profile.bio = cleanBio(rawBio);
        await profile.save();

        return respond(message, "Profile Bio", [
            "Your bio was updated successfully.",
            `Preview: ${profile.bio}`,
        ]);
    }
};
