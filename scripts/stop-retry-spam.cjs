#!/usr/bin/env node
require('dotenv').config({ path: '/root/PromoPing/.env' });
const m = require('/root/PromoPing/backend/discord-bot/mysql2-compat');

(async () => {
  const p = m.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
  });

  // Produtos com preço mas sem UpdatedAt continuam a ser re-tentados todos os ciclos.
  // Repor o timestamp evita spam de Chrome para páginas que falham a extração.
  await p.query(`
    UPDATE produtos
    SET UpdatedAt = NOW()
    WHERE PrecoAtual IS NOT NULL AND UpdatedAt IS NULL AND DeletedAt IS NULL
  `);
  console.log('Timestamps repostos para produtos com preço.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
