#!/usr/bin/env node
require('dotenv').config({ path: '/root/PromoPing/.env' });
const m = require('/root/PromoPing/backend/discord-bot/mysql2-compat');

const CHANNEL_ID = '1442932093184245821';

(async () => {
  const p = m.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
  });

  await p.execute(
    'UPDATE news_config SET ChannelId = ?, LastCheck = NULL, UpdatedAt = NOW() WHERE IsActive = 1',
    [CHANNEL_ID]
  );

  const [rows] = await p.execute(
    'SELECT ChannelId, LastCheck, IsActive FROM news_config WHERE IsActive = 1'
  );
  console.log('news_config:', rows);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
