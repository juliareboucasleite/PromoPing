/**
 * Sessões de login por QR code.
 * O código exibido no QR muda a cada 30 segundos; o telemóvel escaneia e envia o código para confirmar.
 * Persistência na tabela qr_tokens (MySQL).
 */

import { pool } from "../database/db.js";

const CODE_TTL_SEC = 30;
const CODE_PREFIX = "PP-";
const CODE_ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
  let s = CODE_PREFIX;
  for (let i = 0; i < 8; i++) {
    s += CODE_ALPHANUM[Math.floor(Math.random() * CODE_ALPHANUM.length)];
  }
  return s;
}

function generateSessionId() {
  return "qr-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

/**
 * Cria uma nova sessão ou devolve a existente; se o código expirou, gera novo código.
 * @param {string} [existingSessionId]
 * @returns {Promise<{ sessionId: string, code: string, expiresIn: number, confirmed?: boolean }>}
 */
export async function getOrCreateSession(existingSessionId) {
  const now = new Date();
  const sessionId = existingSessionId || generateSessionId();

  if (existingSessionId) {
    const [usedRows] = await pool.query(
      "SELECT code FROM qr_tokens WHERE session_id = ? AND status = 'used' LIMIT 1",
      [existingSessionId]
    );
    if (usedRows.length > 0) {
      return {
        sessionId: existingSessionId,
        code: usedRows[0].code,
        expiresIn: 0,
        confirmed: true,
      };
    }

    const [pendingRows] = await pool.query(
      "SELECT code, expires_at FROM qr_tokens WHERE session_id = ? AND status = 'pending' AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [existingSessionId]
    );
    if (pendingRows.length > 0) {
      const row = pendingRows[0];
      const expiresAt = new Date(row.expires_at);
      const expiresIn = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      return {
        sessionId: existingSessionId,
        code: row.code,
        expiresIn,
      };
    }
  }

  const code = generateCode();
  await pool.query(
    "INSERT INTO qr_tokens (code, session_id, status, expires_at, created_at) VALUES (?, ?, 'pending', DATE_ADD(NOW(), INTERVAL ? SECOND), NOW())",
    [code, sessionId, CODE_TTL_SEC]
  );

  return {
    sessionId,
    code,
    expiresIn: CODE_TTL_SEC,
  };
}

/**
 * Confirma a sessão com o código escaneado e associa ao utilizador (token do telemóvel).
 * @param {string} code
 * @param {{ ReferenciaID: string, email: string }} user
 * @param {{ token: string, refreshToken: string }} tokens
 * @returns {Promise<{ ok: boolean, error?: string, code?: 'already_used' }>}
 */
export async function confirmSession(code, user, tokens) {
  const [result] = await pool.query(
    `UPDATE qr_tokens SET status = 'used', ReferenciaID = ?, Email = ?, used_at = NOW(), token = ?, refresh_token = ?
     WHERE code = ? AND status = 'pending' AND expires_at > NOW()`,
    [user.ReferenciaID, user.email, tokens.token, tokens.refreshToken, code.trim()]
  );

  if (result.affectedRows === 0) {
    const [existing] = await pool.query("SELECT status FROM qr_tokens WHERE code = ? LIMIT 1", [code.trim()]);
    if (existing.length === 0) return { ok: false, error: "Código inválido ou expirado" };
    if (existing[0].status === "used") return { ok: false, error: "Código já utilizado", code: "already_used" };
    return { ok: false, error: "Código expirado. Escaneie o QR novamente." };
  }
  return { ok: true };
}

/**
 * Estado da sessão para o frontend (polling).
 * Quando devolve 'confirmed', apaga o registo na BD para não encher a base de dados.
 * @param {string} sessionId
 * @returns {Promise<{ status: 'pending' | 'confirmed', token?: string, refreshToken?: string, user?: object }>}
 */
export async function getSessionStatus(sessionId) {
  const [rows] = await pool.query(
    "SELECT code, token, refresh_token, ReferenciaID, Email FROM qr_tokens WHERE session_id = ? AND status = 'used' LIMIT 1",
    [sessionId]
  );
  if (rows.length === 0) return { status: "pending" };
  const row = rows[0];
  const payload = {
    status: "confirmed",
    token: row.token,
    refreshToken: row.refresh_token,
    user: {
      ReferenciaID: row.ReferenciaID,
      email: row.Email,
    },
  };
  await pool.query("DELETE FROM qr_tokens WHERE code = ?", [row.code]);
  return payload;
}

/**
 * Limpa tokens antigos (pending/expired com mais de 1h, e used órfãos).
 * Chamado periodicamente para não encher a base de dados.
 */
export async function cleanupOldQrTokens() {
  const [result] = await pool.query(
    `DELETE FROM qr_tokens WHERE (
      status IN ('pending', 'expired') AND expires_at < NOW() - INTERVAL 1 HOUR
    ) OR (
      status = 'used' AND used_at < NOW() - INTERVAL 1 HOUR
    )`
  );
  if (result.affectedRows > 0) {
    console.log("[QR-TOKENS] Limpeza: removidos", result.affectedRows, "token(s) antigo(s)");
  }
  return result.affectedRows;
}

export const CODE_TTL_MS = CODE_TTL_SEC * 1000;
