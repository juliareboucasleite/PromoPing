import OpenAI from "openai";

const client = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

const MODEL = process.env.OPENAI_SUPPORT_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a helpful support assistant for PromoPing, a price monitoring SaaS.
Answer briefly and in Portuguese (pt-BR).
Do NOT discuss billing, payments, plan changes, refunds, or account-specific data.
Do NOT promise human follow-up.
Return ONLY valid JSON: { "reply": "your reply text", "confidence": number between 0 and 1 }.
confidence: 1 = very sure, 0 = should be escalated to human.`;

/**
 * @param {string} message
 * @param {string} context
 * @returns {Promise<{ reply: string, confidence: number }>}
 */
export async function analyzeMessage(message, context) {
    if (!client) {
        return { reply: "", confidence: 0 };
    }
    try {
        const completion = await client.chat.completions.create({
            model: MODEL,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Context: ${context}\n\nUser message: ${message}`,
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
        };
    } catch (err) {
        return { reply: "", confidence: 0 };
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
