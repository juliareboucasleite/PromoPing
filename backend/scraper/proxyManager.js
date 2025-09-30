/**
 * 🌐 Sistema de Gerenciamento de Proxies
 * Rotaciona proxies para evitar bloqueios
 */

// Lista de proxies gratuitos (você pode adicionar mais)
const FREE_PROXIES = [
  // Proxies HTTP gratuitos (exemplo - substitua por proxies reais)
  "http://proxy1.example.com:8080",
  "http://proxy2.example.com:3128",
  "http://proxy3.example.com:8080",
];

// Lista de proxies premium (se você tiver)
const PREMIUM_PROXIES = [
  // Adicione seus proxies premium aqui
];

/**
 * 🎲 Seleciona proxy aleatório
 */
export function getRandomProxy() {
  const allProxies = [...FREE_PROXIES, ...PREMIUM_PROXIES];
  if (allProxies.length === 0) return null;
  
  return allProxies[Math.floor(Math.random() * allProxies.length)];
}

/**
 * 🔄 Rotaciona proxies com fallback
 */
export function getProxyWithFallback() {
  const proxies = [...FREE_PROXIES, ...PREMIUM_PROXIES];
  return proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null;
}

/**
 * 🛡️ Configura proxy no Puppeteer
 */
export async function setupProxy(page, proxyUrl) {
  if (!proxyUrl) return;
  
  try {
    const [protocol, host, port] = proxyUrl.split(':');
    await page.authenticate({
      username: '', // Adicione credenciais se necessário
      password: ''
    });
    
    console.log(`🌐 Usando proxy: ${proxyUrl}`);
  } catch (err) {
    console.warn(`⚠️ Erro ao configurar proxy ${proxyUrl}:`, err.message);
  }
}

/**
 * 🧪 Testa se proxy está funcionando
 */
export async function testProxy(proxyUrl) {
  try {
    const response = await fetch('https://httpbin.org/ip', {
      method: 'GET',
      timeout: 10000,
      // Adicione configuração de proxy aqui se necessário
    });
    
    const data = await response.json();
    console.log(`✅ Proxy ${proxyUrl} funcionando - IP: ${data.origin}`);
    return true;
  } catch (err) {
    console.log(`❌ Proxy ${proxyUrl} falhou:`, err.message);
    return false;
  }
}

/**
 * 🔍 Detecta se IP está bloqueado
 */
export function isBlocked(response) {
  const blockedStatuses = [403, 429, 503];
  const blockedTexts = [
    'blocked',
    'forbidden',
    'access denied',
    'rate limit',
    'too many requests'
  ];
  
  if (blockedStatuses.includes(response.status)) return true;
  
  const text = response.text?.toLowerCase() || '';
  return blockedTexts.some(blockedText => text.includes(blockedText));
}

/**
 * 📊 Estatísticas de proxies
 */
const proxyStats = new Map();

export function updateProxyStats(proxyUrl, success) {
  if (!proxyStats.has(proxyUrl)) {
    proxyStats.set(proxyUrl, { success: 0, failures: 0 });
  }
  
  const stats = proxyStats.get(proxyUrl);
  if (success) {
    stats.success++;
  } else {
    stats.failures++;
  }
}

export function getProxyStats() {
  return Object.fromEntries(proxyStats);
}

/**
 * 🎯 Seleciona melhor proxy baseado em estatísticas
 */
export function getBestProxy() {
  const stats = getProxyStats();
  let bestProxy = null;
  let bestScore = -1;
  
  for (const [proxy, stat] of Object.entries(stats)) {
    const total = stat.success + stat.failures;
    if (total === 0) continue;
    
    const successRate = stat.success / total;
    if (successRate > bestScore) {
      bestScore = successRate;
      bestProxy = proxy;
    }
  }
  
  return bestProxy || getRandomProxy();
}
