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

  // Force re-scrape of non-Worten products by clearing UpdatedAt
  const [res] = await p.query(`
    UPDATE produtos
    SET UpdatedAt = NULL
    WHERE DeletedAt IS NULL
      AND Link IS NOT NULL AND Link <> ''
      AND Link NOT ILIKE '%worten%'
  `);

  const [rows] = await p.query(`
    SELECT Id, Nome, PrecoAtual, UpdatedAt
    FROM produtos
    WHERE DeletedAt IS NULL AND Link NOT ILIKE '%worten%'
    ORDER BY Id
  `);
  rows.forEach((r) =>
    console.log(`#${r.id || r.Id} ${(r.nome || r.Nome || '').slice(0, 30)} -> upd=${r.updatedat ?? r.UpdatedAt}`)
  );
  console.log('Marcados para re-scrape (UpdatedAt=NULL).');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
