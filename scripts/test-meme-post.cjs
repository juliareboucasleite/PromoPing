#!/usr/bin/env node
require('dotenv').config({ path: '/root/PromoPing/.env' });

(async () => {
  const url = 'https://api.apileague.com/retrieve-random-meme?media-type=image&max-age-days=30';
  const res = await fetch(url, {
    headers: { 'x-api-key': process.env.API_LEAGUE_API_KEY, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('API error', res.status, text.slice(0, 300));
    process.exit(1);
  }
  const data = JSON.parse(text);
  console.log('OK meme:', data.url ? data.url.slice(0, 80) + '...' : data);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
