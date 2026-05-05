import OpenAI from "openai";

const client = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

const MODEL = process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_SUPPORT_MODEL || "gpt-4o-mini";

const STORE_CONFIG = [
    { name: "Worten", aliases: ["worten"] },
    { name: "FNAC", aliases: ["fnac"] },
    { name: "PCDiga", aliases: ["pcdiga", "pc diga"] },
    { name: "Amazon", aliases: ["amazon", "amazon es", "amazon.es"] },
    { name: "MediaMarkt", aliases: ["mediamarkt", "media markt"] },
    { name: "Radio Popular", aliases: ["radio popular", "radiopopular", "radio-popular"] },
    { name: "Globaldata", aliases: ["globaldata", "global data"] },
    { name: "IKEA", aliases: ["ikea"] },
    { name: "Leroy Merlin", aliases: ["leroy merlin", "leroymerlin"] },
    { name: "Continente", aliases: ["continente"] },
    { name: "Pingo Doce", aliases: ["pingo doce", "pingodoce"] },
    { name: "Auchan", aliases: ["auchan"] },
    { name: "El Corte Ingles", aliases: ["el corte ingles", "elcorteingles"] },
    { name: "Decathlon", aliases: ["decathlon"] },
    { name: "Sport Zone", aliases: ["sport zone", "sportzone"] },
    { name: "Foot Locker", aliases: ["foot locker", "footlocker"] },
    { name: "Zara", aliases: ["zara"] },
    { name: "H&M", aliases: ["h&m", "hm"] },
    { name: "Bershka", aliases: ["bershka"] },
    { name: "Pull & Bear", aliases: ["pull & bear", "pull and bear", "pullbear", "pullandbear"] },
    { name: "Stradivarius", aliases: ["stradivarius"] },
    { name: "Massimo Dutti", aliases: ["massimo dutti", "massimodutti"] },
    { name: "Oysho", aliases: ["oysho"] },
    { name: "Lefties", aliases: ["lefties"] },
    { name: "Primark", aliases: ["primark"] }
];

const STORE_LOOKUP = new Map();
for (const store of STORE_CONFIG) {
    STORE_LOOKUP.set(normalizeText(store.name), store.name);
    for (const alias of store.aliases) {
        STORE_LOOKUP.set(normalizeText(alias), store.name);
    }
}

const STOPWORDS = new Set([
    "a", "ao", "aos", "as", "ate", "below", "best", "boa", "bom", "buscar",
    "busca", "cheap", "cheapest", "com", "comprar", "de", "do", "dos", "e",
    "em", "encontra", "encontrar", "find", "for", "from", "mais", "max",
    "maximo", "me", "melhor", "mostrar", "mostra", "na", "nas", "no", "nos",
    "o", "of", "on", "os", "para", "por", "preco", "precos", "procura",
    "procurar", "produto", "produtos", "quero", "search", "show", "the",
    "tipo", "top", "um", "uma", "under", "want", "with"
]);

const SORT_PATTERNS = [
    { regex: /\b(mais barato|mais baratos|barato|baratos|cheapest|lowest price|lowest)\b/i, value: "price_asc" }
];

const PRICE_PATTERNS = [
    /\b(?:ate|under|below|max|maximo|menos de)\s*[€$]?\s*(\d{1,5}(?:[.,]\d{1,2})?)\b/i,
    /\b[€$]\s*(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:ou menos|or less)?\b/i,
    /\b(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:euros?|eur)\b/i
];

const CONVERSATIONAL_PATTERN = /\b(quero|mostra|mostrar|encontra|procura|buscar|find|show|search|under|below|ate|mais barato|barato|max)\b/i;

const SYSTEM_PROMPT = `You are an assistant that converts natural-language ecommerce queries into structured search intent for PromoPing.
Return ONLY valid JSON with this exact shape:
{
  "searchQuery": "short keyword query with brand/model/category only",
  "store": "one exact store name from the allowed list or null",
  "maxPrice": number or null,
  "sortBy": "relevance" or "price_asc",
  "confidence": number between 0 and 1
}
Rules:
- Keep searchQuery concise, useful for a product scraper, and remove conversational filler.
- Never invent a store. Use null if unsure.
- Never invent a budget. Use null if absent.
- Use "price_asc" only if the user explicitly asks for the cheapest/lowest price.
- Allowed stores: ${STORE_CONFIG.map((store) => store.name).join(", ")}.`;

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function parsePriceNumber(rawValue) {
    if (rawValue == null) return null;
    const normalized = String(rawValue).replace(/\./g, "").replace(",", ".");
    const value = Number.parseFloat(normalized);
    if (!Number.isFinite(value) || value <= 0) return null;
    return Number(value.toFixed(2));
}

