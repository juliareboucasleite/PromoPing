import OpenAI from "openai";

function firstEnv(...keys) {
    for (const key of keys) {
        const value = process.env[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
}

export function getLlmProvider() {
    const explicitProvider = firstEnv("LLM_PROVIDER").toLowerCase();
    if (explicitProvider) return explicitProvider;
    if (firstEnv("OLLAMA_BASE_URL")) return "ollama";
    if (firstEnv("OPENAI_API_KEY")) return "openai";
    return "";
}

export function getLlmBaseUrl() {
    const provider = getLlmProvider();
    if (provider === "ollama") {
        return firstEnv("OLLAMA_BASE_URL", "LLM_BASE_URL") || "http://127.0.0.1:11434/v1";
    }
    return firstEnv("LLM_BASE_URL", "OPENAI_BASE_URL");
}

export function getLlmApiKey() {
    const provider = getLlmProvider();
    if (provider === "ollama") {
        return firstEnv("OLLAMA_API_KEY", "LLM_API_KEY") || "ollama";
    }
    return firstEnv("OPENAI_API_KEY", "LLM_API_KEY");
}

export function getLlmModel(...keys) {
    const provider = getLlmProvider();
    if (provider === "ollama") {
        return firstEnv(...keys, "OLLAMA_MODEL", "LLM_MODEL") || "qwen3:1.7b";
    }
    return firstEnv(...keys, "LLM_MODEL") || "gpt-4o-mini";
}

export function createLlmClient() {
    const apiKey = getLlmApiKey();
    const baseURL = getLlmBaseUrl();
    if (!apiKey) return null;
    return new OpenAI({
        apiKey,
        ...(baseURL ? { baseURL } : {})
    });
}

