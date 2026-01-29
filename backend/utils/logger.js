import winston from "winston";

const { combine, timestamp, printf } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${ts} [${level.toUpperCase()}] ${message}${metaStr}`;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        logFormat
    ),
    defaultMeta: { service: "promoping" },
    transports: [
        new winston.transports.Console(),
    ],
});

export function logSupportAiDecision(ticketId, allowed, confidence, reason) {
    logger.info("support_ai_decision", {
        ticketId,
        allowed,
        confidence,
        reason: reason || (allowed ? "ai_allowed" : "escalated"),
    });
}

export function logSupportEscalation(ticketId, reason) {
    logger.info("support_escalation", { ticketId, reason });
}

export default logger;
