const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { Player, QueryType, QueueRepeatMode } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");
const { YoutubeSabrExtractor } = require("discord-player-googlevideo");

class MusicManager {
  constructor(client) {
    this.client = client;
    this.player = null;
    this.initialized = false;
    this.initPromise = null;
    this.boundEvents = false;
    this.controlPanels = new Map();
  }

  get enabled() {
    return true;
  }

  async init() {
    if (this.initialized && this.player) {
      return this.player;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.player = new Player(this.client);
      this.bindEvents();
      await this.player.extractors.loadMulti(DefaultExtractors);
      await this.player.extractors.register(YoutubeSabrExtractor, {});
      this.initialized = true;
      return this.player;
    })().catch((error) => {
      this.initPromise = null;
      this.player = null;
      this.initialized = false;
      throw error;
    });

    return this.initPromise;
  }

  bindEvents() {
    if (this.boundEvents || !this.player) {
      return;
    }

    this.boundEvents = true;

    this.player.events.on("playerStart", async (queue, track) => {
      const channel = await this.getTextChannel(queue);
      if (channel) {
        await channel.send({
          embeds: [{
            title: "A tocar agora",
            color: 0xffa500,
            description: [
              `**${track.title}**`,
              `${track.author || "Artista desconhecido"}`,
              track.url ? `[Abrir musica](${track.url})` : null,
              `Duracao: \`${this.formatDuration(track.durationMS || track.duration || 0)}\``,
            ].filter(Boolean).join("\n"),
          }],
          allowedMentions: { parse: [] },
        }).catch(() => {});
      }

      await this.refreshControlPanel(queue.guild.id).catch(() => {});
    });

    this.player.events.on("emptyQueue", async (queue) => {
      const channel = await this.getTextChannel(queue);
      if (channel) {
        await channel.send({
          embeds: [{
            title: "Fila terminada",
            color: 0xffa500,
            description: "A fila terminou e o bot saiu do canal de voz.",
          }],
          allowedMentions: { parse: [] },
        }).catch(() => {});
      }

      await this.deactivateControlPanel(queue.guild.id, "Painel encerrado: a fila terminou.").catch(() => {});
    });

    this.player.events.on("playerError", async (queue, error, track) => {
      const channel = await this.getTextChannel(queue);
      if (!channel) return;
      const targetTrack = track || queue?.currentTrack || null;

      await channel.send({
        embeds: [{
          title: "Erro de musica",
          color: 0xffa500,
          description: [
            targetTrack ? `Faixa: **${targetTrack.title}**` : null,
            `Erro: ${String(error?.message || error || "desconhecido").slice(0, 300)}`,
          ].filter(Boolean).join("\n"),
        }],
        allowedMentions: { parse: [] },
      }).catch(() => {});
    });
  }

  ensureReady() {
    return Boolean(this.player);
  }

  getConnectedNodes() {
    return this.player ? [{ name: "discord-player", state: 1 }] : [];
  }

  hasConnectedNode() {
    return Boolean(this.player);
  }

  async waitForNode() {
    return true;
  }

  getPlayer(guildId) {
    if (!this.player) return null;
    return this.player.nodes.get(guildId) || null;
  }

  getVoiceChannelId(queue) {
    return queue?.channel?.id
      || queue?.connection?.joinConfig?.channelId
      || null;
  }

  async createPlayer({ guild, member, textId }) {
    await this.init();

    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
      throw new Error("Entra primeiro num canal de voz.");
    }

    let queue = this.getPlayer(guild.id);
    const metadata = { textChannelId: textId, guildId: guild.id };

    if (!queue) {
      queue = this.player.nodes.create(guild, {
        metadata,
        selfDeaf: true,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 60_000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 15_000,
        leaveOnStop: true,
        leaveOnStopCooldown: 5_000,
        volume: 80,
      });
    } else {
      queue.setMetadata(metadata);
    }

    if (!queue.connection || this.getVoiceChannelId(queue) !== voiceChannel.id) {
      await queue.connect(voiceChannel);
    }

    return queue;
  }

  async search(query, requester) {
    await this.init();
    return this.player.search(query, {
      requestedBy: requester || null,
      searchEngine: QueryType.AUTO,
    });
  }

  isSpotifyTrack(track) {
    return String(track?.source || "").toLowerCase() === "spotify";
  }

  buildYoutubeBridgeQuery(track) {
    const title = String(track?.title || "").trim();
    const author = String(track?.author || "").trim();
    return `youtube:${author} - ${title} official audio`;
  }

  async searchYoutubeBridge(track, requester) {
    const query = this.buildYoutubeBridgeQuery(track);
    const result = await this.player.search(query, {
      requestedBy: requester || track?.requestedBy || null,
      searchEngine: QueryType.AUTO,
    });
    return result?.tracks?.[0] || null;
  }

  async resolvePlayableResult(result, requester) {
    if (!result?.tracks?.length) {
      return { playlist: result?.playlist || null, tracks: [], bridged: false };
    }

    const hasSpotify = result.tracks.some((track) => this.isSpotifyTrack(track));
    if (!hasSpotify) {
      return { playlist: result.playlist || null, tracks: result.tracks, bridged: false };
    }

    const resolvedTracks = [];
    for (const track of result.tracks) {
      if (!this.isSpotifyTrack(track)) {
        resolvedTracks.push(track);
        continue;
      }

      const bridgedTrack = await this.searchYoutubeBridge(track, requester);
      if (bridgedTrack) {
        resolvedTracks.push(bridgedTrack);
      }
    }

    return {
      playlist: result.playlist || null,
      tracks: resolvedTracks,
      bridged: true,
    };
  }

  queueTracks(queue) {
    return queue?.tracks?.toArray?.() || [];
  }

  formatDuration(ms) {
    const amount = Number(ms || 0);
    if (!Number.isFinite(amount) || amount <= 0) return "Ao vivo";
    const totalSeconds = Math.floor(amount / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  formatRepeatMode(mode) {
    switch (mode) {
      case QueueRepeatMode.TRACK:
        return "track";
      case QueueRepeatMode.QUEUE:
        return "queue";
      case QueueRepeatMode.AUTOPLAY:
        return "autoplay";
      default:
        return "none";
    }
  }

  parseRepeatMode(mode) {
    switch (String(mode || "").toLowerCase()) {
      case "track":
      case "song":
      case "musica":
        return QueueRepeatMode.TRACK;
      case "queue":
      case "fila":
        return QueueRepeatMode.QUEUE;
      case "autoplay":
      case "auto":
        return QueueRepeatMode.AUTOPLAY;
      default:
        return QueueRepeatMode.OFF;
    }
  }

  nextRepeatMode(mode) {
    switch (mode) {
      case QueueRepeatMode.TRACK:
        return QueueRepeatMode.QUEUE;
      case QueueRepeatMode.QUEUE:
        return QueueRepeatMode.OFF;
      default:
        return QueueRepeatMode.TRACK;
    }
  }

  buildNowPlayingLines(queue) {
    const track = queue?.currentTrack;
    if (!track) {
      return ["Nada a tocar agora."];
    }

    const current = Number(queue.node.streamTime || 0);
    const total = Number(track.durationMS || track.duration || 0);

    return [
      `**${track.title}**`,
      `${track.author || "Artista desconhecido"}`,
      track.url ? `[Abrir musica](${track.url})` : null,
      `Progresso: \`${this.formatDuration(current)} / ${this.formatDuration(total)}\``,
      `Volume: **${Math.round(queue.node.volume)}%**`,
      `Loop: **${this.formatRepeatMode(queue.repeatMode)}**`,
      `Fila: **${this.queueTracks(queue).length}**`,
      queue.node.isPaused() ? "Estado: **Pausado**" : "Estado: **A tocar**",
    ].filter(Boolean);
  }

  queuePages(queue, pageSize = 10) {
    const tracks = this.queueTracks(queue);
    if (!tracks.length) {
      return ["Sem musicas na fila."];
    }

    const lines = tracks.map((track, index) => {
      return `\`${index + 1}.\` **${track.title}**\n${track.author || "Artista desconhecido"}  •  \`${this.formatDuration(track.durationMS || track.duration || 0)}\``;
    });

    const pages = [];
    for (let i = 0; i < lines.length; i += pageSize) {
      pages.push(lines.slice(i, i + pageSize).join("\n\n"));
    }
    return pages;
  }

  async fetchLyrics(track) {
    const author = encodeURIComponent(
      String(track?.author || "")
        .split(",")[0]
        .replace(/\s*-\s*topic$/i, "")
        .trim()
    );
    const title = encodeURIComponent(
      String(track?.title || "")
        .split("(")[0]
        .trim()
    );

    if (!author || !title) {
      return null;
    }

    const response = await fetch(`https://api.lyrics.ovh/v1/${author}/${title}`).catch(() => null);
    if (!response?.ok) {
      return null;
    }

    const body = await response.json().catch(() => null);
    return body?.lyrics || null;
  }

  getControlPanel(guildId) {
    return this.controlPanels.get(guildId) || null;
  }

  buildControlComponents(queue, guildId, disabled = false) {
    const paused = Boolean(queue?.node?.isPaused?.());
    const loop = this.formatRepeatMode(queue?.repeatMode);

    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`musicctl_toggle_${guildId}`)
          .setLabel(paused ? "Retomar" : "Pausar")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId(`musicctl_skip_${guildId}`)
          .setLabel("Passar")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId(`musicctl_loop_${guildId}`)
          .setLabel(`Loop:${loop}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId(`musicctl_queue_${guildId}`)
          .setLabel("Fila")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId(`musicctl_stop_${guildId}`)
          .setLabel("Parar")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(disabled)
      ),
    ];
  }

  buildControlEmbed(queue, panel, closedReason = null) {
    const embed = new EmbedBuilder()
      .setTitle(closedReason ? "Painel de musica encerrado" : "Painel de musica")
      .setColor(0xffa500)
      .setTimestamp();

    const lines = [];

    if (panel?.notice?.title) {
      lines.push(`**${panel.notice.title}**`);
    }
    if (Array.isArray(panel?.notice?.lines) && panel.notice.lines.length) {
      lines.push(...panel.notice.lines);
    }
    if (lines.length) {
      lines.push("");
    }

    if (closedReason) {
      lines.push(closedReason);
    } else {
      lines.push(`Controlado por: <@${panel.ownerId}>`);
      lines.push(panel.voiceChannelId ? `Canal de voz: <#${panel.voiceChannelId}>` : "Canal de voz: desconhecido");
      lines.push("");
      lines.push(...this.buildNowPlayingLines(queue));
      lines.push("");
      lines.push("Os botoes so funcionam para quem abriu esta sessao, enquanto essa pessoa e o bot continuarem no canal.");
    }

    embed.setDescription(lines.join("\n"));
    return embed;
  }

  async presentControlPanel(message, queue, ownerId, notice) {
    const guildId = message.guild.id;
    const voiceChannelId = message.member?.voice?.channelId || this.getVoiceChannelId(queue);
    const current = this.getControlPanel(guildId) || {};
    const panel = {
      ...current,
      guildId,
      ownerId,
      textChannelId: message.channel.id,
      voiceChannelId,
      active: true,
      notice: notice || null,
    };

    const payload = {
      embeds: [this.buildControlEmbed(queue, panel)],
      components: this.buildControlComponents(queue, guildId, false),
      allowedMentions: { parse: [] },
    };

    let sentMessage = null;
    if (panel.messageId) {
      const channel = this.client.channels.cache.get(panel.textChannelId)
        || await this.client.channels.fetch(panel.textChannelId).catch(() => null);
      const existingMessage = channel?.messages
        ? await channel.messages.fetch(panel.messageId).catch(() => null)
        : null;

      if (existingMessage) {
        sentMessage = await existingMessage.edit(payload).catch(() => null);
      }
    }

    if (!sentMessage) {
      sentMessage = await message.reply(payload);
    }

    panel.messageId = sentMessage.id;
    panel.textChannelId = sentMessage.channel.id;
    this.controlPanels.set(guildId, panel);
    return sentMessage;
  }

  async refreshControlPanel(guildId, notice = null) {
    const panel = this.getControlPanel(guildId);
    if (!panel?.messageId) {
      return false;
    }

    const queue = this.getPlayer(guildId);
    if (!queue) {
      return this.deactivateControlPanel(guildId, "Painel encerrado: o player deixou de estar ativo.");
    }

    if (notice) {
      panel.notice = notice;
    }

    const channel = this.client.channels.cache.get(panel.textChannelId)
      || await this.client.channels.fetch(panel.textChannelId).catch(() => null);
    const message = channel?.messages
      ? await channel.messages.fetch(panel.messageId).catch(() => null)
      : null;

    if (!message) {
      this.controlPanels.delete(guildId);
      return false;
    }

    await message.edit({
      embeds: [this.buildControlEmbed(queue, panel)],
      components: this.buildControlComponents(queue, guildId, false),
      allowedMentions: { parse: [] },
    }).catch(() => {});

    return true;
  }

  async deactivateControlPanel(guildId, reason = "Painel expirado.") {
    const panel = this.getControlPanel(guildId);
    if (!panel?.messageId) {
      this.controlPanels.delete(guildId);
      return false;
    }

    const channel = this.client.channels.cache.get(panel.textChannelId)
      || await this.client.channels.fetch(panel.textChannelId).catch(() => null);
    const message = channel?.messages
      ? await channel.messages.fetch(panel.messageId).catch(() => null)
      : null;
    const queue = this.getPlayer(guildId);

    if (message) {
      await message.edit({
        embeds: [this.buildControlEmbed(queue, panel, reason)],
        components: this.buildControlComponents(queue, guildId, true),
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }

    this.controlPanels.delete(guildId);
    return true;
  }

  async destroy(guildId, reason = "Painel encerrado.") {
    const queue = this.getPlayer(guildId);
    await this.deactivateControlPanel(guildId, reason).catch(() => {});
    if (!queue) return false;
    queue.delete();
    return true;
  }

  async ensurePanelAccess(interaction, panel) {
    if (!panel || interaction.message.id !== panel.messageId) {
      await interaction.reply({
        content: "Esse painel ja expirou.",
        ephemeral: true,
      }).catch(() => {});
      return null;
    }

    if (interaction.user.id !== panel.ownerId) {
      await interaction.reply({
        content: "So a pessoa que abriu esta sessao pode usar estes botoes.",
        ephemeral: true,
      }).catch(() => {});
      return null;
    }

    const guild = interaction.guild;
    const member = interaction.member;
    const botChannelId = guild?.members?.me?.voice?.channelId || null;
    const requesterChannelId = member?.voice?.channelId || null;

    if (!botChannelId || !requesterChannelId || requesterChannelId !== botChannelId) {
      await this.deactivateControlPanel(guild.id, "Painel expirado: o dono da sessao ou o bot saiu do canal.").catch(() => {});
      await interaction.reply({
        content: "Este painel deixou de ser valido porque a sessao ja nao esta completa no canal de voz.",
        ephemeral: true,
      }).catch(() => {});
      return null;
    }

    return this.getPlayer(guild.id);
  }

  async handleControlInteraction(interaction) {
    const parts = interaction.customId.split("_");
    const action = parts[1];
    const guildId = parts.slice(2).join("_");
    const panel = this.getControlPanel(guildId);
    const queue = await this.ensurePanelAccess(interaction, panel);
    if (!queue) {
      return;
    }

    if (action === "queue") {
      const pages = this.queuePages(queue);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle("Fila atual")
          .setDescription([
            ...this.buildNowPlayingLines(queue),
            "",
            "Proximas musicas:",
            pages[0],
          ].join("\n"))
          .setColor(0xffa500)
          .setTimestamp()],
        ephemeral: true,
      }).catch(() => {});
      return;
    }

    await interaction.deferUpdate().catch(() => {});

    if (action === "toggle") {
      if (queue.node.isPaused()) {
        queue.node.resume();
      } else {
        queue.node.pause();
      }
      await this.refreshControlPanel(guildId, {
        title: queue.node.isPaused() ? "Reproducao pausada" : "Reproducao retomada",
        lines: [],
      }).catch(() => {});
      return;
    }

    if (action === "skip") {
      queue.node.skip();
      await this.refreshControlPanel(guildId, {
        title: "Faixa passada",
        lines: [],
      }).catch(() => {});
      return;
    }

    if (action === "loop") {
      queue.setRepeatMode(this.nextRepeatMode(queue.repeatMode));
      await this.refreshControlPanel(guildId, {
        title: `Loop: ${this.formatRepeatMode(queue.repeatMode)}`,
        lines: [],
      }).catch(() => {});
      return;
    }

    if (action === "stop") {
      await this.destroy(guildId, "Painel encerrado: sessao terminada pelo dono.").catch(() => {});
    }
  }

  async getTextChannel(queue) {
    const channelId = queue?.metadata?.textChannelId || this.getControlPanel(queue?.guild?.id)?.textChannelId;
    if (!channelId) return null;
    return this.client.channels.cache.get(channelId)
      || await this.client.channels.fetch(channelId).catch(() => null);
  }

  async handleVoiceStateUpdate(oldState, newState) {
    const guildId = newState?.guild?.id || oldState?.guild?.id;
    if (!guildId) return;

    const panel = this.getControlPanel(guildId);
    if (!panel) return;

    const guild = newState?.guild || oldState?.guild;
    const owner = guild.members.cache.get(panel.ownerId)
      || await guild.members.fetch(panel.ownerId).catch(() => null);
    const ownerChannelId = owner?.voice?.channelId || null;
    const botChannelId = guild.members.me?.voice?.channelId || null;

    if (!botChannelId || !ownerChannelId || ownerChannelId !== botChannelId) {
      await this.deactivateControlPanel(guildId, "Painel expirado: o dono da sessao ou o bot saiu do canal.").catch(() => {});
    }
  }
}

module.exports = MusicManager;
