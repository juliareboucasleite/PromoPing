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

  const [rows] = await p.query(`
    SELECT Id, Nome, PrecoAtual, PrecoAlvo, UpdatedAt, Link
    FROM produtos
    WHERE DeletedAt IS NULL
    ORDER BY UpdatedAt DESC NULLS LAST
  `);

  for (const r of rows) {
    const link = (r.link || r.Link || '').slice(0, 50);
    console.log(
      `#${r.id || r.Id} | ${(r.nome || r.Nome || '').slice(0, 35).padEnd(35)} | ` +
      `atual=${r.precoatual ?? r.PrecoAtual} alvo=${r.precoalvo ?? r.PrecoAlvo} | ` +
      `upd=${r.updatedat || r.UpdatedAt} | ${link}`
    );
  }
  console.log('Total:', rows.length);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
