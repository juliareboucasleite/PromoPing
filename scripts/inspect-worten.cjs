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

  const [rows] = await p.query(
    "SELECT Id, Link FROM produtos WHERE Link ILIKE '%worten%' AND DeletedAt IS NULL"
  );

  for (const r of rows) {
    const url = r.link || r.Link;
    console.log('\n=== Produto #' + (r.id || r.Id) + ' ===');
    console.log(url);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(20000),
      });
      console.log('HTTP', res.status, 'len', res.headers.get('content-length') || '?');
      const html = await res.text();

      const grab = (re, label) => {
        const matches = [...html.matchAll(re)].slice(0, 4).map((x) => x[0].slice(0, 160));
        if (matches.length) {
          console.log('--', label);
          matches.forEach((mm) => console.log('   ', mm.replace(/\s+/g, ' ')));
        }
      };

      grab(/<meta[^>]*itemprop=["']price["'][^>]*>/gi, 'meta itemprop=price');
      grab(/<meta[^>]*product:price:amount[^>]*>/gi, 'meta product:price:amount');
      grab(/"price"\s*:\s*"?[0-9.,]+/gi, 'json "price"');
      grab(/"priceValue"\s*:\s*"?[0-9.,]+/gi, 'json priceValue');
      grab(/class=["'][^"']*price[^"']*["']/gi, 'class*=price');
      grab(/data-[a-z-]*price[a-z-]*=["'][^"']+["']/gi, 'data-*price*');
    } catch (e) {
      console.log('ERRO fetch:', e.message);
    }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
