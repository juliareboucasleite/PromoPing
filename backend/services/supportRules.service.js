const CONFIDENCE_THRESHOLD = parseFloat(process.env.SUPPORT_AI_CONFIDENCE_THRESHOLD || "0.8") || 0.8;

const FORBIDDEN_KEYWORDS = [
    "billing", "cobranca", "fatura", "faturas",
    "payment", "pagamento", "pagamentos", "cartao", "stripe",
    "plan", "plano", "planos", "mudar plano", "alterar plano", "upgrade", "downgrade",
    "reembolso", "refund", "chargeback", "estorno",
    "erro", "error", "falha", "bug", "nao funciona", "quebrou",
    "dados inconsistentes", "informacao errada", "preco errado",
    "minha conta", "minha assinatura", "meu pagamento", "meu plano", "meu cartao",
];

/**
 * @param {number} confidence
 * @param {string} message
 * @param {string} _context
 * @param {{ aiReason?: string }} [options]
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canAiAnswer(confidence, message, _context, options = {}) {
    if (options.aiReason === "no_ai_client" || options.aiReason === "llm_error") {
        return { allowed: false, reason: options.aiReason };
    }
    if (confidence < CONFIDENCE_THRESHOLD) {
        return { allowed: false, reason: "confidence_below_threshold" };
    }

    const lower = (message || "").toLowerCase();
    for (const kw of FORBIDDEN_KEYWORDS) {
        if (lower.includes(kw)) {
            return { allowed: false, reason: "sensitive_topic" };
        }
    }

    return { allowed: true };
}
