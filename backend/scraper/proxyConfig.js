/**
 * ⚙️ Configuração de Proxies
 * Adicione seus proxies aqui
 */

// 🔧 CONFIGURAÇÃO DE PROXIES
// Substitua pelos seus proxies reais

export const PROXY_CONFIG = {
  // Proxies gratuitos (menos confiáveis, mas funcionam)
  free: [
    // Exemplo de proxies gratuitos - SUBSTITUA pelos reais
    // "http://proxy1.example.com:8080",
    // "http://proxy2.example.com:3128",
  ],
  
  // Proxies premium (mais confiáveis)
  premium: [
    // Adicione seus proxies premium aqui
    // "http://username:password@proxy-premium.com:8080",
  ],
  
  // Proxies residenciais (melhor para anti-detecção)
  residential: [
    // Proxies residenciais são os melhores para evitar bloqueios
    // "http://username:password@residential-proxy.com:8080",
  ]
};

/**
 * 🌍 Proxies por região
 */
export const PROXIES_BY_REGION = {
  pt: [
    // Proxies portugueses
  ],
  es: [
    // Proxies espanhóis
  ],
  fr: [
    // Proxies franceses
  ],
  de: [
    // Proxies alemães
  ]
};

/**
 * 📊 Configurações de rotação
 */
export const ROTATION_CONFIG = {
  // Intervalo entre mudanças de proxy (em ms)
  rotationInterval: 5 * 60 * 1000, // 5 minutos
  
  // Número máximo de tentativas por proxy
  maxAttemptsPerProxy: 3,
  
  // Delay entre requests (em ms)
  requestDelay: {
    min: 1000,
    max: 3000
  }
};

/**
 * 🛡️ Configurações de anti-detecção
 */
export const STEALTH_CONFIG = {
  // User-Agents por região
  userAgents: {
    pt: [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0"
    ],
    en: [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
    ]
  },
  
  // Headers por região
  headers: {
    pt: {
      "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1"
    },
    en: {
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1"
    }
  }
};

/**
 * 🎯 Configurações específicas por loja
 */
export const STORE_CONFIG = {
  worten: {
    selectors: {
      price: [
        "span.w-product-price",
        "span[data-testid='price-final']",
        ".price-current",
        ".product-price"
      ],
      title: [
        "h1.product-name",
        ".w-product-title",
        "h1"
      ]
    },
    region: "pt",
    stealthLevel: "high"
  },
  
  fnac: {
    selectors: {
      price: [
        "span.f-priceBox-price",
        ".userPrice",
        ".price-current"
      ],
      title: [
        "h1",
        ".f-productHeader-Title",
        ".product-title"
      ]
    },
    region: "pt",
    stealthLevel: "medium"
  },
  
  amazon: {
    selectors: {
      price: [
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        ".a-price .a-offscreen",
        ".a-price-range"
      ],
      title: [
        "#productTitle",
        "h1"
      ]
    },
    region: "pt",
    stealthLevel: "high"
  }
};

/**
 * 📝 Instruções para configurar proxies
 */
export const SETUP_INSTRUCTIONS = `
🔧 COMO CONFIGURAR PROXIES:

1. PROXIES GRATUITOS:
   - Acesse: https://free-proxy-list.net/
   - Copie proxies HTTP funcionais
   - Adicione em PROXY_CONFIG.free

2. PROXIES PREMIUM:
   - Contrate serviços como: Bright Data, Oxylabs, Smartproxy
   - Adicione credenciais em PROXY_CONFIG.premium

3. PROXIES RESIDENCIAIS:
   - Melhor opção para evitar bloqueios
   - Mais caros, mas muito eficazes
   - Adicione em PROXY_CONFIG.residential

4. TESTE SEUS PROXIES:
   - Use: node test-proxies.js
   - Verifique se estão funcionando

5. CONFIGURAÇÃO AUTOMÁTICA:
   - O sistema tentará proxies em ordem
   - Fallback automático se proxy falhar
   - Rotação automática para evitar bloqueios
`;
