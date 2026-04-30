const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { Player: SearchPlayer, QueryType, QueueRepeatMode } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");
const { YoutubeSabrExtractor } = require("discord-player-googlevideo");
const { Connectors, LoadType, Shoukaku } = require("shoukaku");

class TrackStore {
  constructor(items = []) {
    this.items = Array.isArray(items) ? items : [];
  }

  push(...tracks) {
    this.items.push(...tracks.flat().filter(Boolean));
    return this.items.length;
  }

  shift() {
    return this.items.shift() || null;
  }

  remove(index) {
    if (index < 0 || index >= this.items.length) {
      return null;
    }

    return this.items.splice(index, 1)[0] || null;
  }

  clear() {
    const removed = [...this.items];
    this.items.length = 0;
    return removed;
  }

  shuffle() {
    for (let i = this.items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    }

    return this;
  }

  toArray() {
    return [...this.items];
  }

  get length() {
    return this.items.length;
  }
}

class MusicManager {
  constructor(client) {
    this.client = client;
    this.player = null;
    this.shoukaku = null;
    this.initialized = false;
    this.initPromise = null;
    this.boundEvents = false;
    this.controlPanels = new Map();
    this.queues = new Map();
    this.nodeName = "main";
  }

  get enabled() {
    return true;
  }

  async init() {
    if (this.initialized && this.player && this.shoukaku) {
      return this.player;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.player = new SearchPlayer(this.client);
      await this.player.extractors.loadMulti(DefaultExtractors);
      await this.player.extractors.register(YoutubeSabrExtractor, {});
      this.setupLavalink();
      this.bindEvents();
      this.initialized = true;
      return this.player;
    })().catch((error) => {
      this.initPromise = null;
      this.player = null;
      this.shoukaku = null;
      this.initialized = false;
      throw error;
    });

