/**
 * 🛡️ Sistema Simplificado de Anti-Detecção
 * Versão estável sem plugins problemáticos
 */

import puppeteer from "puppeteer";

/**
 * 🎲 Gera delay aleatório para simular comportamento humano
 */
export function getRandomDelay(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 🎭 Seleciona User-Agent aleatório
 */
export function getRandomUserAgent() {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * 🛡️ Configuração simplificada do Puppeteer
 */
export async function createSimpleStealthBrowser(options = {}) {
  const defaultOptions = {
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--disable-gpu",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
      "--disable-extensions",
      "--disable-plugins",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-default-browser-check",
      "--no-pings",
      "--password-store=basic",
      "--use-mock-keychain"
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    ignoreHTTPSErrors: true,
    ...options
  };

  return await puppeteer.launch(defaultOptions);
}

/**
 * 🎯 Configura página com anti-detecção simplificada
 */
export async function setupSimpleStealthPage(browser, region = 'pt') {
  const page = await browser.newPage();
  
  // Configurar viewport
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Configurar User-Agent aleatório
  const userAgent = getRandomUserAgent();
  await page.setUserAgent(userAgent);
  
  // Configurar headers regionais
  const headers = {
    "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1"
  };
  await page.setExtraHTTPHeaders(headers);
  
  // Remover propriedades que indicam automação
  await page.evaluateOnNewDocument(() => {
    // Remover webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Remover plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    
    // Remover languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['pt-PT', 'pt', 'en'],
    });
  });
  
  return page;
}

/**
 * 🚶 Simula comportamento humano na página
 */
export async function simulateHumanBehavior(page) {
  // Scroll aleatório
  await page.evaluate(() => {
    window.scrollTo(0, Math.random() * 500);
  });
  
  // Delay aleatório
  await new Promise(resolve => setTimeout(resolve, getRandomDelay(500, 1500)));
  
  // Movimento do mouse aleatório
  await page.mouse.move(
    Math.random() * 800 + 100,
    Math.random() * 600 + 100
  );
  
  // Delay antes de continuar
  await new Promise(resolve => setTimeout(resolve, getRandomDelay(200, 800)));
}

/**
 * 🎭 Scraper com anti-detecção simplificada
 */
export async function scrapeWithSimpleStealth(url, selectors = {}, options = {}) {
  let browser;
  try {
    console.log(`🛡️ Scraping simplificado com anti-detecção: ${url}`);
    
    browser = await createSimpleStealthBrowser(options.browser);
    const page = await setupSimpleStealthPage(browser, options.region || 'pt');
    
    // Bloquear recursos desnecessários
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'media', 'font', 'texttrack', 'object', 'beacon', 'csp_report', 'imageset'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Navegar com retry
    let retries = 3;
    while (retries > 0) {
      try {
        await page.goto(url, { 
          waitUntil: "domcontentloaded", 
          timeout: 60000 
        });
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        console.log(`🔄 Tentativa falhou, aguardando... (${retries} restantes)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Simular comportamento humano
    await simulateHumanBehavior(page);
    
    // Aguardar elementos carregarem
    if (selectors.price && selectors.price.length > 0) {
      try {
        await page.waitForSelector(selectors.price[0], { timeout: 10000 });
      } catch (e) {
        console.log("⚠️ Timeout aguardando seletor de preço");
      }
    }
    
    // Extrair dados
    const data = await page.evaluate((sel) => {
      let price = null;
      let title = null;
      
      // Tentar encontrar preço
      if (sel.price && sel.price.length > 0) {
        for (let selector of sel.price) {
          const element = document.querySelector(selector);
          if (element) {
            price = element.innerText.trim();
            break;
          }
        }
      }
      
      // Tentar encontrar título
      if (sel.title && sel.title.length > 0) {
        for (let selector of sel.title) {
          const element = document.querySelector(selector);
          if (element) {
            title = element.innerText.trim();
            break;
          }
        }
      }
      
      return { price, title };
    }, selectors);
    
    return {
      success: !!data.price,
      price: data.price ? data.price.replace(/[^\d,.-]/g, "").replace(",", ".") : null,
      title: data.title || "Produto sem título",
      method: "simple-stealth"
    };
    
  } catch (err) {
    console.error("❌ Erro no scraper simplificado:", err.message);
    return { success: false, price: null, title: null, method: "simple-stealth" };
  } finally {
    if (browser) await browser.close();
  }
}
