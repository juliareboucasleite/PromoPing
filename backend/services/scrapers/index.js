import fetch from "node-fetch";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import { stores } from "./stores.js";

// Detecta loja pela URL
export function detectStore(url) {
  return stores.find((s) => url.includes(s.domain)) || { name: "Desconhecida" };
}

// Normaliza preço
function normalizePrice(rawPrice) {
  if (!rawPrice) return null;
  let clean = rawPrice.replace(/[^\d,.,-]/g, "").trim();
  clean = clean.replace(",", ".");
  const value = parseFloat(clean);
  return isNaN(value) ? null : value;
}

// 1️⃣ Tenta rápido com cheerio
async function scrapeWithCheerio(url, store) {
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  // tenta meta tags primeiro
  let rawPrice =
    $("meta[property='product:price:amount']").attr("content") ||
    $("meta[itemprop='price']").attr("content") ||
    "";

  if (!rawPrice) {
    for (const selector of store.selectors.price) {
      rawPrice = $(selector).first().text().trim();
      if (rawPrice) break;
    }
  }

  const nome = $(store.selectors.name).first().text().trim();
  return { nome, rawPrice, preco: normalizePrice(rawPrice) };
}

// 2️⃣ Se falhar, usa Puppeteer
async function scrapeWithPuppeteer(url, store) {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  let nome = null;
  try {
    nome = await page.$eval(store.selectors.name, (el) => el.innerText.trim());
  } catch {}

  let rawPrice = null;
  for (const selector of store.selectors.price) {
    rawPrice = await page.$eval(selector, (el) => el.innerText.trim()).catch(
      () => null
    );
    if (rawPrice) break;
  }

  await browser.close();
  return { nome, rawPrice, preco: normalizePrice(rawPrice) };
}

// Função principal
export async function scrapeProductInfo(url) {
  try {
    const store = detectStore(url);

    if (!store || store.name === "Desconhecida") {
      return {
        loja: "Desconhecida",
        nome: "Produto não suportado",
        preco: null,
        rawPrice: null,
        link: url,
      };
    }

    // 1º tenta cheerio
    let { nome, rawPrice, preco } = await scrapeWithCheerio(url, store);

    // fallback para puppeteer se falhou
    if (!preco) {
      ({ nome, rawPrice, preco } = await scrapeWithPuppeteer(url, store));
    }

    return {
      loja: store.name,
      nome: nome || "Nome não encontrado",
      preco,
      rawPrice: rawPrice || "Preço não encontrado",
      link: url,
    };
  } catch (err) {
    console.error("❌ Erro no scrape:", err.message);
    return {
      loja: "Erro",
      nome: null,
      preco: null,
      rawPrice: null,
      link: url,
      erro: err.message,
    };
  }
}
