const Command = require("../../abstract/command");
const { ensureProfile, respond } = require("./_shared");

module.exports = class ResetProfileCommand extends Command {
    constructor(client) {
        super(client, "resetprofile", {
            name: "resetprofile",
            aliases: ["profilereset"],
            category: "Profile",
            description: "Reset your profile bio and cosmetic background to defaults.",
            usage: ["resetprofile"],
            cooldown: 5,
            slash: false,
        });
    }

    async run({ message }) {
        const profile = await ensureProfile(message.author.id);
        profile.bio = "This user has no bio yet.";
        profile.backgroundKey = null;
        profile.backgroundPath = null;
        await profile.save();

        return respond(message, "Profile Reset", [
            "Your profile bio and background were reset.",
        ]);
    }
};
