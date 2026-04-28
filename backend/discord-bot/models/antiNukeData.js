/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the POGYCLIENT License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const { model, Schema } = require("mongoose");

const antiNukeData = new Schema({
    id: { type: String, required: true },
    enabled: { type: Boolean, required: true, default: false },
    punishment: { type: String, required: true, default: "ban" },
    whitelistusers: { type: Array, required: true, default: [] },
    logchannelid: { type: String, required: false, default: null },
    antivanity: { type: Boolean, required: true, default: false },
    PogyClientrole: { type: String, required: false, default: null },
    thresholds: {
        type: Object,
        default: {
            roleCreate: 3,
            roleUpdate: 3,
            roleDelete: 3,
            channelCreate: 3,
            channelUpdate: 3,
            channelDelete: 3,
            webhookCreate: 2,
            webhookUpdate: 2,
            bans: 3,
            kicks: 3,
            botAdd: 1,
        },
    },
    responses: {
        type: Object,
        default: {
            lockdown: false,
            removeRoles: true,
            alertOnly: false,
        },
    },
});

module.exports = model("antiNukeData", antiNukeData);



