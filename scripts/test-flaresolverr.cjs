#!/usr/bin/env node
const URL = process.argv[2] ||
  'https://www.worten.pt/produtos/portatil-gaming-lenovo-loq-15irx10-intel-core-i7-13650hx-nvidia-geforce-rtx-5060-ram-32-gb-1-tb-ssd-15-6-8629579';

(async () => {
  const res = await fetch('http://localhost:8191/v1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'request.get', url: URL, maxTimeout: 80000 }),
    signal: AbortSignal.timeout(95000),
  });
  const data = await res.json();
  console.log('status:', data.status);
  console.log('message:', data.message);
  const html = (data.solution && data.solution.response) || '';
  console.log('html len:', html.length);
  console.log('final url:', data.solution && data.solution.url);

  const tests = [
    [/itemprop=["']price["'][^>]*content=["']?[0-9.,]+/i, 'meta itemprop=price'],
    [/property=["']product:price:amount["'][^>]*content=["']?[0-9.,]+/i, 'meta og price'],
    [/"price"\s*:\s*"?[0-9.,]+/i, 'json "price"'],
    [/"lowPrice"\s*:\s*"?[0-9.,]+/i, 'json lowPrice'],
    [/<span[^>]*class=["'][^"']*value[^"']*["'][^>]*>[^<]*/i, 'span value'],
    [/\d{2,4}[,.]\d{2}\s*€/i, 'number+euro'],
  ];
  for (const [re, label] of tests) {
    const m = html.match(re);
    if (m) console.log('FOUND', label, '->', m[0].replace(/\s+/g, ' ').slice(0, 120));
  }
  require('fs').writeFileSync('/tmp/fs_worten.html', html);
  console.log('saved /tmp/fs_worten.html');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
