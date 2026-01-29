const CONFIDENCE_THRESHOLD = parseFloat(process.env.SUPPORT_AI_CONFIDENCE_THRESHOLD || "0.8") || 0.8;

const FORBIDDEN_KEYWORDS = [
    "billing", "cobrança", "cobranca", "fatura", "faturas",
    "payment", "pagamento", "pagamentos", "cartão", "cartao", "stripe",
    "plan", "plano", "planos", "mudar plano", "alterar plano", "upgrade", "downgrade",
    "erro", "error", "falha", "bug", "não funciona", "nao funciona", "quebrou",
    "notificação", "notificacao", "notificações", "não recebi", "nao recebi", "alerta",
    "dados inconsistentes", "informação errada", "informacao errada", "preço errado", "preco errado",
];

/**
 * @param {number} confidence
 * @param {string} message
 * @param {string} _context
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canAiAnswer(confidence, message, _context) {
    if (confidence < CONFIDENCE_THRESHOLD) {
        return { allowed: false, reason: "confidence_below_threshold" };
    }
    const lower = (message || "").toLowerCase();
    for (const kw of FORBIDDEN_KEYWORDS) {
        if (lower.includes(kw.toLowerCase())) {
            return { allowed: false, reason: "sensitive_topic" };
        }
    }
    return { allowed: true };
}
