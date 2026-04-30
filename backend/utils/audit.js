/**
 * Sistema de auditoria.
 *
 * Regista quem fez o quê, em que entidade, com detalhes em JSON.
 * Usado pelo painel corporativo para responsabilização.
 */

import { pool } from "../database/db.js";

let tableEnsured = false;

export async function ensureAuditTable() {
    if (tableEnsured) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id SERIAL PRIMARY KEY,
            actor_referenciaid VARCHAR(13) NOT NULL,
            actor_email VARCHAR(255),
            actor_perfil INTEGER,
            action VARCHAR(80) NOT NULL,
            target_type VARCHAR(50),
            target_id VARCHAR(64),
            details JSONB,
            ip VARCHAR(64),
            user_agent VARCHAR(500),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor_referenciaid)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC)`);
    tableEnsured = true;
}

/**
 * Regista uma acção de auditoria. Nunca atira erro — falhas só são logadas.
 *
 * @param {object} req - Express request (para extrair user/IP)
 * @param {string} action - ex: 'staff.create', 'activity.delete', 'discord.approve'
 * @param {object} [opts]
 * @param {string} [opts.targetType] - tipo de entidade afectada
 * @param {string|number} [opts.targetId] - id da entidade afectada
 * @param {object} [opts.details] - payload adicional (será serializado para JSONB)
 */
export async function logAudit(req, action, opts = {}) {
    try {
        await ensureAuditTable();
        const actorRef = req?.user?.ReferenciaID || req?.user?.referenciaid || 'unknown';
        const actorEmail = req?.user?.email || req?.user?.Email || null;
        const actorPerfil = req?.user?.PerfilId ?? req?.user?.perfilId ?? null;
        const ip = (req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()) || req?.ip || req?.socket?.remoteAddress || null;
        const ua = (req?.headers?.['user-agent'] || '').slice(0, 500);
        const details = opts.details ? JSON.stringify(opts.details) : null;

        await pool.query(
            `INSERT INTO audit_logs
             (actor_referenciaid, actor_email, actor_perfil, action, target_type, target_id, details, ip, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)`,
            [
                String(actorRef).slice(0, 13),
                actorEmail ? String(actorEmail).slice(0, 255) : null,
                actorPerfil,
                String(action).slice(0, 80),
                opts.targetType ? String(opts.targetType).slice(0, 50) : null,
                opts.targetId !== undefined && opts.targetId !== null ? String(opts.targetId).slice(0, 64) : null,
                details,
                ip ? String(ip).slice(0, 64) : null,
                ua
            ]
        );
    } catch (err) {
        console.error("[AUDIT] Falha a registar acção:", action, err.message);
    }
}
