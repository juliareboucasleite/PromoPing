/**
 * Motor de intenções para o chat de suporte PromoPing.
 * Primeiro atendimento automático em JS puro, sem APIs externas de IA.
 * Fácil de expandir: adicionar novas chaves em INTENT_KEYWORDS e respostas em INTENT_REPLIES.
 */

// -----------------------------------------------------------------------------
// Constantes de intenção (expandir aqui com novas categorias)
// -----------------------------------------------------------------------------
export const INTENTS = {
    NOTIFICATION_PROBLEM: "NOTIFICATION_PROBLEM",
    PRICE_TARGET: "PRICE_TARGET",
    PLAN_ISSUE: "PLAN_ISSUE",
    UNKNOWN: "UNKNOWN",
};

/**
 * Regras por intenção: lista de palavras-chave (minúsculas).
 * A primeira intenção cuja palavra for encontrada na mensagem ganha.
 * Ordem importa: regras mais específicas podem vir primeiro.
 */
const INTENT_KEYWORDS = {
    [INTENTS.NOTIFICATION_PROBLEM]: [
        "notificação", "notificações", "notificacao", "alerta", "alertas",
        "aviso", "avisos", "email", "e-mail", "receber", "deixou de receber",
        "não recebi", "nao recebi", "chegou", "push", "lembrete",
    ],
    [INTENTS.PRICE_TARGET]: [
        "preço", "preco", "valor", "atingiu", "atingir", "meta", "alvo",
        "barato", "desconto", "baixou", "queda", "monitorizar", "monitorar",
        "produto", "produtos", "quando", "notificar", "abaixo",
    ],
    [INTENTS.PLAN_ISSUE]: [
        "plano", "planos", "pagamento", "pagar", "assinatura", "subscrição",
        "subscricao", "cartão", "cartao", "factura", "fatura", "renovar",
        "cancelar", "upgrade", "downgrade", "premium", "grátis", "gratis",
    ],
};

/**
 * Respostas humanizadas por intenção.
 * Para UNKNOWN não usamos aqui: a resposta é fixa e escalateToHuman = true.
 */
const INTENT_REPLIES = {
    [INTENTS.NOTIFICATION_PROBLEM]: [
        "As notificações dependem das definições do teu perfil e do produto. Confere em Definições > Notificações se está tudo ativo. Se o problema continuar, diz-me em que situação deixaste de receber (ex.: preço atingido) e verifico do meu lado.",
        "Os alertas são enviados quando o preço atinge o valor que definiste. Se não estás a receber, vale verificar o email (e a pasta de spam) e as notificações na app. Queres que um colega confirme a tua configuração?",
    ],
    [INTENTS.PRICE_TARGET]: [
        "O PromoPing avisa-te quando o preço do produto que seguiste atinge o valor alvo que definiste. Basta adicionar o produto e o preço desejado; quando lá chegarmos, recebes o aviso. Algum produto em concreto que queiras configurar?",
        "Para ser avisado quando o preço baixar, adiciona o produto na tua lista e define o preço alvo. Quando o preço atingir esse valor (ou ficar abaixo), enviamos a notificação. Precisas de ajuda a configurar algum item?",
    ],
    [INTENTS.PLAN_ISSUE]: [
        "Questões de plano, pagamento ou faturação são tratadas pela nossa equipa. Um agente vai verificar a tua situação e responder em breve. Obrigado pela paciência.",
        "Para alterações de plano, renovação ou problemas de pagamento, a equipa de suporte humano vai ajudar-te. Já encaminhei o teu pedido; em breve alguém entra em contacto.",
    ],
};

/**
 * Detecta a intenção da mensagem do utilizador (motor simples em JS puro).
 * @param {string} message - Mensagem do utilizador
 * @returns {string} Uma das constantes em INTENTS
 */
export function detectIntent(message) {
    if (!message || typeof message !== "string") return INTENTS.UNKNOWN;
    const text = message.trim().toLowerCase();
    if (text.length === 0) return INTENTS.UNKNOWN;

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
        for (const keyword of keywords) {
            if (text.includes(keyword)) return intent;
        }
    }
    return INTENTS.UNKNOWN;
}

/**
 * Escolhe uma resposta variada para a intenção (evita sempre a mesma frase).
 * @param {string} intent - Intenção detectada
 * @param {number} [userId] - ID do utilizador (usado como seed para variar; opcional)
 * @returns {{ reply: string, escalateToHuman: boolean }}
 */
export function getReplyForIntent(intent, userId = 0) {
    if (intent === INTENTS.UNKNOWN) {
        return {
            reply: "Obrigado pela mensagem. Este assunto vai ser visto por um agente humano, que te responderá em breve. Enquanto isso, podes dar mais detalhes do que precisas?",
            escalateToHuman: true,
        };
    }

    const replies = INTENT_REPLIES[intent];
    if (!replies || replies.length === 0) {
        return {
            reply: "Recebi o teu pedido. Um agente vai responder em breve.",
            escalateToHuman: true,
        };
    }

    const index = Math.abs(userId) % replies.length;
    return {
        reply: replies[index],
        escalateToHuman: false,
    };
}

/**
 * Processa a mensagem do utilizador: detecta intenção e devolve resposta pronta para o endpoint.
 * Aqui seria o sítio para, no futuro, simular consultas ao sistema (ex.: pool.query para estado de notificações).
 * @param {string} message - Mensagem do utilizador
 * @param {number} [userId] - ID do utilizador (para personalizar resposta e possíveis consultas)
 * @returns {{ reply: string, intent: string, escalateToHuman: boolean }}
 */
export function processMessage(message, userId = 0) {
    const intent = detectIntent(message);
    const { reply, escalateToHuman } = getReplyForIntent(intent, userId);
    return { reply, intent, escalateToHuman };
}
