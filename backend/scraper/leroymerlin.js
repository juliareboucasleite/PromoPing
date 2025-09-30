import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { formatPrice, cleanText } from "../utils/format.js";

/**
 * 🛒 Scraper específico para Leroy Merlin
 * https://www.leroymerlin.pt/
 */
export default async function scrapeLeroyMerlin(url) {
  try {
    console.log("🔍 Scraping Leroy Merlin:", url);
    
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

    // Seletores específicos para Leroy Merlin
    const priceSelectors = [
      '.price-current',
      '.product-price-current',
      '[data-testid="price"]',
      '.price',
      '.current-price',
      '.product-price',
      '.lm-price',
      '.price-box .price',
      '.product-price-box .price',
      '.price-value'
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
      'h1',
      '.lm-product-title'
    ];

    for (const selector of nameSelectors) {
      const nameText = $(selector).first().text().trim();
      if (nameText && nameText !== '') {
        nome = nameText;
        break;
      }
    }

    if (!preco) {
      console.log("⚠️ Não encontrou preço na Leroy Merlin");
      return null;
    }

    // Usar utilitário de formatação
    const precoNum = formatPrice(preco);
    
    if (!precoNum) {
      console.log("⚠️ Preço inválido na Leroy Merlin:", preco);
      return null;
    }

    console.log("✅ Preço Leroy Merlin:", precoNum, "€");
    console.log("📦 Produto:", cleanText(nome) || "Nome não encontrado");

    return {
      loja: "Leroy Merlin",
      nome: cleanText(nome) || "Produto Leroy Merlin",
      preco: precoNum,
      url: url,
      timestamp: new Date().toISOString()
    };

  } catch (err) {
    console.error("❌ Erro scraper Leroy Merlin:", err.message);
    return null;
  }
}
