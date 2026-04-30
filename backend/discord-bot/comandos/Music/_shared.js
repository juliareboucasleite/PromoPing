const { PermissionsBitField } = require("discord.js");
const { successEmbed, sanitize } = require("../_helpers");

function respond(message, title, lines) {
  return message.reply({
    embeds: [successEmbed(title, lines)],
    allowedMentions: { parse: [] },
  });
}

function getMember(message) {
  return message?.member || null;
}

function ensureVoice(member) {
  if (!member?.voice?.channel) {
    return "Entra primeiro num canal de voz.";
  }
  return null;
}

function ensureJoinable(message, member) {
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) {
    return "Entra primeiro num canal de voz.";
  }

  const me = message.guild?.members?.me || message.guild?.members?.cache?.get(message.client.user.id);
  const permissions = voiceChannel.permissionsFor(me);

  if (!permissions) {
    return "Nao consegui verificar as minhas permissoes nesse canal.";
  }

  if (!permissions.has(PermissionsBitField.Flags.Connect)) {
    return "Nao tenho permissao para entrar nesse canal de voz.";
  }

  if (!permissions.has(PermissionsBitField.Flags.Speak)) {
    return "Consigo entrar, mas nao tenho permissao para falar nesse canal.";
  }

  if (voiceChannel.full && !voiceChannel.members.has(me.id)) {
    return "Esse canal de voz esta cheio.";
  }

  return null;
}

function ensureSameVoice(queue, member, manager) {
  if (!queue) return null;
  if (!member?.voice?.channelId) {
    return "Entra no meu canal de voz primeiro.";
  }

  const botChannelId = manager.getVoiceChannelId(queue);
  if (botChannelId && botChannelId !== member.voice.channelId) {
    return "Precisas de estar no mesmo canal de voz que eu.";
  }

  return null;
}

function parseNumber(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function queueTracks(queue) {
  return queue?.tracks?.toArray?.() || [];
}

function formatTrack(track, manager, index = null) {
  const prefix = index === null ? "" : `\`${index}.\` `;
  return `${prefix}**${sanitize(track?.title || "Faixa desconhecida", 80)}**\n${sanitize(track?.author || "Artista desconhecido", 60)}  •  \`${manager.formatDuration(track?.durationMS || track?.duration || 0)}\``;
}

module.exports = {
  chunkLyrics,
  ensureJoinable,
  ensureSameVoice,
  ensureVoice,
  formatTrack,
  getMember,
  parseNumber,
  parseSeek,
  queueTracks,
  respond,
};
