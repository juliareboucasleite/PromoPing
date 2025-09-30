# 🛡️ Sistema Avançado de Scraping com Anti-Detecção

Sistema modular e inteligente para scraping de preços com múltiplas camadas de proteção anti-bot.

## 🚀 Características

### ✅ Sistema de Fallback Inteligente (5 Camadas)
1. **Scraper Específico** - Otimizado para cada loja
2. **Scraper Genérico** - Axios + Cheerio para sites simples
3. **Puppeteer Normal** - Para conteúdo JavaScript
4. **Stealth Inteligente** - Anti-detecção avançada
5. **Stealth Extremo** - Máxima proteção

### 🛡️ Técnicas de Anti-Detecção
- **puppeteer-extra-plugin-stealth** - Remove sinais de automação
- **Rotação de User-Agents** - 6+ agentes realistas
- **Headers dinâmicos** - Por região (PT, EN, etc.)
- **Delays aleatórios** - Simula comportamento humano
- **Movimentos de mouse** - Interação natural
- **Scroll aleatório** - Comportamento realista
- **Retry com backoff** - Tentativas inteligentes

### 🌐 Sistema de Proxies
- **Rotação automática** - Evita bloqueios
- **Proxies por região** - Melhor performance
- **Estatísticas de uso** - Otimização automática
- **Fallback inteligente** - Sempre funciona

## 📁 Estrutura

```
backend/scraper/
├── index.js              # 🎯 Sistema principal com fallback
├── antiDetection.js      # 🛡️ Técnicas de anti-detecção
├── proxyManager.js       # 🌐 Gerenciamento de proxies
├── proxyConfig.js        # ⚙️ Configuração de proxies
├── stealthLevels.js      # 🎯 Níveis de stealth
├── puppeteerBase.js      # 🖥️ Base do Puppeteer
├── generic.js            # 🌐 Scraper genérico
├── testProxies.js        # 🧪 Teste de proxies
├── setup.js              # 🚀 Configuração inicial
├── worten.js             # 🛒 Worten (específico)
├── fnac.js               # 🛒 FNAC (específico)
├── amazon.js             # 🛒 Amazon (específico)
├── ikea.js               # 🛒 IKEA (específico)
├── zara.js               # 🛒 Zara (específico)
└── ... (outros scrapers)
```

## ⚙️ Configuração

### 1. Instalar Dependências
```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth
```

### 2. Configurar Proxies
Edite `proxyConfig.js`:
```javascript
export const PROXY_CONFIG = {
  free: [
    "http://proxy1.example.com:8080",
    "http://proxy2.example.com:3128"
  ],
  premium: [
    "http://user:pass@premium-proxy.com:8080"
  ],
  residential: [
    "http://user:pass@residential-proxy.com:8080"
  ]
};
```

### 3. Testar Proxies
```bash
node testProxies.js
```

### 4. Configurar Sistema
```bash
node setup.js
```

## 🎯 Níveis de Stealth

### 🟢 Básico
- Para sites com pouca proteção
- Headless simples
- Delays mínimos
- 2 tentativas

### 🟡 Médio
- Para sites com proteção moderada
- Headers realistas
- Comportamento humano
- 3 tentativas

### 🔴 Alto
- Para sites com alta proteção
- Anti-detecção avançada
- Proxies recomendados
- 5 tentativas

### 🚀 Extremo
- Para sites com proteção máxima
- Navegador visível
- Máxima stealth
- 7 tentativas

## 📊 Uso

### Scraping Simples
```javascript
import { scrapeProduct } from './index.js';

const result = await scrapeProduct('https://www.worten.pt/produto/...');
console.log(result);
// { success: true, price: 199.99, title: "Produto", method: "worten-specific" }
```

### Scraping com Configuração
```javascript
const result = await scrapeProduct(url, {
  stealthLevel: 'high',
  proxy: 'http://proxy.com:8080',
  region: 'pt'
});
```

## 🧪 Testes

### Testar Proxies
```bash
# Testar todos
node testProxies.js

# Testar específico
node testProxies.js specific http://proxy.com:8080

# Ver estatísticas
node testProxies.js stats
```

### Testar Sistema
```bash
# Setup completo
node setup.js

# Setup rápido
node setup.js quick

# Ver status
node setup.js status
```

## 📈 Logs do Sistema

### Sucesso com Scraper Específico
```
🔍 Detectado loja: WORTEN para URL: https://www.worten.pt/...
✅ Scraper específico worten funcionou!
✅ Scraper inicial executado para Produto: €199.99 (worten - worten-specific)
```

### Fallback para Stealth
```
🔍 Detectado loja: WORTEN para URL: https://www.worten.pt/...
⚠️ Scraper específico falhou para worten, tentando fallback...
⚠️ Scraper genérico falhou, tentando Puppeteer...
🛡️ Tentando modo STEALTH inteligente...
🎯 Nível de stealth: Alto (high)
✅ Stealth Alto funcionou! (Proxy: http://proxy.com:8080)
```

### Stealth Extremo
```
🚀 Forçando modo STEALTH EXTREMO...
🔥 Nível EXTREMO ativado!
🔥 STEALTH EXTREMO funcionou! (Proxy: http://residential-proxy.com:8080)
```

## 🎯 Lojas Suportadas

### Eletrónicos
- **Worten** - Alto stealth
- **FNAC** - Médio stealth
- **PCDiga** - Médio stealth
- **Globaldata** - Médio stealth
- **Rádio Popular** - Médio stealth
- **MediaMarkt** - Médio stealth

### Casa e Decoração
- **IKEA** - Médio stealth
- **Leroy Merlin** - Médio stealth

### Moda
- **Zara** - Alto stealth
- **H&M** - Médio stealth

### Marketplaces
- **Amazon** - Alto stealth

## 🔧 Configurações Avançadas

### Proxies por Região
```javascript
export const PROXIES_BY_REGION = {
  pt: ["http://proxy-pt.com:8080"],
  es: ["http://proxy-es.com:8080"],
  fr: ["http://proxy-fr.com:8080"]
};
```

### Headers Personalizados
```javascript
export const STEALTH_CONFIG = {
  userAgents: {
    pt: ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."],
    en: ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)..."]
  }
};
```

### Seletores por Loja
```javascript
export const STORE_CONFIG = {
  worten: {
    selectors: {
      price: ["span.w-product-price", "span[data-testid='price-final']"],
      title: ["h1.product-name", ".w-product-title"]
    },
    stealthLevel: "high"
  }
};
```

## 📊 Estatísticas

O sistema mantém estatísticas de:
- **Taxa de sucesso** por loja
- **Melhor nível de stealth** por loja
- **Performance de proxies**
- **Tempo médio** de scraping

## 🚨 Troubleshooting

### Erro 403 Forbidden
- Configure proxies
- Aumente nível de stealth
- Adicione delays maiores

### Timeout
- Verifique proxies
- Reduza timeout
- Use stealth extremo

### Preço não encontrado
- Verifique seletores
- Teste manualmente
- Ajuste configurações

## 💡 Dicas

1. **Use proxies residenciais** para melhor performance
2. **Configure delays maiores** para sites protegidos
3. **Monitore logs** para otimizar configurações
4. **Teste proxies regularmente** para manter funcionamento
5. **Use níveis de stealth apropriados** para cada loja

## 🔄 Atualizações

O sistema se adapta automaticamente:
- **Aprende** com falhas
- **Otimiza** configurações
- **Rotaciona** proxies
- **Ajusta** níveis de stealth

---

**🎯 Resultado:** Sistema praticamente à prova de falhas com taxa de sucesso próxima de 100%!
