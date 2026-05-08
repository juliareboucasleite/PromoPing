import { pool } from "../database/db.js";
import { analyzeSupportConversation } from "./aiSupport.service.js";
import { canAiAnswer } from "./supportRules.service.js";
import { createTicketChannel } from "./supportDiscordNotifier.js";

const HUMAN_OWNED_STAGES = new Set(["escalated", "human_replied"]);

function normalizeStage(stage) {
    return typeof stage === "string" && stage.trim() ? stage.trim().toLowerCase() : "open";
}

function mapEscalationReason(reason) {
    switch (reason) {
        case "confidence_below_threshold":
            return "Confiança abaixo do limite";
        case "sensitive_topic":
            return "Tema sensível para suporte humano";
        case "no_ai_client":
            return "IA indisponível";
        default:
            return "Escalada automática";
    }
}

function buildHistory(messages) {
    return messages.map((msg) => ({
        senderType: msg.senderType || "user",
        userName: msg.userName || "",
        message: msg.message || "",
        createdAt: msg.createdAt || null,
    }));
}

function buildTranscript(messages) {
    return messages
        .map((msg) => {
            const senderType = (msg.senderType || "user").toLowerCase();
            const senderLabel = senderType === "ai"
                ? "IA PromoPing"
                : senderType === "support"
                    ? "Suporte"
                    : (msg.userName || "Utilizador");
            return `[${senderLabel}] ${msg.message || ""}`.trim();
        })
        .join("\n\n")
        .trim();
}

async function getThreadRoot(threadId) {
    const [rows] = await pool.query(
        `SELECT id, ReferenciaID, threadId, message, userName, userEmail, discordChannelId, supportStage,
                aiConfidence, aiEscalationReason, escalatedAt
         FROM supportmessages
         WHERE id = ? OR threadId = ?
         ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, createdAt ASC
         LIMIT 1`,
        [threadId, threadId, threadId]
    );
    return rows[0] || null;
}

async function getThreadMessages(threadId) {
    const [rows] = await pool.query(
        `SELECT sm.id, sm.message, sm.senderType, sm.createdAt,
                COALESCE(sm.userName, u.Nome) AS userName
         FROM supportmessages sm
         LEFT JOIN utilizadores u ON u.ReferenciaID = sm.ReferenciaID
         WHERE sm.id = ? OR sm.threadId = ?
         ORDER BY sm.createdAt ASC, sm.id ASC`,
        [threadId, threadId]
    );
    return rows;
}

async function insertAiReply(threadId, root, reply) {
    const [result] = await pool.query(
        `INSERT INTO supportmessages (ReferenciaID, SenderReferenciaID, message, senderType, replyTo, threadId)
         VALUES (?, NULL, ?, 'ai', ?, ?)`,
        [root.ReferenciaID || root.referenciaid || null, reply, threadId, threadId]
    );
    return result.insertId;
}

async function markRootStage(threadId, stage, opts = {}) {
    const fields = ["supportStage = ?"];
    const params = [stage];

    if (Object.prototype.hasOwnProperty.call(opts, "aiConfidence")) {
        fields.push("aiConfidence = ?");
        params.push(opts.aiConfidence);
    }
    if (Object.prototype.hasOwnProperty.call(opts, "aiEscalationReason")) {
        fields.push("aiEscalationReason = ?");
        params.push(opts.aiEscalationReason);
    }
    if (opts.touchAiResponseAt) {
        fields.push("lastAiResponseAt = CURRENT_TIMESTAMP");
    }
    if (opts.touchEscalatedAt) {
        fields.push("escalatedAt = CURRENT_TIMESTAMP");
    }
    if (Object.prototype.hasOwnProperty.call(opts, "discordChannelId")) {
        fields.push("discordChannelId = ?");
        params.push(opts.discordChannelId);
    }

    params.push(threadId);
    await pool.query(`UPDATE supportmessages SET ${fields.join(", ")} WHERE id = ?`, params);
}

export async function automateSupportThread(threadId, options = {}) {
    const root = await getThreadRoot(threadId);
    if (!root) {
        return { status: "missing_thread" };
    }

    const currentStage = normalizeStage(root.supportstage || root.supportStage);
    if (HUMAN_OWNED_STAGES.has(currentStage)) {
        return { status: currentStage, threadId };
    }

    const messages = await getThreadMessages(threadId);
    const latestUserMessage = typeof options.latestUserMessage === "string"
        ? options.latestUserMessage.trim()
        : "";
    const context = typeof options.context === "string" && options.context.trim()
        ? options.context.trim()
        : "support-widget";

    const { reply, confidence, reason: aiReason } = await analyzeSupportConversation({
        message: latestUserMessage || messages[messages.length - 1]?.message || "",
        context,
        history: buildHistory(messages),
    });

    const rule = canAiAnswer(confidence, latestUserMessage, context, { aiReason });

    if (rule.allowed && reply) {
        const aiMessageId = await insertAiReply(threadId, root, reply);
        await markRootStage(threadId, "ai_answered", {
            aiConfidence: confidence,
            aiEscalationReason: null,
            touchAiResponseAt: true,
        });
        return {
            status: "ai_answered",
            threadId,
            aiMessageId,
            reply,
            confidence,
        };
    }

    const transcript = buildTranscript(messages);
    let channelId = root.discordchannelid || root.discordChannelId || null;
    if (!channelId) {
        channelId = await createTicketChannel(threadId, root.message || latestUserMessage, root.userName || "", root.userEmail || "", {
            transcript,
            escalationReason: mapEscalationReason(rule.reason || aiReason),
        });
    }

    await markRootStage(threadId, "escalated", {
        aiConfidence: confidence,
        aiEscalationReason: rule.reason || aiReason || "escalated",
        touchEscalatedAt: true,
        discordChannelId: channelId || null,
    });

    return {
        status: "escalated",
        threadId,
        confidence,
        reason: rule.reason || aiReason || "escalated",
        discordChannelId: channelId || null,
    };
}

export async function markThreadHumanReplied(threadId) {
    const root = await getThreadRoot(threadId);
    if (!root) return;
    await markRootStage(threadId, "human_replied");
}
