/**
 * 🛡️ Níveis de Stealth para Diferentes Situações
 * Configurações otimizadas para cada tipo de proteção
 */

/**
 * 🟢 Nível BÁSICO - Para sites com pouca proteção
 */
export const BASIC_STEALTH = {
  name: "Básico",
  description: "Para sites com pouca proteção anti-bot",
  config: {
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ],
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    headers: {
      "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    delays: {
      min: 500,
      max: 1500
    },
    retries: 2
  }
};

/**
 * 🟡 Nível MÉDIO - Para sites com proteção moderada
 */
export const MEDIUM_STEALTH = {
  name: "Médio",
  description: "Para sites com proteção anti-bot moderada",
  config: {
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
      "--disable-renderer-backgrounding"
    ],
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    headers: {
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
    delays: {
      min: 1000,
      max: 3000
    },
    retries: 3,
    humanBehavior: true
  }
};

/**
 * 🔴 Nível ALTO - Para sites com alta proteção
 */
export const HIGH_STEALTH = {
  name: "Alto",
  description: "Para sites com alta proteção anti-bot",
  config: {
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
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    headers: {
      "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0"
    },
    delays: {
      min: 2000,
      max: 5000
    },
    retries: 5,
    humanBehavior: true,
    proxyRotation: true,
    stealthPlugins: true
  }
};

/**
 * 🚀 Nível EXTREMO - Para sites com proteção máxima
 */
export const EXTREME_STEALTH = {
  name: "Extremo",
  description: "Para sites com proteção anti-bot extrema",
  config: {
    headless: false, // Navegador visível para máxima stealth
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
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-default-browser-check",
      "--no-pings",
      "--password-store=basic",
      "--use-mock-keychain",
      "--disable-blink-features=AutomationControlled",
      "--exclude-switches=enable-automation",
      "--disable-automation"
    ],
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    headers: {
      "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
      "Pragma": "no-cache"
    },
    delays: {
      min: 3000,
      max: 8000
    },
    retries: 7,
    humanBehavior: true,
    proxyRotation: true,
    stealthPlugins: true,
    viewportRotation: true,
    mouseMovements: true,
    keyboardSimulation: true
  }
};

/**
 * 🎯 Seleciona nível de stealth baseado na loja
 */
export function getStealthLevel(storeName) {
  const storeLevels = {
    // Lojas com alta proteção
    'worten': 'high',
    'fnac': 'medium',
    'amazon': 'high',
    'ikea': 'medium',
    'zara': 'high',
    'hm': 'medium',
    
    // Lojas com proteção moderada
    'pcdiga': 'medium',
    'globaldata': 'medium',
    'radiopopular': 'medium',
    'mediamarkt': 'medium',
    'leroymerlin': 'medium',
    
    // Lojas com pouca proteção
    'generic': 'basic'
  };
  
  return storeLevels[storeName] || 'medium';
}

/**
 * 🛡️ Obtém configuração de stealth
 */
export function getStealthConfig(level) {
  const configs = {
    'basic': BASIC_STEALTH,
    'medium': MEDIUM_STEALTH,
    'high': HIGH_STEALTH,
    'extreme': EXTREME_STEALTH
  };
  
  return configs[level] || MEDIUM_STEALTH;
}

/**
 * 📊 Estatísticas de stealth por loja
 */
export const STEALTH_STATS = {
  worten: {
    attempts: 0,
    successes: 0,
    failures: 0,
    bestLevel: 'high',
    avgTime: 0
  },
  fnac: {
    attempts: 0,
    successes: 0,
    failures: 0,
    bestLevel: 'medium',
    avgTime: 0
  },
  amazon: {
    attempts: 0,
    successes: 0,
    failures: 0,
    bestLevel: 'high',
    avgTime: 0
  }
};

/**
 * 📈 Atualiza estatísticas de stealth
 */
export function updateStealthStats(store, level, success, time) {
  if (!STEALTH_STATS[store]) {
    STEALTH_STATS[store] = {
      attempts: 0,
      successes: 0,
      failures: 0,
      bestLevel: level,
      avgTime: 0
    };
  }
  
  const stats = STEALTH_STATS[store];
  stats.attempts++;
  
  if (success) {
    stats.successes++;
    if (level === 'extreme' || level === 'high') {
      stats.bestLevel = level;
    }
  } else {
    stats.failures++;
  }
  
  stats.avgTime = (stats.avgTime + time) / 2;
}

/**
 * 🎯 Recomenda nível de stealth
 */
export function recommendStealthLevel(store, recentFailures = 0) {
  if (recentFailures > 3) {
    return 'extreme';
  } else if (recentFailures > 1) {
    return 'high';
  } else {
    return getStealthLevel(store);
  }
}
