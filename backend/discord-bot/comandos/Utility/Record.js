const { AttachmentBuilder } = require("discord.js");

const activeRecordings = new Map();

function parseDurationSeconds(value) {
    const raw = String(value || "2m").trim().toLowerCase();
    if (!raw) return 120;

    if (raw.endsWith("s")) {
        const seconds = Number(raw.slice(0, -1));
        return Number.isFinite(seconds) ? seconds : NaN;
    }

    if (raw.endsWith("m")) {
        const minutes = Number(raw.slice(0, -1));
        return Number.isFinite(minutes) ? minutes * 60 : NaN;
    }

    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric * 60 : NaN;
}

function getVoiceDependencies() {
    try {
        return {
            voice: require("@discordjs/voice"),
            recorderLib: require("@kirdock/discordjs-voice-recorder"),
        };
    } catch {
        return null;
    }
}

module.exports = {
    name: "record",
    aliases: ["rec"],
    description: "Grava audio do canal de voz atual por um periodo curto.",
    category: "Utility",
    usage: "!record [30s|2m|5m]",
    execute: async (client, message, args) => {
        if (!message.guild) {
            await message.reply("Este comando so funciona dentro de um servidor.").catch(() => {});
            return;
        }

        const deps = getVoiceDependencies();
        if (!deps) {
            await message.reply("As dependencias de gravacao de voz nao estao instaladas neste bot (`@discordjs/voice` e `@kirdock/discordjs-voice-recorder`).").catch(() => {});
            return;
        }

        const seconds = parseDurationSeconds(args[0]);
        if (!Number.isFinite(seconds) || seconds <= 0) {
            await message.reply("Usa uma duracao valida, por exemplo `!record 30s` ou `!record 2m`.").catch(() => {});
            return;
        }

        if (seconds > 600) {
            await message.reply("A gravacao pode ter no maximo 10 minutos.").catch(() => {});
            return;
        }

        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            await message.reply("Entra primeiro num canal de voz.").catch(() => {});
            return;
        }

        if (activeRecordings.has(message.guild.id)) {
            await message.reply("Ja existe uma gravacao em curso neste servidor.").catch(() => {});
            return;
        }

        const botMember = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
        const permissions = voiceChannel.permissionsFor(botMember);
        if (!permissions?.has("Connect") || !permissions?.has("Speak")) {
            await message.reply("Preciso das permissoes `Connect` e `Speak` nesse canal de voz.").catch(() => {});
            return;
        }

        const { joinVoiceChannel, entersState, VoiceConnectionStatus } = deps.voice;
        const { VoiceRecorder } = deps.recorderLib;

        let connection;
        const recorder = new VoiceRecorder();
        activeRecordings.set(message.guild.id, true);

        try {
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 20000);
            recorder.startRecording(connection);

            await message.reply(`Gravacao iniciada em ${voiceChannel} durante ${seconds} segundos.`).catch(() => {});
            await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

            const buffer = await recorder.getRecordedVoiceAsBuffer(message.guild.id, "single", Math.max(seconds / 60, 0.05)).catch(() => null);
            recorder.stopRecording(connection);

            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }

            if (!buffer?.length) {
                await message.channel.send("A gravacao terminou, mas nao foi capturado audio util.").catch(() => {});
                return;
            }

            await message.channel.send({
                content: `Gravacao terminada para ${message.author}.`,
                files: [new AttachmentBuilder(buffer, { name: "voice-recording.mp3" })],
                allowedMentions: { parse: [] },
            }).catch(() => {});
        } catch (error) {
            console.error("[DISCORD] Erro no comando record:", error.message);
            if (connection?.state?.status && connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
            await message.reply(`Nao consegui concluir a gravacao: ${error.message}`).catch(() => {});
        } finally {
            activeRecordings.delete(message.guild.id);
        }
    },
};
