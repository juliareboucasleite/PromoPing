#!/usr/bin/env node
require('dotenv').config({ path: '/root/PromoPing/.env' });
const path = require('path');
const { Client, GatewayIntentBits } = require('/root/PromoPing/backend/discord-bot/node_modules/discord.js');
const memeHelpers = require('/root/PromoPing/backend/discord-bot/utils/memeHelpers');

const CHANNEL_ID = process.env.DISCORD_MEMES_CHANNEL_ID || '1442932408239259912';

(async () => {
  const url = 'https://api.apileague.com/retrieve-random-meme?media-type=image&max-age-days=30';
  const res = await fetch(url, {
    headers: { 'x-api-key': process.env.API_LEAGUE_API_KEY, Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error('API error', res.status, await res.text());
    process.exit(1);
  }
  const meme = await res.json();
  if (!meme?.url) {
    console.error('No meme url');
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_BOT_TOKEN);
  const channel = await client.channels.fetch(CHANNEL_ID);
  await channel.send(memeHelpers.buildMemeMessage(meme));
  console.log('Posted to channel', CHANNEL_ID);
  await client.destroy();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
