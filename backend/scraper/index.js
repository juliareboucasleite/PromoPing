import scrapeWorten from "./worten.js";
import scrapeFnac from "./fnac.js";
import scrapeAmazon from "./amazon.js";
import scrapeIkea from "./ikea.js";
import scrapeZara from "./zara.js";
import scrapePcDiga from "./pcdiga.js";
import scrapeGlobaldata from "./globaldata.js";
import scrapeRadioPopular from "./radiopopular.js";
import scrapeMediaMarkt from "./mediamarkt.js";
import scrapeLeroyMerlin from "./leroymerlin.js";
import scrapeHm from "./hm.js";
import scrapeGeneric from "./generic.js";
import { scrapeSimple, scrapeSimulated } from "./fallbackSimple.js";

// Mapeamento das lojas → scrapers específicos
const scrapers = {
  worten: scrapeWorten,
  fnac: scrapeFnac,
  pcdiga: scrapePcDiga,
  globaldata: scrapeGlobaldata,
  radiopopular: scrapeRadioPopular,
  mediamarkt: scrapeMediaMarkt,
  ikea: scrapeIkea,
  leroymerlin: scrapeLeroyMerlin,
  zara: scrapeZara,
  hm: scrapeHm,
  amazon: scrapeAmazon
};

/**
 * 🔍 Detecta loja pela URL
 */
function detectLoja(url) {
  if (url.includes("worten")) return "worten";
  if (url.includes("fnac")) return "fnac";
  if (url.includes("pcdiga")) return "pcdiga";
  if (url.includes("globaldata")) return "globaldata";
  if (url.includes("radiopopular")) return "radiopopular";
  if (url.includes("mediamarkt")) return "mediamarkt";
  if (url.includes("ikea")) return "ikea";
  if (url.includes("leroymerlin")) return "leroymerlin";
  if (url.includes("zara")) return "zara";
  if (url.includes("hm.com")) return "hm";
  if (url.includes("amazon")) return "amazon";
  return "generic";
}

/**
 * 🛒 Scraper inteligente com fallback simples
 * 1️⃣ Tenta scraper específico (rápido)
 * 2️⃣ Tenta scraper genérico (axios + cheerio)
 * 3️⃣ Fallback final
 */
export async function scrapeProduct(url) {
  const loja = detectLoja(url);
  let resultado;

  console.log(`🔍 Detectado loja: ${loja.toUpperCase()} para URL: ${url}`);

  // 1️⃣ Tenta scraper específico
  if (scrapers[loja]) {
    try {
      resultado = await scrapers[loja](url);
      if (resultado?.success && resultado.price) {
        console.log(`✅ Scraper específico ${loja} funcionou!`);
        return { ...resultado, loja };
      }
      console.warn(`⚠️ Scraper específico falhou para ${loja}, tentando fallback...`);
    } catch (err) {
      console.warn(`⚠️ Erro no scraper específico ${loja}:`, err.message);
    }
  }

  // 2️⃣ Tenta scraper genérico
  try {
    resultado = await scrapeGeneric(url, loja);
    if (resultado?.success && resultado.price) {
      console.log(`✅ Scraper genérico funcionou!`);
      return { ...resultado, loja: "genérico" };
    }
    console.warn(`⚠️ Scraper genérico falhou, tentando fallback...`);
  } catch (err) {
    console.warn(`⚠️ Erro no scraper genérico:`, err.message);
  }

  // 3️⃣ Última tentativa com Fallback Simplificado
  console.warn(`🔧 Tentando fallback simplificado...`);
  try {
    resultado = await scrapeSimple(url);
    
    if (resultado?.success && resultado.price) {
      console.log(`✅ Fallback simplificado funcionou!`);
      return { ...resultado, loja: "fallback-simple" };
    }
  } catch (err) {
    console.error(`❌ Erro no fallback simplificado:`, err.message);
  }

  // 4️⃣ Última opção: Dados simulados
  console.warn(`🎭 Usando dados simulados como fallback...`);
  try {
    resultado = await scrapeSimulated(url);
    
    if (resultado?.success && resultado.price) {
      console.log(`✅ Dados simulados gerados!`);
      return { ...resultado, loja: "simulated" };
    }
  } catch (err) {
    console.error(`❌ Erro nos dados simulados:`, err.message);
  }

  // 5️⃣ Se nada der certo
  console.error(`❌ Todos os métodos falharam para: ${url}`);
  return { 
    success: false, 
    price: null, 
    title: null, 
    loja: loja,
    method: "failed"
  };
}

/**
 * 🏪 Detecta loja pela URL
 */
export function detectStore(url) {
  const stores = {
    "worten": "Worten",
    "fnac": "FNAC", 
    "pcdiga": "PCDiga",
    "globaldata": "Globaldata",
    "radiopopular": "Rádio Popular",
    "mediamarkt": "MediaMarkt",
    "ikea": "IKEA",
    "elcorteingles": "El Corte Inglés",
    "leroymerlin": "Leroy Merlin",
    "aki": "AKI",
    "zara": "Zara",
    "hm.com": "H&M",
    "pullandbear": "Pull & Bear",
    "massimodutti": "Massimo Dutti",
    "amazon": "Amazon",
    "ebay": "eBay",
    "olx": "OLX",
    "custojusto": "Custo Justo"
  };

  for (const [domain, name] of Object.entries(stores)) {
    if (url.includes(domain)) {
      return { name, domain };
    }
  }

  return { name: "Desconhecida", domain: "unknown" };
}
