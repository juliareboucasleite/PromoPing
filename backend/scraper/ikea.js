import fetch from "node-fetch";
import * as cheerio from "cheerio";

/**
 * 🛒 Scraper específico para IKEA
 * https://www.ikea.pt/
 */
export default async function scrapeIkea(url) {
  try {
    console.log("🔍 Scraping IKEA:", url);
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const html = await res.text();
    const $ = cheerio.load(html);

    // Múltiplos seletores para preço na IKEA
    const priceSelectors = [
      '.pip-price__integer',
      '.pip-price',
      '.price-current',
      '.product-price-current',
      '[data-testid="price"]',
      '.range-revamp-price__integer',
      '.range-revamp-price'
    ];

    let preco = null;
    let nome = null;

    // Tentar encontrar preço
    for (const selector of priceSelectors) {
      const priceText = $(selector).first().text().trim();
      if (priceText && priceText !== '') {
        preco = priceText;
        break;
      }
    }

    // Tentar encontrar nome do produto
    const nameSelectors = [
      'h1.pip-header-section__title',
      '.product-title',
      'h1[data-testid="product-title"]',
      '.pip-header-section__title',
      'h1',
      '.range-revamp-header-section__title'
    ];

    for (const selector of nameSelectors) {
      const nameText = $(selector).first().text().trim();
      if (nameText && nameText !== '') {
        nome = nameText;
        break;
      }
    }

    if (!preco) {
      console.log("⚠️ Não encontrou preço na IKEA");
      return null;
    }

    // Limpar e converter preço
    preco = preco.replace(/[^\d,.-]/g, "").replace(",", ".");
    const precoNum = parseFloat(preco);
    
    if (isNaN(precoNum)) {
      console.log("⚠️ Preço inválido na IKEA:", preco);
      return null;
    }

    console.log("✅ Preço IKEA:", precoNum, "€");
    console.log("📦 Produto:", nome || "Nome não encontrado");

    return {
      loja: "IKEA",
      nome: nome || "Produto IKEA",
      preco: precoNum,
      url: url,
      timestamp: new Date().toISOString()
    };

  } catch (err) {
    console.error("❌ Erro scraper IKEA:", err.message);
    return null;
  }
}
