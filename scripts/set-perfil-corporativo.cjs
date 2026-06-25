#!/usr/bin/env node
require('dotenv').config({ path: '/root/PromoPing/.env' });
const m = require('/root/PromoPing/backend/discord-bot/mysql2-compat');

const EMAIL = 'juliareboucasleite@gmail.com';
const PERFIL = 3;

(async () => {
  const p = m.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
  });

  const [before] = await p.query(
    'SELECT referenciaid, nome, email, perfilid FROM utilizadores WHERE LOWER(email) = LOWER(?)',
    [EMAIL]
  );
  if (!before.length) {
    console.error('Utilizador não encontrado:', EMAIL);
    process.exit(1);
  }
  console.log('Antes:', before[0]);

  await p.query('UPDATE utilizadores SET perfilid = ? WHERE LOWER(email) = LOWER(?)', [PERFIL, EMAIL]);

  const [after] = await p.query(
    'SELECT referenciaid, nome, email, perfilid FROM utilizadores WHERE LOWER(email) = LOWER(?)',
    [EMAIL]
  );
  console.log('Depois:', after[0]);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
