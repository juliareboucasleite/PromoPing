const Command = require("../../abstract/command");

module.exports = class ClearCommand extends Command {
  constructor(...args) {
    super(...args, {
      name: "clear",
      aliases: ["purge"],
      description: "Clears number of messages in a particular channel",
      usage: ["clear (type) <amount>"],
      category: "Moderation",
      userPerms: ["ManageMessages"],
      botPerms: ["EmbedLinks", "ViewChannel", "SendMessages", "ManageMessages"],
      cooldown: 5,
      image: "https://i.imgur.com/OkakjBY.png",
      options: [
        // keep your slash options as you had them
        {
          type: 3,
          name: "type",
          description: "Type Of Messages To Clear",
          required: true,
          choices: [
            { name: "All", value: "all" },
            { name: "Bots", value: "bot" },
            { name: "Users", value: "user" },
            { name: "Contains", value: "contains" },
            { name: "Emojis", value: "emoji" },
            { name: "Links", value: "link" },
          ],
        },
        {
          type: 4,
          name: "amount",
          description: "Amount Of Messages To Clear",
          required: true,
        },
        {
          type: 3,
          name: "contains",
          description: "Text To Clear Messages With",
          required: false,
        },
      ],
    });
  }

  // helper to reply for both messages and interactions
  async _reply(ctx, payload = {}, ephemeral = false) {
    try {
      // interaction objects usually have channel null before reply; prefer .reply for them
      if (typeof ctx.reply === "function" && ctx.channel === null) {
        if (typeof payload === "string")
          return ctx.reply({ content: payload, ephemeral });
        return ctx.reply(Object.assign({}, payload, { ephemeral }));
      }
      // message or interaction where channel is present
      if (typeof ctx.reply === "function") {
        // message.reply or interaction.reply both supported
        if (typeof payload === "string") return ctx.reply(payload);
        return ctx.reply(payload);
      }
      // fallback to channel.send
      const channel = ctx.channel || (ctx.message && ctx.message.channel);
      if (channel && typeof channel.send === "function") {
        if (typeof payload === "string") return channel.send(payload);
        return channel.send(payload);
      }
    } catch (err) {
      // best-effort: ignore
      try {
        if (typeof ctx.followUp === "function") return ctx.followUp(payload);
      } catch {}
    }
  }

  // Normalize & extract amount from args (first numeric token)
  _extractAmountFromArgs(args) {
    if (!Array.isArray(args)) return null;
    const num = args.find((a) => /^\d+$/.test(String(a)));
    return num ? Math.max(1, Math.min(100, parseInt(num, 10))) : null;
  }

  // message command
  async run({ message, args = [] }) {
    await this._handle(message, args);
  }

  // slash command
  async exec({ interaction }) {
    // For slash we use options
    const type = interaction.options.getString("type") || null;
    const amount = interaction.options.getInteger("amount") || null;
    const contains = interaction.options.getString("contains") || null;

    // Build a pseudo-args array so handler can be reused
    const args = [];
    if (type) args.push(type);
    if (amount) args.push(String(amount));
    if (contains) args.push(contains);

    await this._handle(interaction, args);
  }

  // main handler used by both run and exec
  async _handle(ctx, rawArgs = []) {
    // ensure rawArgs array
    const args = Array.isArray(rawArgs)
      ? rawArgs.filter((a) => a !== undefined && a !== null)
      : [];

    // find amount (first numeric token). If not present default to 100 for "all" style operations, else require explicit
    let amount = this._extractAmountFromArgs(args);

    // Determine type: if first arg is a number, treat as plain bulk delete amount
    let first = args[0] ? String(args[0]) : null;
    let type =
      first && /^\d+$/.test(first)
        ? "amount"
        : first
        ? String(first).toLowerCase()
        : null;

    // if type is null, show usage
    if (!type) {
      return this._reply(
        ctx,
        "❌ Usage: `clear <type|amount> <amount?>`\nExamples: `clear 20` `clear bots 50` `clear contains 50 some text`"
      );
    }

    // if amount not found and type != 'contains' (where amount could be second arg), try second token
    if (!amount) {
      // attempt to parse second arg if exists
      const maybe = args[1] || null;
      if (maybe && /^\d+$/.test(String(maybe)))
        amount = Math.max(1, Math.min(100, parseInt(maybe, 10)));
    }

    // final fallback default amount for general clear (when user typed 'all' or 'bot' but no number) => 100
    if (!amount && type !== "contains" && type !== "amount") amount = 100;

    // if type is 'amount' (user used `clear 20`) set amount accordingly
    if (type === "amount") {
      amount = Math.max(1, Math.min(100, parseInt(first, 10)));
      // do bulk delete simple case
      try {
        await ctx.channel.bulkDelete(amount, true).catch(() => {});
      } catch (e) {}
      const embed = this.client.util
        .embed()
        .setDescription(`✅ Successfully cleared ${amount} messages.`)
        ;
      return this._reply(ctx, { embeds: [embed] });
    }

    // At this point type is a string like 'all', 'bot', 'user', 'contains', 'emoji', 'link'
    switch (type) {
      case "all":
      case "everything": {
        if (!amount) amount = 100;
        await ctx.channel.bulkDelete(amount, true).catch(() => {});
        const embed = this.client.util
          .embed()
          .setDescription(`✅ Successfully cleared ${amount} messages.`)
          ;
        return this._reply(ctx, { embeds: [embed] });
      }

      case "bot":
      case "bots": {
        if (!amount) amount = 100;
        const fetched = await ctx.channel.messages
          .fetch({ limit: amount })
          .catch(() => null);
        if (!fetched) return this._reply(ctx, "❌ Failed to fetch messages.");
        const botMessages = fetched.filter((m) => m.author?.bot);
        await ctx.channel.bulkDelete(botMessages, true).catch(() => {});
        const embed = this.client.util
          .embed()
          .setDescription(
            `✅ Successfully cleared ${botMessages.size} bot messages (checked ${amount}).`
          )
          ;
        return this._reply(ctx, { embeds: [embed] });
      }

      case "user":
      case "users": {
        // two ways: mention/id provided or just remove non-bot messages
        // if second arg is a mention or id, remove that user's messages; else remove non-bot messages
        let userArg = args[1] || null;
        if (userArg && userArg.match && userArg.match(/<@!?(\d{17,19})>/)) {
          // mention
          const id = userArg.replace(/[<@!>]/g, "");
          const fetched = await ctx.channel.messages
            .fetch({ limit: amount || 100 })
            .catch(() => null);
          if (!fetched) return this._reply(ctx, "❌ Failed to fetch messages.");
          const userMessages = fetched.filter((m) => m.author?.id === id);
          await ctx.channel.bulkDelete(userMessages, true).catch(() => {});
          const embed = this.client.util
            .embed()
            .setDescription(
              `✅ Successfully cleared ${userMessages.size} messages from <@${id}>.`
            )
            ;
          return this._reply(ctx, { embeds: [embed] });
        } else if (userArg && /^\d{17,19}$/.test(userArg)) {
          const id = userArg;
          const fetched = await ctx.channel.messages
            .fetch({ limit: amount || 100 })
            .catch(() => null);
          if (!fetched) return this._reply(ctx, "❌ Failed to fetch messages.");
          const userMessages = fetched.filter((m) => m.author?.id === id);
          await ctx.channel.bulkDelete(userMessages, true).catch(() => {});
          const embed = this.client.util
            .embed()
            .setDescription(
              `✅ Successfully cleared ${userMessages.size} messages from <@${id}>.`
            )
            ;
          return this._reply(ctx, { embeds: [embed] });
        } else {
          // clear messages from users (non-bot)
          if (!amount) amount = 100;
          const fetched = await ctx.channel.messages
            .fetch({ limit: amount })
            .catch(() => null);
          if (!fetched) return this._reply(ctx, "❌ Failed to fetch messages.");
          const userMessages = fetched.filter((m) => !m.author?.bot);
          await ctx.channel.bulkDelete(userMessages, true).catch(() => {});
          const embed = this.client.util
            .embed()
            .setDescription(
              `✅ Successfully cleared ${userMessages.size} user messages (checked ${amount}).`
            )
            ;
          return this._reply(ctx, { embeds: [embed] });
        }
      }

      case "contains":
      case "contain":
      case "includes":
      case "include": {
        // format: clear contains <amount?> <search string...>
        // find search text: prefer the last arg(s) after numeric amount if present
        let searchText = "";
        // if args[1] is numeric, the rest is search
        if (args[1] && /^\d+$/.test(String(args[1])))
          searchText = args.slice(2).join(" ");
        else searchText = args.slice(1).join(" ");
        if (!searchText)
          return this._reply(
            ctx,
            "❌ Please provide the text to search for. Example: `clear contains 50 hello` or `clear contains hello`"
          );
        if (!amount) amount = 100;
        const fetched = await ctx.channel.messages
          .fetch({ limit: amount })
          .catch(() => null);
        if (!fetched) return this._reply(ctx, "❌ Failed to fetch messages.");
        const containsMessages = fetched.filter((m) =>
          (m.content || "").toLowerCase().includes(searchText.toLowerCase())
        );
        await ctx.channel.bulkDelete(containsMessages, true).catch(() => {});
        const embed = this.client.util
          .embed()
          .setDescription(
            `✅ Successfully cleared ${containsMessages.size} messages containing **${searchText}**.`
          )
          ;
        return this._reply(ctx, { embeds: [embed] });
      }

      case "emoji":
      case "emojis": {
        if (!amount) amount = 100;
        const fetched = await ctx.channel.messages
          .fetch({ limit: amount })
          .catch(() => null);
        if (!fetched) return this._reply(ctx, "❌ Failed to fetch messages.");
        const emojiMessages = fetched.filter((m) =>
          /<a?:\w{2,32}:\d{17,19}>/.test(m.content || "")
        );
        await ctx.channel.bulkDelete(emojiMessages, true).catch(() => {});
        const embed = this.client.util
          .embed()
          .setDescription(
            `✅ Successfully cleared ${emojiMessages.size} messages containing emojis (checked ${amount}).`
          )
          ;
        return this._reply(ctx, { embeds: [embed] });
      }

      case "link":
      case "links": {
        if (!amount) amount = 100;
        const fetched = await ctx.channel.messages
          .fetch({ limit: amount })
          .catch(() => null);
        if (!fetched) return this._reply(ctx, "❌ Failed to fetch messages.");
        const linkMessages = fetched.filter((m) =>
          /(?:(?:https?|ftp):\/\/)?[\w/\-?=%.]+\.[\w/\-?=%.]+/.test(
            m.content || ""
          )
        );
        await ctx.channel.bulkDelete(linkMessages, true).catch(() => {});
        const embed = this.client.util
          .embed()
          .setDescription(
            `✅ Successfully cleared ${linkMessages.size} messages containing links (checked ${amount}).`
          )
          ;
        return this._reply(ctx, { embeds: [embed] });
      }

      default: {
        // unknown type: show usage
        return this._reply(
          ctx,
          "❌ Unknown type. Usage: `clear <all|bot|user|contains|emoji|link|<amount>> <amount?>`"
        );
      }
    }
  }
};



