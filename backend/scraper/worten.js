import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { formatPrice, cleanText } from "../utils/format.js";

/**
 * 🛒 Scraper específico para Worten
 * https://www.worten.pt/
 */
export default async function scrapeWorten(url) {
  try {
    console.log("🔍 Scraping Worten:", url);
    
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

    // Múltiplos seletores para preço na Worten
    const priceSelectors = [
      'span.w-product-price',
      'span[data-testid="price-final"]',
      '.w-product-price-current',
      '.price-current',
      '[data-testid="price"]',
      '.product-price-current',
      '.current-price'
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
      '.w-product-title',
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
      console.log("⚠️ Não encontrou preço na Worten");
      return null;
    }

    // Usar utilitário de formatação
    const precoNum = formatPrice(preco);
    
    if (!precoNum) {
      console.log("⚠️ Preço inválido na Worten:", preco);
      return null;
    }

    console.log("✅ Preço Worten:", precoNum, "€");
    console.log("📦 Produto:", cleanText(nome) || "Nome não encontrado");

    return {
      success: true,
      price: precoNum,
      title: cleanText(nome) || "Produto Worten",
      method: "worten-specific"
    };

  } catch (err) {
    console.error("❌ Erro scraper Worten:", err.message);
    return null;
  }
}
