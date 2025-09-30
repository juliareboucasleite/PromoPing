import axios from "axios";
import * as cheerio from "cheerio";
import { formatPrice, cleanText } from "../utils/format.js";

/**
 * 🛒 Scraper genérico para lojas não suportadas
 * Tenta encontrar preço usando seletores comuns
 */
export default async function scrapeGeneric(url, storeName = "Loja") {
  try {
    console.log(`🌐 Scraper Genérico tentando capturar dados de: ${url}`);
    
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
      },
      timeout: 30000
    });
    
    const $ = cheerio.load(data);

    // 🔎 Possíveis seletores de preço
    const priceSelectors = [
      "span.price",
      "span[class*='Price']",
      "span[data-testid*='price']",
      ".a-price .a-offscreen",
      "meta[itemprop='price']",
      "meta[property='product:price:amount']",
      ".pip-price__integer",
      ".range-revamp-price",
      ".price-current",
      ".product-price-current",
      ".price",
      ".current-price",
      ".product-price",
      "[data-testid='price']",
      ".price-box .price",
      ".product-price-box .price",
      ".price-container .price",
      ".price-value",
      ".price-amount",
      ".money-amount",
      ".cost",
      ".value",
      "#price",
      "#product-price",
      "#current-price",
      "[class*='price']",
      "[class*='cost']",
      "[class*='value']"
    ];

    // 🔎 Possíveis seletores de título
    const titleSelectors = [
      "h1",
      "meta[property='og:title']",
      "meta[name='title']",
      "title",
      ".product-title",
      ".product-name",
      "h1[data-testid='product-title']",
      ".product-header h1",
      "[class*='title']",
      "[class*='name']"
    ];

    let price = null;
    for (let sel of priceSelectors) {
      let val =
        $(sel).first().text().trim() ||
        $(sel).attr("content") ||
        $(sel).attr("value");

      if (val) {
        price = val.replace(/[^\d,.-]/g, ""); // remove símbolos
        break;
      }
    }

    let title = null;
    for (let sel of titleSelectors) {
      let val =
        $(sel).first().text().trim() ||
        $(sel).attr("content") ||
        $(sel).attr("value");

      if (val) {
        title = val;
        break;
      }
    }

    if (!price && !title) {
      console.warn("⚠️ Genérico não encontrou preço nem título");
      return { success: false, price: null, title: null };
    }

    return {
      success: true,
      price: price ? formatPrice(price) : null,
      title: cleanText(title) || "Produto sem título",
      method: "generic"
    };

  } catch (err) {
    console.error(`❌ Erro scraper genérico ${storeName}:`, err.message);
    return null;
  }
}
