import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import UserDataDirPlugin from "puppeteer-extra-plugin-user-data-dir";

// Configurar plugins de stealth
puppeteer.use(StealthPlugin());
puppeteer.use(UserDataDirPlugin());

/**
 * 🛡️ Sistema Avançado de Anti-Detecção
 * Combina múltiplas técnicas para contornar proteções anti-bot
 */

// User-Agents realistas
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
];

// Viewports realistas
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1280, height: 720 }
];

// Headers realistas por região
const HEADERS_BY_REGION = {
  pt: {
    "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1"
  },
  en: {
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
  }
};

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
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * 📱 Seleciona viewport aleatório
 */
export function getRandomViewport() {
  return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

/**
 * 🌍 Seleciona headers por região
 */
export function getHeadersByRegion(region = 'pt') {
  return HEADERS_BY_REGION[region] || HEADERS_BY_REGION.pt;
}

/**
 * 🛡️ Configuração avançada do Puppeteer com anti-detecção
 */
export async function createStealthBrowser(options = {}) {
  const defaultOptions = {
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
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
      "--disable-images",
      "--disable-javascript",
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
 * 🎯 Configura página com anti-detecção avançada
 */
export async function setupStealthPage(browser, region = 'pt') {
  const page = await browser.newPage();
  
  // Configurar viewport aleatório
  const viewport = getRandomViewport();
  await page.setViewport(viewport);
  
  // Configurar User-Agent aleatório
  const userAgent = getRandomUserAgent();
  await page.setUserAgent(userAgent);
  
  // Configurar headers regionais
  const headers = getHeadersByRegion(region);
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
    
    // Remover permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
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
 * 🔄 Sistema de retry com backoff exponencial
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`🔄 Tentativa ${attempt} falhou, aguardando ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * 🎭 Scraper com anti-detecção completa
 */
export async function scrapeWithStealth(url, selectors = {}, options = {}) {
  let browser;
  try {
    console.log(`🛡️ Scraping com anti-detecção: ${url}`);
    
    browser = await createStealthBrowser(options.browser);
    const page = await setupStealthPage(browser, options.region || 'pt');
    
    // Navegar com retry
    await retryWithBackoff(async () => {
      await page.goto(url, { 
        waitUntil: "domcontentloaded", 
        timeout: 60000 
      });
    }, 3, 2000);
    
    // Simular comportamento humano
    await simulateHumanBehavior(page);
    
  // Bloquear recursos desnecessários para melhor performance
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (['image', 'media', 'font', 'texttrack', 'object', 'beacon', 'csp_report', 'imageset'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });

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
      method: "stealth"
    };
    
  } catch (err) {
    console.error("❌ Erro no scraper stealth:", err.message);
    return { success: false, price: null, title: null, method: "stealth" };
  } finally {
    if (browser) await browser.close();
  }
}
