import fetch from "node-fetch";
import * as cheerio from "cheerio";

/**
 * 🛒 Scraper específico para Amazon
 * https://www.amazon.pt/
 */
export default async function scrapeAmazon(url) {
  try {
    console.log("🔍 Scraping Amazon:", url);
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const html = await res.text();
    const $ = cheerio.load(html);

    // Múltiplos seletores para preço na Amazon
    const priceSelectors = [
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '.a-price-whole',
      '.a-price .a-offscreen',
      '#apex_desktop .a-price-whole',
      '.a-price-range .a-price-whole',
      '.a-price .a-price-whole',
      '[data-asin] .a-price-whole',
      '.a-price-symbol + .a-price-whole'
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

    // Se não encontrou preço, tentar meta tags
    if (!preco) {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                       $('meta[name="twitter:data1"]').attr('content');
      if (metaPrice) {
        preco = metaPrice;
      }
    }

    // Tentar encontrar nome do produto
    const nameSelectors = [
      '#productTitle',
      '.product-title',
      'h1[data-automation-id="product-title"]',
      '.a-size-large',
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
      console.log("⚠️ Não encontrou preço na Amazon");
      return null;
    }

    // Limpar e converter preço
    preco = preco.replace(/[^\d,.-]/g, "").replace(",", ".");
    const precoNum = parseFloat(preco);
    
    if (isNaN(precoNum)) {
      console.log("⚠️ Preço inválido na Amazon:", preco);
      return null;
    }

    console.log("✅ Preço Amazon:", precoNum, "€");
    console.log("📦 Produto:", nome || "Nome não encontrado");

    return {
      success: true,
      price: precoNum,
      title: nome || "Produto Amazon",
      method: "amazon-specific"
    };

  } catch (err) {
    console.error("❌ Erro scraper Amazon:", err.message);
    return null;
  }
}
