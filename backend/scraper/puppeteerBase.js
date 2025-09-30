import puppeteer from "puppeteer";

/**
 * 🖥️ Scraper base com Puppeteer para sites com JavaScript
 * Força renderização completa para capturar preços dinâmicos
 */
export async function scrapeWithPuppeteer(url, selectors = {}) {
  let browser;
  try {
    console.log(`🖥️ Forçando Puppeteer para: ${url}`);
    
    browser = await puppeteer.launch({ 
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu"
      ]
    });
    
    const page = await browser.newPage();

    // Headers realistas para evitar detecção
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1"
    });

    await page.goto(url, { 
      waitUntil: "domcontentloaded", 
      timeout: 60000 
    });

    // Aguarda um pouco para JavaScript carregar
    await page.waitForTimeout(2000);

    // Tenta pegar título
    let title = null;
    if (selectors.title && selectors.title.length > 0) {
      for (let sel of selectors.title) {
        try {
          title = await page.$eval(sel, (el) => el.innerText.trim());
          if (title) break;
        } catch {}
      }
    }

    // Tenta pegar preço
    let price = null;
    if (selectors.price && selectors.price.length > 0) {
      for (let sel of selectors.price) {
        try {
          price = await page.$eval(sel, (el) => el.innerText.trim());
          if (price) break;
        } catch {}
      }
    }

    // Se não encontrou com seletores específicos, tenta seletores genéricos
    if (!price) {
      const genericPriceSelectors = [
        "span[class*='price']",
        "span[class*='Price']",
        "div[class*='price']",
        ".price",
        "[data-testid*='price']",
        "meta[itemprop='price']",
        "meta[property='product:price:amount']"
      ];
      
      for (let sel of genericPriceSelectors) {
        try {
          price = await page.$eval(sel, (el) => el.innerText.trim() || el.getAttribute('content'));
          if (price) break;
        } catch {}
      }
    }

    return {
      success: !!price,
      price: price ? price.replace(/[^\d,.-]/g, "").replace(",", ".") : null,
      title: title || "Produto sem título",
      method: "puppeteer"
    };
  } catch (err) {
    console.error("❌ Erro no Puppeteer pesado:", err.message);
    return { success: false, price: null, title: null, method: "puppeteer" };
  } finally {
    if (browser) await browser.close();
  }
}