function extractStore(rawQuery) {
    const normalizedQuery = normalizeText(rawQuery);
    let bestMatch = null;

    for (const [alias, canonical] of STORE_LOOKUP.entries()) {
        if (!alias) continue;
        const boundaryRegex = new RegExp(`(?:^| )${escapeRegExp(alias)}(?: |$)`);
        if (!boundaryRegex.test(normalizedQuery)) continue;
        if (!bestMatch || alias.length > bestMatch.alias.length) {
            bestMatch = { alias, store: canonical };
        }
    }

    return bestMatch?.store || null;
}

function extractPrice(rawQuery) {
    for (const pattern of PRICE_PATTERNS) {
        const match = String(rawQuery || "").match(pattern);
        if (!match) continue;
        const value = parsePriceNumber(match[1]);
        if (value != null) {
            return {
                value,
                matchedText: match[0]
            };
        }
    }
    return { value: null, matchedText: "" };
}

function detectSort(rawQuery) {
    for (const pattern of SORT_PATTERNS) {
        if (pattern.regex.test(String(rawQuery || ""))) {
            return pattern.value;
        }
    }
    return "relevance";
}

function buildKeywordQuery(rawQuery, store, priceMatchedText) {
    const storeTokens = new Set(normalizeText(store).split(/\s+/).filter(Boolean));
    const priceTokens = new Set(normalizeText(priceMatchedText).split(/\s+/).filter(Boolean));
    const tokens = normalizeText(rawQuery)
        .split(/\s+/)
        .filter(Boolean)
        .filter((token) => !STOPWORDS.has(token))
        .filter((token) => !storeTokens.has(token))
        .filter((token) => !priceTokens.has(token));

    const deduped = [];
    for (const token of tokens) {
        if (!deduped.includes(token)) deduped.push(token);
    }

    const query = deduped.slice(0, 8).join(" ").trim();
    return query || normalizeText(rawQuery).slice(0, 80);
}

function buildHeuristicIntent(rawQuery) {
    const store = extractStore(rawQuery);
    const { value: maxPrice, matchedText } = extractPrice(rawQuery);
    const sortBy = detectSort(rawQuery);
    const searchQuery = buildKeywordQuery(rawQuery, store, matchedText);
    const hasFilters = Boolean(store) || maxPrice != null || sortBy !== "relevance";

    return {
        rawQuery: String(rawQuery || "").trim(),
        searchQuery,
        store,
        maxPrice,
        sortBy,
        confidence: hasFilters ? 0.72 : 0.56,
        source: hasFilters ? "heuristic" : "plain"
    };
}

function shouldUseAi(rawQuery, heuristicIntent) {
    if (!client) return false;
    const query = String(rawQuery || "").trim();
    if (!query) return false;
    if (query.split(/\s+/).length < 4) return false;
    if (heuristicIntent.searchQuery.length < 2) return true;
    return CONVERSATIONAL_PATTERN.test(query);
}

function normalizeStoreCandidate(store) {
    if (!store) return null;
    return STORE_LOOKUP.get(normalizeText(store)) || null;
}

function sanitizeSort(sortBy) {
    return sortBy === "price_asc" ? "price_asc" : "relevance";
}

function sanitizeSearchQuery(searchQuery, fallbackQuery) {
    const candidate = normalizeText(searchQuery).slice(0, 80);
    if (candidate.length >= 2) return candidate;
    return normalizeText(fallbackQuery).slice(0, 80);
}

function parseJsonReply(content) {
    try {
        const cleaned = String(content || "").replace(/```json\s*|\s*```/gi, "").trim();
        return JSON.parse(cleaned);
    } catch {
        return null;
    }
}

async function resolveWithAi(rawQuery, heuristicIntent) {
    const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 250,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "user",
                content: `User query: ${rawQuery}\nHeuristic intent: ${JSON.stringify(heuristicIntent)}`
            }
        ]
    });

    const content = completion.choices?.[0]?.message?.content?.trim() || "";
    const parsed = parseJsonReply(content);
    if (!parsed || typeof parsed !== "object") {
        return null;
    }

    const confidence = Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, Number(parsed.confidence)))
        : 0;
    const searchQuery = sanitizeSearchQuery(parsed.searchQuery, heuristicIntent.searchQuery);
    const store = normalizeStoreCandidate(parsed.store) || heuristicIntent.store;
    const maxPrice = parsePriceNumber(parsed.maxPrice) ?? heuristicIntent.maxPrice;
    const sortBy = sanitizeSort(parsed.sortBy || heuristicIntent.sortBy);

    if (confidence < 0.55) {
        return null;
    }

    return {
        rawQuery: String(rawQuery || "").trim(),
        searchQuery,
        store,
        maxPrice,
        sortBy,
        confidence,
        source: "ai"
    };
}

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function resolveProductSearchIntent(rawQuery) {
    const heuristicIntent = buildHeuristicIntent(rawQuery);
    if (!shouldUseAi(rawQuery, heuristicIntent)) {
        return heuristicIntent;
    }

    try {
        const aiIntent = await resolveWithAi(rawQuery, heuristicIntent);
        return aiIntent || heuristicIntent;
    } catch {
        return heuristicIntent;
    }
}

