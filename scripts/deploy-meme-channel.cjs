#!/usr/bin/env node
require('dotenv').config({ path: '/root/PromoPing/.env' });
const m = require('/root/PromoPing/backend/discord-bot/mysql2-compat');

const CHANNEL_ID = '1442932408239259912';
const INTERVAL = parseInt(process.env.MEME_CHECK_INTERVAL_MINUTES || '180', 10);
const MAX_AGE = parseInt(process.env.MEME_MAX_AGE_DAYS || '30', 10);

(async () => {
  const p = m.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
  });

  await p.execute(`
    CREATE TABLE IF NOT EXISTS meme_config (
      Id INT AUTO_INCREMENT PRIMARY KEY,
      ChannelId VARCHAR(50) NOT NULL,
      CheckInterval INT DEFAULT 180,
      MaxAgeDays INT DEFAULT 30,
      IsActive INT DEFAULT 1,
      LastCheck TIMESTAMP NULL,
      CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [existing] = await p.execute(
    'SELECT Id FROM meme_config WHERE IsActive = 1 LIMIT 1'
  );

  if (existing.length) {
    await p.execute(
      `UPDATE meme_config SET ChannelId = ?, CheckInterval = ?, MaxAgeDays = ?,
       LastCheck = NULL, UpdatedAt = NOW() WHERE Id = ?`,
      [CHANNEL_ID, INTERVAL, MAX_AGE, existing[0].Id || existing[0].id]
    );
  } else {
    await p.execute(
      'INSERT INTO meme_config (ChannelId, CheckInterval, MaxAgeDays, IsActive) VALUES (?, ?, ?, 1)',
      [CHANNEL_ID, INTERVAL, MAX_AGE]
    );
  }

  const [rows] = await p.execute(
    'SELECT ChannelId, CheckInterval, MaxAgeDays, LastCheck, IsActive FROM meme_config WHERE IsActive = 1'
  );
  console.log('meme_config:', rows);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
