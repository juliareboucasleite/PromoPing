// @ts-nocheck
import puppeteer from 'puppeteer';

function normalizePrice(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/[\s\u00A0]/g, ' ')
    .replace(/[^0-9,.-]/g, '')
    // remover separador de milhar . quando seguido de 3 dígitos
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    // lidar com 1 299,99
    .replace(',', '.');
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

export function detectStore(urlString) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    if (host.includes('ikea')) return { slug: 'ikea', name: 'IKEA' };
    if (host.includes('worten')) return { slug: 'worten', name: 'Worten' };
    if (host.includes('fnac')) return { slug: 'fnac', name: 'FNAC' };
    if (host.includes('continente')) return { slug: 'continente', name: 'Continente' };
    if (host.includes('pingodoce')) return { slug: 'pingo-doce', name: 'Pingo Doce' };
    if (host.includes('lidl')) return { slug: 'lidl', name: 'Lidl' };
    if (host.includes('aldi')) return { slug: 'aldi', name: 'Aldi' };
    if (host.includes('leroymerlin')) return { slug: 'leroy-merlin', name: 'Leroy Merlin' };
    return { slug: 'desconhecida', name: 'Desconhecida' };
  } catch {
    return { slug: 'desconhecida', name: 'Desconhecida' };
  }
}

async function getTextBySelectors(page, selectors) {
  for (const sel of selectors) {
    const text = await page.$eval(sel, el => el.textContent || el.getAttribute('content') || '').catch(() => null);
    if (text && text.trim()) return text;
  }
  return null;
}

async function scrapeWithSelectors(page, selectors) {
  const titleSel = Array.isArray(selectors.title) ? selectors.title : [selectors.title];
  const priceSel = Array.isArray(selectors.price) ? selectors.price : [selectors.price];
  const nameText = await getTextBySelectors(page, titleSel);
  const name = (nameText && nameText.trim()) || 'Produto Adicionado via URL';
  const priceText = await getTextBySelectors(page, priceSel);
  const price = normalizePrice(priceText);
  return { name, price };
}

async function extractFromJsonLd(page) {
  const jsonList = await page.$$eval('script[type="application/ld+json"]', els => els.map(e => e.textContent || ''));
  for (const json of jsonList) {
    try {
      const data = JSON.parse(json);
      const offers = Array.isArray(data) ? data.find(x => x.offers) : data.offers;
      const price = offers?.price || offers?.priceSpecification?.price;
      if (price) return normalizePrice(String(price));
    } catch {}
  }
  return null;
}

async function extractPriceRobust(page) {
  // tentar via meta
  const metaPrice = await page.$eval('meta[itemprop="price"], meta[property="product:price:amount"]', el => el.getAttribute('content')).catch(() => null);
  if (metaPrice) {
    const p = normalizePrice(metaPrice);
    if (p != null) return p;
  }
  // tentar JSON-LD
  const jsonPrice = await extractFromJsonLd(page);
  if (jsonPrice != null) return jsonPrice;
  // fallback: procurar por padrões € 1.299,99
  const text = await page.evaluate(() => document.body.innerText);
  const match = text.match(/€\s*([0-9]{1,3}(?:[\.\s][0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/);
  if (match) return normalizePrice(match[0]);
  return null;
}

const STORE_SELECTORS = {
  ikea: {
    title: ['h1[data-testid="product-name"]','h1'],
    price: ['[data-testid="pip-price"] .pip-price__integer','.pip-temp-price-module__integer','.pip-price']
  },
  worten: {
    title: ['h1[itemprop="name"]','h1.product-name','h1'],
    price: [
      '.w-product__price .is-current',
      '[data-qa="product-price"]',
      '[itemprop="price"]',
      'meta[itemprop="price"]',
      'meta[property="product:price:amount"]'
    ]
  },
  fnac: {
    title: ['h1.fnac-product-title','h1[data-testid="product-title"]','h1'],
    price: [
      '.f-priceBox-price',
      '.f-productPrice',
      '[data-test="price-current"]',
      '[itemprop="price"]',
      'meta[itemprop="price"]',
      'meta[property="product:price:amount"]'
    ]
  },
  continente: { title: ['h1.pdp-title','h1'], price: ['.price','.ct-price','[data-testid="pdp-sales-price"]'] },
  'pingo-doce': { title: ['h1','.product-name'], price: ['.price','.product-price'] },
  lidl: { title: ['h1','.product__title'], price: ['.m-price__price','.pricebox__price'] },
  aldi: { title: ['h1','.product-title'], price: ['.price','.product-price'] },
  'leroy-merlin': { title: ['h1','.product-name'], price: ['[data-testid="final-price"]','.price','.product-price'] }
};

export async function scrapeProductInfo(urlString) {
  const store = detectStore(urlString);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36');
    await page.goto(urlString, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForTimeout(1200);

    const selectors = STORE_SELECTORS[store.slug];
    if (selectors) {
      const { name, price } = await scrapeWithSelectors(page, selectors);
      if (price != null) return { nome: name, preco: price, loja: store.name };
      const robust = await extractPriceRobust(page);
      return { nome: name, preco: robust, loja: store.name };
    }

    // Generic fallback
    const title = await page.title();
    const priceText = await page.$eval('.price, .sales-price, .product-price, [data-testid="price"]', el => el.textContent || '').catch(() => null);
    let preco = normalizePrice(priceText);
    if (preco == null) preco = await extractPriceRobust(page);
    return { nome: title || 'Produto Adicionado via URL', preco, loja: store.name };
  } finally {
    await browser.close();
  }
}


