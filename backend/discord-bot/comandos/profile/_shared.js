const path = require("path");
const Profile = require("../../models/Profile");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const { sanitizeText } = require("../../../toolkit/helpers/moderation-security");

const TEMPLATE_MAP = {
    mountain: "mountain.png",
    city: "city.png",
    forest: "forest.png",
    galaxy: "galaxy.png",
    aurora: "aurora.png",
};

function imageRoot() {
    return path.join(process.cwd(), "source", "interactions", "commands", "profile", "images");
}

function templatePath(key) {
    const file = TEMPLATE_MAP[key];
    if (!file) return null;
    return path.join(imageRoot(), file);
}

async function ensureProfile(userId) {
    let profile = await Profile.findOne({ userId });
    if (!profile) {
        profile = await Profile.create({
            userId,
            bio: "This user has no bio yet.",
            badges: [],
            backgroundKey: null,
            backgroundPath: null,
        });
    }
    return profile;
}

function respond(target, title, lines, ephemeral = true) {
    return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
}

function cleanBio(text) {
    return sanitizeText(text, {
        fallback: "This user has no bio yet.",
        maxLength: 200,
    });
}

module.exports = {
    TEMPLATE_MAP,
    cleanBio,
    ensureProfile,
    imageRoot,
    respond,
    templatePath,
};
