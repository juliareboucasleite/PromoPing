/*
 * Copyright (C) 2025 Vaxera
 * Licensed under the POGYCLIENT License v2.0
 * Unauthorized use, distribution, or modification is strictly prohibited.
 * Legal actions, including DMCA takedowns and financial penalties, may apply.
 */
const { model, Schema } = require("mongoose");
const config = require("../settings");

// const customRole = new Schema({
//     name: { type: String, required: true },
//     roleId: { type: String, required: true }
// })

const guildData = new Schema({
    id: { type: String, required: true },
    prefix: { type: String, default: config.Client.Prefix },
    disabledCommands: { type: Array, default: [] },
    disabledChannels: { type: Array, default: [] },
    rratings: { type: Boolean, default: false },
    premium: { type: Boolean, default: false },
    premiumUntil: { type: Date, default: null },
    blacklisted: { type: Boolean, default: false },
    welcome: {
        type: Object,
        default: {
            channel: null,
            content: " ",
            embeds: {},
        },
    },
    vcrole: { type: String, default: null },
    autorole: {
        type: Object,
        default: {
            enabled: false,
            botRoles: [],
            humanRoles: [],
        },
    },
    greet: {
        type: Object,
        default: {
            enabled: false,
            channel: [],
            content: "Welcome $user_mention to $guild_name!",
            deletetime: 5000,
        },
    },
    presenserole: {
        type: Object,
        default: {
            enabled: false,
            gtav: null,
            minecraft: null,
            valorant: null,
            vscode: null,
            spotify: null,
            netflix: null,
            roblox: null,
            fortnite: null,
            twitch: null,
            leagueoflegends: null,
        },
    },
    manager: { type: String, default: null },
    CustomRoles: {
        type: Array,
        default: [],
    },
    tickets: {
        type: Object,
        default: {
            enabled: false,
            categoryId: null,
            logChannelId: null,
            panelChannelId: null,
            supportRoleIds: [],
            counter: 0,
        },
    },
    applications: {
        type: Object,
        default: {
            enabled: false,
            panelChannelId: null,
            reviewChannelId: null,
            reviewerRoleIds: [],
            questions: [
                "Why do you want to join the staff team?",
                "What moderation experience do you have?",
                "How active can you be each week?",
                "How would you handle a difficult member?",
                "Why should we choose you?",
            ],
            counter: 0,
        },
    },
});
module.exports = model("guildData", guildData);




