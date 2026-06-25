#!/usr/bin/env node
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || '/tmp/fs_worten.html', 'utf8');

// 1) JSON-LD blocks
const ldRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
let m;
let found = [];
while ((m = ldRe.exec(html)) !== null) {
  try {
    const json = JSON.parse(m[1].trim());
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if (o.price || (o.offers && (o.offers.price || (Array.isArray(o.offers) && o.offers[0])))) {
        const t = o['@type'];
        const price = o.price || (o.offers && o.offers.price) || (Array.isArray(o.offers) && o.offers[0] && o.offers[0].price);
        if (price) found.push(`ld@type=${t} price=${price} cur=${(o.offers && o.offers.priceCurrency) || o.priceCurrency || ''}`);
      }
      for (const k in o) walk(o[k]);
    };
    walk(json);
  } catch (e) { /* ignore */ }
}
console.log('JSON-LD prices:', found.length ? found : 'none');

// 2) regex json price
const j = html.match(/"price"\s*:\s*"?([0-9]+(?:\.[0-9]{1,2})?)"?/i);
console.log('regex json price:', j && j[1]);

// 3) meta itemprop=price content
const meta = html.match(/itemprop=["']price["'][^>]*content=["']([0-9.,]+)["']/i)
  || html.match(/content=["']([0-9.,]+)["'][^>]*itemprop=["']price["']/i);
console.log('meta content price:', meta && meta[1]);

// 4) itemprop=price element text (next chars)
const el = html.match(/itemprop=["']price["'][^>]*>([^<]{1,20})/i);
console.log('itemprop text:', el && el[1].trim());
