const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const { sanitizeText } = require("../../../toolkit/helpers/moderation-security");
const { PermissionsBitField } = require("discord.js");

function respond(target, title, lines, extra = {}) {
  return reply(target, buildNoticePanel({
    title,
    lines,
    footer: extra.footer || null,
  }), {
    ephemeral: extra.ephemeral ?? true,
  });
}

function getActor(target) {
  return target?.user || target?.author || null;
}

function getGuildMember(target) {
  return target?.member || null;
}

function ensureVoice(member) {
  if (!member?.voice?.channelId) {
    return "Join a voice channel first.";
  }
  return null;
}

function ensureJoinable(target, member) {
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) {
    return "Join a voice channel first.";
  }

  const me = target.guild?.members?.me || target.guild?.members?.cache?.get(target.client.user.id);
  const permissions = voiceChannel.permissionsFor(me);
  if (!permissions) {
    return "I couldn't verify my voice permissions in that channel.";
  }

  if (!permissions.has(PermissionsBitField.Flags.Connect)) {
    return "I can't connect to your voice channel.";
  }

  if (!permissions.has(PermissionsBitField.Flags.Speak)) {
    return "I can join that voice channel, but I can't speak there.";
  }

  if (voiceChannel.full && !voiceChannel.members.has(me.id)) {
    return "That voice channel is full.";
  }

  return null;
}

function ensureSameVoice(player, member) {
  if (!player) return null;
  if (!member?.voice?.channelId) return "Join my voice channel first.";
  if (player.voiceId && player.voiceId !== member.voice.channelId) {
    return "You need to be in the same voice channel as the player.";
  }
  return null;
}

function parseNumber(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseSeek(value) {
  if (!value) return null;
  const match = String(value).trim().toLowerCase().match(/^(\d+)(s|m|h)?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2] || "s";
  const factor = unit === "h" ? 3600000 : unit === "m" ? 60000 : 1000;
  return amount * factor;
}

function musicEmoji(client) {
  return (
    client.config.Client.emoji.guide ||
    client.config.Client.emoji.fun ||
    client.config.Client.emoji.utility
  );
}

function queueCount(player) {
  return player?.queue?.size ?? player?.queue?.length ?? 0;
}

function chunkLyrics(text, limit = 3500) {
  const chunks = [];
  let current = "";
  for (const line of String(text || "").split("\n")) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > limit) {
      if (current) {
        chunks.push(current);
        current = line;
      } else {
        chunks.push(line.slice(0, limit));
        current = "";
      }
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function formatTrackLine(manager, track, index = null) {
  const prefix = index === null ? "" : `\`${index}.\` `;
  return `${prefix}**${sanitizeText(track.title, { maxLength: 80 })}**\n${sanitizeText(track.author || "Unknown Artist", { maxLength: 60 })}  ${manager.client.config.Client.emoji.dot}  \`${manager.formatDuration(track.length)}\``;
}

module.exports = {
  chunkLyrics,
  ensureJoinable,
  ensureSameVoice,
  ensureVoice,
  formatTrackLine,
  getActor,
  getGuildMember,
  musicEmoji,
  parseNumber,
  parseSeek,
  queueCount,
  respond,
};
