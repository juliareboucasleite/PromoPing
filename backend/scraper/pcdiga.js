import fetch from "node-fetch";
import * as cheerio from "cheerio";

/**
 * 🛒 Scraper específico para PCDiga
 * https://www.pcdiga.com/
 */
export default async function scrapePcDiga(url) {
  try {
    console.log("🔍 Scraping PCDiga:", url);
    
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

    // Múltiplos seletores para preço na PCDiga
    const priceSelectors = [
      '.price-current',
      '.product-price-current',
      '[data-testid="price"]',
      '.price',
      '.current-price',
      '.product-price'
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
      'h1.product-title',
      '.product-name',
      'h1[data-testid="product-title"]',
      '.product-header h1',
      'h1'
    ];

    for (const selector of nameSelectors) {
      const nameText = $(selector).first().text().trim();
      if (nameText && nameText !== '') {
        nome = nameText;
        break;
      }
    }

    if (!preco) {
      console.log("⚠️ Não encontrou preço na PCDiga");
      return null;
    }

    // Limpar e converter preço
    preco = preco.replace(/[^\d,.-]/g, "").replace(",", ".");
    const precoNum = parseFloat(preco);
    
    if (isNaN(precoNum)) {
      console.log("⚠️ Preço inválido na PCDiga:", preco);
      return null;
    }

    console.log("✅ Preço PCDiga:", precoNum, "€");
    console.log("📦 Produto:", nome || "Nome não encontrado");

    return {
      loja: "PCDiga",
      nome: nome || "Produto PCDiga",
      preco: precoNum,
      url: url,
      timestamp: new Date().toISOString()
    };

  } catch (err) {
    console.error("❌ Erro scraper PCDiga:", err.message);
    return null;
  }
}