    return this.initPromise;
  }

  setupLavalink() {
    if (this.shoukaku) {
      return this.shoukaku;
    }

    const rawUrl = process.env.LAVALINK_URL || process.env.LAVALINK_HOST || "127.0.0.1:2333";
    const password = process.env.LAVALINK_PASSWORD || process.env.LAVALINK_AUTH || "promoping-lavalink";
    const target = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? new URL(rawUrl)
      : new URL(`http://${rawUrl}`);

    this.shoukaku = new Shoukaku(
      new Connectors.DiscordJS(this.client),
      [{
        name: this.nodeName,
        url: `${target.hostname}:${target.port || (target.protocol === "https:" ? "443" : "2333")}`,
        auth: password,
        secure: target.protocol === "https:",
      }],
      {
        moveOnDisconnect: false,
        reconnectInterval: 5_000,
        reconnectTries: 3,
        restTimeout: 15_000,
        resume: false,
      }
    );

    this.shoukaku.on("ready", (name) => {
      console.log(`[music] Lavalink pronto: ${name}`);
    });

    this.shoukaku.on("error", (name, error) => {
      console.error(`[music] Lavalink erro em ${name}:`, error?.message || error);
    });

    this.shoukaku.on("close", (name, code, reason) => {
      console.warn(`[music] Lavalink fechou ${name}: ${code} ${reason || ""}`.trim());
    });

    return this.shoukaku;
  }

  bindEvents() {
    if (this.boundEvents) {
      return;
    }

    this.boundEvents = true;
  }

  ensureReady() {
    return Boolean(this.player && this.shoukaku && this.shoukaku.nodes.size > 0);
  }

  getConnectedNodes() {
    if (!this.shoukaku) {
      return [];
    }

    return [...this.shoukaku.nodes.values()].map((node) => ({
      name: node.name,
      state: node.state,
    }));
  }

  hasConnectedNode() {
    return Boolean(this.shoukaku && this.shoukaku.nodes.size > 0);
  }

  async waitForNode(timeoutMs = 10_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (this.hasConnectedNode()) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return this.hasConnectedNode();
  }

  getPlayer(guildId) {
    return this.queues.get(guildId) || null;
  }

  getVoiceChannelId(queue) {
    return queue?.voiceChannelId
      || queue?.channel?.id
      || queue?.connection?.joinConfig?.channelId
      || null;
  }

  getQueuePosition(queue) {
    const base = Number(queue?.position || 0);
    if (!queue?.currentTrack || queue?.paused) {
      return base;
    }

    const elapsed = Math.max(0, Date.now() - Number(queue.lastPositionAt || Date.now()));
    const total = Number(queue.currentTrack.durationMS || 0);
    const computed = base + elapsed;
    return total > 0 ? Math.min(computed, total) : computed;
  }

  createQueueNode(queue) {
    const node = {
      play: async (track) => this.playTrack(queue, track),
      skip: async () => this.skip(queue),
      pause: () => {
        queue.paused = true;
        return queue.lavalink.setPaused(true).catch(() => {});
      },
      resume: () => {
        queue.paused = false;
        queue.lastPositionAt = Date.now();
        return queue.lavalink.setPaused(false).catch(() => {});
      },
      isPaused: () => Boolean(queue.paused),
      setVolume: (amount) => this.setVolume(queue, amount),
      seek: (position) => this.seek(queue, position),
      remove: (index) => queue.tracks.remove(index),
    };

    Object.defineProperties(node, {
      streamTime: {
        get: () => this.getQueuePosition(queue),
      },
      volume: {
        get: () => queue.volume,
      },
    });

    return node;
  }

  createQueueHistory(queue) {
    return {
      get previousTrack() {
        return queue.historyItems[queue.historyItems.length - 1] || null;
      },
      previous: async () => this.playPrevious(queue),
    };
  }

  async createPlayer({ guild, member, textId }) {
    await this.init();

    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
      throw new Error("Entra primeiro num canal de voz.");
    }

    let queue = this.getPlayer(guild.id);
    const metadata = { textChannelId: textId, guildId: guild.id };

    if (queue) {
      queue.guild = guild;
      queue.channel = voiceChannel;
      queue.voiceChannelId = voiceChannel.id;
      queue.connection = { joinConfig: { channelId: voiceChannel.id } };
      queue.setMetadata(metadata);
      return queue;
    }

    const shardId = guild.shardId ?? 0;
    const lavalinkPlayer = await this.shoukaku.joinVoiceChannel({
      guildId: guild.id,
      shardId,
      channelId: voiceChannel.id,
      deaf: true,
      mute: false,
    });

    queue = {
      guild,
      guildId: guild.id,
      lavalink: lavalinkPlayer,
      metadata,
      channel: voiceChannel,
      connection: { joinConfig: { channelId: voiceChannel.id } },
      voiceChannelId: voiceChannel.id,
      currentTrack: null,
      repeatMode: QueueRepeatMode.OFF,
      paused: false,
      volume: 80,
      position: 0,
      lastPositionAt: Date.now(),
      active: true,
      deleted: false,
      ignoreEndEvent: false,
      tracks: new TrackStore(),
      historyItems: [],
    };

    queue.node = this.createQueueNode(queue);
    queue.history = this.createQueueHistory(queue);
    queue.setMetadata = (value) => {
      queue.metadata = value;
    };
    queue.setRepeatMode = (value) => {
      queue.repeatMode = value;
    };
    queue.addTrack = (value) => {
      const items = Array.isArray(value) ? value : [value];
      queue.tracks.push(...items);
      return queue;
    };
    queue.clear = () => queue.tracks.clear();
    queue.delete = () => this.destroy(queue.guildId, "Painel encerrado.");

    this.bindQueueEvents(queue);
    await lavalinkPlayer.setGlobalVolume(queue.volume).catch(() => {});
    this.queues.set(guild.id, queue);
    return queue;
  }

  bindQueueEvents(queue) {
    const player = queue.lavalink;

    player.on("start", async () => {
      queue.paused = false;
      queue.position = 0;
      queue.lastPositionAt = Date.now();

      const channel = await this.getTextChannel(queue);
      const track = queue.currentTrack;
      if (channel && track) {
        await channel.send({
          embeds: [{
            title: "A tocar agora",
            color: 0xffa500,
            description: [
              `**${track.title}**`,
              `${track.author || "Artista desconhecido"}`,
              track.url ? `[Abrir musica](${track.url})` : null,
              `Duracao: \`${this.formatDuration(track.durationMS || 0)}\``,
            ].filter(Boolean).join("\n"),
          }],
          allowedMentions: { parse: [] },
        }).catch(() => {});
      }

      await this.refreshControlPanel(queue.guildId).catch(() => {});
    });

    player.on("update", (data) => {
      const position = Number(data?.state?.position ?? player.position ?? 0);
      queue.position = position;
      queue.lastPositionAt = Date.now();
      queue.paused = Boolean(player.paused);
    });

    player.on("end", async (event) => {
      if (queue.ignoreEndEvent) {
        queue.ignoreEndEvent = false;
        return;
      }

      await this.handleTrackEnd(queue, event?.reason || "finished").catch(() => {});
    });

    player.on("exception", async (event) => {
      const channel = await this.getTextChannel(queue);
      const message = String(
        event?.exception?.message
        || event?.exception?.cause
        || "Nao consegui reproduzir essa faixa."
      ).slice(0, 300);

      if (channel) {
        await channel.send({
          embeds: [{
            title: "Erro de musica",
            color: 0xffa500,
            description: [
              queue.currentTrack ? `Faixa: **${queue.currentTrack.title}**` : null,
              `Erro: ${message}`,
            ].filter(Boolean).join("\n"),
          }],
          allowedMentions: { parse: [] },
        }).catch(() => {});
      }

      await this.handleTrackEnd(queue, "loadFailed").catch(() => {});
    });

    player.on("stuck", async () => {
      await this.handleTrackEnd(queue, "loadFailed").catch(() => {});
    });

    player.on("closed", async () => {
      if (!queue.deleted) {
        await this.destroy(queue.guildId, "Painel encerrado: a conexao de voz foi fechada.").catch(() => {});
      }
    });
  }

  async search(query, requester) {
    await this.init();
    const primary = await this.player.search(query, {
      requestedBy: requester || null,
      searchEngine: QueryType.AUTO,
    });
    if (primary?.tracks?.length) {
      return primary;
    }

    const normalizedSpotifyQuery = this.normalizeSpotifyQuery(query);
    if (normalizedSpotifyQuery && normalizedSpotifyQuery !== query) {
      return this.player.search(normalizedSpotifyQuery, {
        requestedBy: requester || null,
        searchEngine: QueryType.AUTO,
      });
    }

    return primary;
  }

  normalizeSpotifyQuery(query) {
    const value = String(query || "").trim();
    if (!value.includes("open.spotify.com/")) {
      return null;
    }

    try {
      const url = new URL(value);
      url.search = "";
      url.hash = "";
      url.pathname = url.pathname.replace(/^\/intl-[^/]+/i, "");
      return url.toString();
    } catch {
      return value
        .replace(/\/intl-[^/]+/i, "")
        .replace(/[?#].*$/, "");
    }
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

  getIdealNode() {
    return this.shoukaku?.getIdealNode?.() || null;
  }

  buildLavalinkIdentifier(track) {
    if (track?.encoded && track?.info) {
      return null;
    }

    const url = String(track?.url || "").trim();
    if (url) {
      return url;
    }

    const title = String(track?.title || "").trim();
    const author = String(track?.author || "").trim();
    const query = [author, title].filter(Boolean).join(" - ") || title || author;
    return query ? `ytsearch:${query}` : null;
  }

  pickLavalinkTrack(result) {
    if (!result) {
      return null;
    }

    if (result.loadType === LoadType.TRACK) {
      return result.data || null;
    }

    if (result.loadType === LoadType.SEARCH) {
      return result.data?.[0] || null;
    }

    if (result.loadType === LoadType.PLAYLIST) {
      const selected = Number(result.data?.info?.selectedTrack ?? 0);
      return result.data?.tracks?.[selected >= 0 ? selected : 0] || result.data?.tracks?.[0] || null;
    }

    return null;
  }

  normalizeResolvedTrack(track, fallback = null) {
    const info = track?.info || {};
    return {
      encoded: track?.encoded || null,
      info,
      title: info.title || fallback?.title || "Faixa desconhecida",
      author: info.author || fallback?.author || "Artista desconhecido",
      url: info.uri || fallback?.url || null,
      durationMS: Number(info.length || fallback?.durationMS || fallback?.duration || 0),
      duration: Number(info.length || fallback?.durationMS || fallback?.duration || 0),
      thumbnail: info.artworkUrl || fallback?.thumbnail || null,
      source: info.sourceName || fallback?.source || "unknown",
      requestedBy: fallback?.requestedBy || null,
      raw: fallback?.raw || fallback || track,
    };
  }

  async resolveLavalinkTrack(track) {
    if (track?.encoded && track?.info) {
      return this.normalizeResolvedTrack(track, track);
    }

    const identifier = this.buildLavalinkIdentifier(track);
    if (!identifier) {
      return null;
    }

    const node = this.getIdealNode();
    if (!node) {
      throw new Error("Nao encontrei nenhum no Lavalink ligado.");
    }

    const result = await node.rest.resolve(identifier);
    const resolved = this.pickLavalinkTrack(result);
    if (!resolved) {
      return null;
    }

    return this.normalizeResolvedTrack(resolved, track);
  }

  pushHistory(queue, track) {
    if (!track) {
      return;
    }

    const previous = queue.historyItems[queue.historyItems.length - 1];
    if (previous?.encoded === track.encoded && previous?.title === track.title) {
      return;
    }

    queue.historyItems.push(track);
    if (queue.historyItems.length > 50) {
      queue.historyItems.shift();
    }
  }

  async playTrack(queue, rawTrack, options = {}) {
    const track = await this.resolveLavalinkTrack(rawTrack);
    if (!track?.encoded) {
      throw new Error("Reconheci essa musica, mas nao encontrei audio reproduzivel no Lavalink.");
    }

    const previous = queue.currentTrack;
    if (!options.fromHistory && !options.replay && previous) {
      this.pushHistory(queue, previous);
    }

    if (previous) {
      queue.ignoreEndEvent = true;
    }

    queue.currentTrack = track;
    queue.paused = false;
    queue.position = 0;
    queue.lastPositionAt = Date.now();

    await queue.lavalink.playTrack({
      track: { encoded: track.encoded },
      volume: queue.volume,
    });

    return track;
  }

  async setVolume(queue, amount) {
    const volume = Math.max(0, Math.min(Number(amount || 80), 200));
    queue.volume = volume;
    await queue.lavalink.setGlobalVolume(volume);
  }

  async seek(queue, position) {
    const target = Math.max(0, Number(position || 0));
    queue.position = target;
    queue.lastPositionAt = Date.now();
    await queue.lavalink.seekTo(target);
  }

  async skip(queue) {
    if (!queue?.currentTrack) {
      return false;
    }

    const current = queue.currentTrack;
    this.pushHistory(queue, current);

    if (queue.repeatMode === QueueRepeatMode.QUEUE) {
      queue.tracks.push(current);
    }

    const next = queue.tracks.shift();
    if (!next) {
      queue.currentTrack = null;
      await queue.lavalink.stopTrack().catch(() => {});
      await this.finishQueue(queue);
      return false;
    }

    await this.playTrack(queue, next, { fromHistory: true });
    return true;
  }

  async playPrevious(queue) {
    const previous = queue.history.previousTrack;
    if (!previous) {
      return false;
    }

    if (queue.currentTrack) {
      queue.tracks.items.unshift(queue.currentTrack);
    }

    queue.historyItems.pop();
    await this.playTrack(queue, previous, { fromHistory: true });
    return true;
  }

  async handleTrackEnd(queue, reason) {
    if (!queue || queue.deleted) {
      return;
    }

    if (reason === "replaced") {
      return;
    }

    const current = queue.currentTrack;
    if (!current) {
      if (!queue.tracks.length) {
        await this.finishQueue(queue);
      }
      return;
    }

    if (reason === "finished" && queue.repeatMode === QueueRepeatMode.TRACK) {
      await this.playTrack(queue, current, { replay: true, fromHistory: true });
      return;
    }

    if (reason !== "stopped") {
      this.pushHistory(queue, current);
    }

    if (queue.repeatMode === QueueRepeatMode.QUEUE) {
      queue.tracks.push(current);
    }

    const next = queue.tracks.shift();
    queue.currentTrack = null;

    if (next) {
      await this.playTrack(queue, next, { fromHistory: true });
      return;
    }

    await this.finishQueue(queue);
  }

  async finishQueue(queue) {
    if (!queue || queue.deleted) {
      return;
    }

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

    await this.deactivateControlPanel(queue.guildId, "Painel encerrado: a fila terminou.").catch(() => {});
    await this.teardownQueue(queue).catch(() => {});
  }

  async teardownQueue(queue) {
    if (!queue) {
      return false;
    }

    queue.deleted = true;
    queue.active = false;
    queue.currentTrack = null;
    this.queues.delete(queue.guildId);

    await queue.lavalink.destroy().catch(() => {});
    await this.shoukaku?.leaveVoiceChannel(queue.guildId).catch(() => {});
    return true;
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

    const current = Number(this.getQueuePosition(queue) || 0);
    const total = Number(track.durationMS || 0);

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
      return `\`${index + 1}.\` **${track.title}**\n${track.author || "Artista desconhecido"}  •  \`${this.formatDuration(track.durationMS || 0)}\``;
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
    await this.teardownQueue(queue).catch(() => {});
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
      await queue.node.skip();
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
