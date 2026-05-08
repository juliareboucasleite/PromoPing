import { createLlmClient, getLlmModel } from "./llmClient.service.js";

const client = createLlmClient();

const MODEL = getLlmModel("OPENAI_SUPPORT_MODEL", "SUPPORT_LLM_MODEL");

const SYSTEM_PROMPT = `You are a helpful support assistant for PromoPing, a price monitoring SaaS.
Answer briefly and in Portuguese (pt-BR).
Do NOT discuss billing, payments, plan changes, refunds, or account-specific data.
Do NOT promise human follow-up.
Return ONLY valid JSON: { "reply": "your reply text", "confidence": number between 0 and 1 }.
confidence: 1 = very sure, 0 = should be escalated to human.`;

function buildHistoryBlock(history = []) {
    const normalized = Array.isArray(history) ? history : [];
    const relevant = normalized.slice(-12);
    if (relevant.length === 0) return "Sem histórico anterior.";
    return relevant.map((item) => {
        const senderType = (item.senderType || "user").toLowerCase();
        const label = senderType === "ai"
            ? "Assistente IA"
            : senderType === "support"
                ? "Suporte humano"
                : (item.userName || "Utilizador");
        return `${label}: ${String(item.message || "").trim()}`;
    }).join("\n");
}

/**
 * @param {string} message
 * @param {string} context
 * @returns {Promise<{ reply: string, confidence: number }>}
 */
export async function analyzeMessage(message, context) {
    return analyzeSupportConversation({ message, context, history: [] });
}

/**
 * @param {{ message: string, context: string, history?: Array<{ senderType?: string, userName?: string, message?: string }> }} input
 * @returns {Promise<{ reply: string, confidence: number, reason?: string }>}
 */
export async function analyzeSupportConversation(input) {
    const message = typeof input?.message === "string" ? input.message : "";
    const context = typeof input?.context === "string" ? input.context : "support";
    const history = Array.isArray(input?.history) ? input.history : [];

    if (!client) {
        return { reply: "", confidence: 0, reason: "no_ai_client" };
    }
    try {
        const completion = await client.chat.completions.create({
            model: MODEL,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Context: ${context}\n\nConversation history:\n${buildHistoryBlock(history)}\n\nLatest user message: ${message}`,
                },
            ],
            max_tokens: 500,
            temperature: 0.3,
        });
        const content = completion.choices?.[0]?.message?.content?.trim() || "";
        const parsed = parseJsonReply(content);
        return {
            reply: parsed.reply || "",
            confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
            reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
        };
    } catch (err) {
        return { reply: "", confidence: 0, reason: "llm_error" };
    }
}

function parseJsonReply(content) {
    try {
        const json = content.replace(/```json?\s*|\s*```/g, "").trim();
        return JSON.parse(json);
    } catch {
        return { reply: "", confidence: 0 };
    }
}
