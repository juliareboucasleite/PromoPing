const Command = require("../../abstract/command");
const { VoiceRecorder } = require("@kirdock/discordjs-voice-recorder");
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");
const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");

module.exports = class Record extends Command {
  constructor(...args) {
    super(...args, {
      name: "record",
      description: "Record audio from your current voice channel.",
      category: "Utilities",
      aliases: ["rec"],
      usage: ["record [time]"],
      examples: ["record 2", "record 30s", "record 5m"],
      userPerms: ["ViewChannel", "SendMessages"],
      botPerms: ["ViewChannel", "SendMessages", "Connect", "Speak"],
      cooldown: 10,
      image: "https://imgur.com/fKYqHRy",
      options: [
        {
          type: 3,
          name: "time",
          description: "Recording duration like 30s, 2m, or 5",
          required: false,
        },
      ],
    });
  }

  parseMinutes(value) {
    let raw = String(value || "2").trim().toLowerCase();
    if (!raw) raw = "2";

    if (raw.endsWith("s")) {
      const seconds = Number(raw.slice(0, -1));
      return Number.isFinite(seconds) ? seconds / 60 : NaN;
    }

    if (raw.endsWith("m")) {
      const minutes = Number(raw.slice(0, -1));
      return Number.isFinite(minutes) ? minutes : NaN;
    }

    const minutes = Number(raw);
    return Number.isFinite(minutes) ? minutes : NaN;
  }

  async reply(target, payload) {
    const safePayload = {
      allowedMentions: { parse: [] },
      ...payload,
    };

    if (!target?.user) {
      return target.reply(safePayload);
    }

    const interactionPayload = {
      ...safePayload,
      flags: safePayload.flags ?? 64,
    };

    if (target.deferred || target.replied) {
      return target.editReply(interactionPayload);
    }

    return target.reply(interactionPayload);
  }

  async perform(target, rawTime) {
    const guild = await this.client.guilds.fetch(target.guild.id).catch(() => target.guild);
    const textChannel = target.channel;
    const actor = target.user || target.author;
    const member = target.member;
    const voiceChannel = member?.voice?.channel;
    const botMember = guild.members.me || await guild.members.fetch(this.client.user.id).catch(() => null);

    if (botMember?.voice?.channel) {
      // If we are already in the target channel, we can reuse the connection or leave first
      if (botMember.voice.channel.id !== voiceChannel.id) {
        return this.reply(target, { content: "I'm already recording in another voice channel." });
      }
    }

    if (!voiceChannel) {
      return this.reply(target, { content: "You need to join a voice channel first." });
    }

    const voicePermissions = voiceChannel.permissionsFor(botMember);
    if (
      !voicePermissions?.has(PermissionsBitField.Flags.Connect) ||
      !voicePermissions?.has(PermissionsBitField.Flags.Speak)
    ) {
      return this.reply(target, {
        content: "I need `Connect` and `Speak` permissions in that voice channel.",
      });
    }

    const mins = this.parseMinutes(rawTime);
    if (!Number.isFinite(mins) || mins <= 0) {
      return this.reply(target, { content: "Please provide a valid recording duration." });
    }

    if (mins > 10) {
      return this.reply(target, { content: "You can only record up to 10 minutes." });
    }

    if (target.user && !target.deferred && !target.replied) {
      await target.deferReply({ flags: 64 });
    }

    let connection;
    let attempts = 0;
    const maxAttempts = 2;

    const connect = async () => {
      attempts++;
      console.log(`[Voice] Connection attempt ${attempts}/${maxAttempts}`);
      
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
        debug: true,
      });

      connection.on('error', (error) => {
        console.error(`[Voice Error Attempt ${attempts}]`, error);
      });

      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Ready, 20_000),
          new Promise((_, reject) => {
            const onStateChange = (_, newState) => {
              if (newState.status === VoiceConnectionStatus.Disconnected) {
                connection.off('stateChange', onStateChange);
                reject(new Error(`Disconnected: ${newState.reason}`));
              }
            };
            connection.on('stateChange', onStateChange);
          })
        ]);
        return true;
      } catch (err) {
        console.log(`[Voice attempt ${attempts} failed]: ${err.message}`);
        if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
          connection.destroy();
        }
        if (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 2000));
          return connect();
        }
        throw err;
      }
    };

    try {
      await connect();
      console.log(`[Voice] Connection Ready!`);
    } catch (err) {
      return this.reply(target, { content: `Failed to establish a voice connection after ${maxAttempts} attempts. Error: ${err.message}. \n\nThis is likely a temporary Discord voice server issue or an encryption handshake failure. Please try again in a few seconds.` });
    }

    // Wait a brief moment for the connection to fully settle
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const recorder = new VoiceRecorder();
    recorder.startRecording(connection);

    const cacheKey = `${guild.id}recorder`;
    this.client.cacheManager.set(cacheKey, Date.now());

    const stopRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("record-stop")
        .setLabel("Stop")
        .setStyle(ButtonStyle.Danger)
    );

    const controlMessage = target.user
      ? await target.editReply({ content: "**Recording started.**", components: [stopRow] })
      : await textChannel.send({
          content: "**Recording started.**",
          components: [stopRow],
          allowedMentions: { parse: [] },
        });

    let finished = false;
    let timeoutId;
    let collector;

    const cleanup = async (elapsedMinutes, sendInChannel = false) => {
      if (finished) return;
      finished = true;

      clearTimeout(timeoutId);
      this.client.cacheManager.del(cacheKey);

      const safeMinutes = Math.max(Number(elapsedMinutes) || mins, 0.05);
      const buffer = await recorder
        .getRecordedVoiceAsBuffer(guild.id, "single", safeMinutes)
        .catch(() => null);

      recorder.stopRecording(connection);

      if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
      }

      const payload = !buffer?.length
        ? {
            content:
              connection.state.status === VoiceConnectionStatus.Ready
                ? "Recording ended, but no audio was captured. Start speaking immediately after the recording starts and try again."
                : "Recording ended, but the voice connection was lost before audio could be captured.",
          }
        : {
            content: "Recording ended!",
            files: [new AttachmentBuilder(buffer, { name: "voice-message.mp3" })],
          };

      if (sendInChannel || !target.user) {
        await textChannel.send({
          ...payload,
          allowedMentions: { parse: [] },
        }).catch(() => null);
      } else {
        await target.editReply({
          ...payload,
          components: [],
          allowedMentions: { parse: [] },
        }).catch(() => null);
      }

      await controlMessage.delete().catch(() => null);
      collector?.stop("finished");
      connection.off(VoiceConnectionStatus.Disconnected, disconnectedListener);
    };

    const disconnectedListener = async () => {
      const startedAt = this.client.cacheManager.get(cacheKey) || Date.now();
      const elapsedMinutes = (Date.now() - startedAt) / 60000;
      await cleanup(elapsedMinutes, !target.user);
    };

    connection.on(VoiceConnectionStatus.Disconnected, disconnectedListener);

    timeoutId = setTimeout(async () => {
      await cleanup(mins, false);
    }, mins * 60000);

    collector = controlMessage.createMessageComponentCollector({
      filter: (interaction) =>
        interaction.customId === "record-stop" && interaction.user.id === actor.id,
      time: mins * 60000,
    });

    collector.on("collect", async (interaction) => {
      if (!interaction.member?.voice?.channel) {
        return interaction.reply({
          content: "You need to be in a voice channel to use this button.",
          flags: 64,
        });
      }

      const botVoiceId = guild.members.cache.get(this.client.user.id)?.voice?.channel?.id;
      if (interaction.member.voice.channel.id !== botVoiceId) {
        return interaction.reply({
          content: "You need to be in the same voice channel as me to stop the recording.",
          flags: 64,
        });
      }

      await interaction.deferUpdate().catch(() => null);
      const startedAt = this.client.cacheManager.get(cacheKey) || Date.now();
      const elapsedMinutes = (Date.now() - startedAt) / 60000;
      await cleanup(elapsedMinutes, !target.user);
    });

    collector.on("end", async (_collected, reason) => {
      if (reason === "time" && !finished) {
        await controlMessage.edit({ components: [] }).catch(() => null);
      }
    });
  }

  async run({ message, args }) {
    return this.perform(message, args[0]);
  }

  async exec({ interaction }) {
    return this.perform(interaction, interaction.options.getString("time"));
  }
};


