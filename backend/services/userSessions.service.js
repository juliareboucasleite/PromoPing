import crypto from "crypto";
import { pool } from "../database/db.js";

function parsePlatform(userAgent = "") {
  const value = String(userAgent || "");
  if (/windows/i.test(value)) return "Windows";
  if (/android/i.test(value)) return "Android";
  if (/iphone|ipad|ios/i.test(value)) return "iPhone";
  if (/mac os x|macintosh/i.test(value)) return "macOS";
  if (/linux/i.test(value)) return "Linux";
  return "Unknown";
}

function parseBrowser(userAgent = "") {
  const value = String(userAgent || "");
  if (/edg\//i.test(value)) return "Edge";
  if (/firefox\//i.test(value)) return "Firefox";
  if (/chrome\//i.test(value) && !/edg\//i.test(value)) return "Chrome";
  if (/safari\//i.test(value) && !/chrome\//i.test(value)) return "Safari";
  return "Browser";
}

function getIpAddress(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 64);
  }
  return String(req?.ip || req?.socket?.remoteAddress || "").slice(0, 64) || null;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export async function ensureUserSessionsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      session_id VARCHAR(64) PRIMARY KEY,
      referenciaid VARCHAR(13) NOT NULL,
      refresh_token_hash VARCHAR(128) NOT NULL,
      user_agent TEXT NULL,
      ip_address VARCHAR(64) NULL,
      browser VARCHAR(80) NULL,
      platform VARCHAR(80) NULL,
      device_label VARCHAR(160) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TIMESTAMP NULL
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_user_sessions_referenciaid ON user_sessions (referenciaid)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked_at ON user_sessions (revoked_at)"
  );
}

export function generateSessionId() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function createUserSession({ referenciaID, sessionId, refreshToken, req }) {
  if (!referenciaID || !sessionId || !refreshToken) return;
  await ensureUserSessionsTable();

  const userAgent = String(req?.headers?.["user-agent"] || "").slice(0, 1000) || null;
  const platform = parsePlatform(userAgent);
  const browser = parseBrowser(userAgent);
  const deviceLabel = `${browser} - ${platform}`;
  const ipAddress = getIpAddress(req);

  await pool.query(
    `INSERT INTO user_sessions (
        session_id, referenciaid, refresh_token_hash, user_agent, ip_address,
        browser, platform, device_label, created_at, last_seen_at, revoked_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
     ON CONFLICT (session_id) DO UPDATE SET
       referenciaid = EXCLUDED.referenciaid,
       refresh_token_hash = EXCLUDED.refresh_token_hash,
       user_agent = EXCLUDED.user_agent,
       ip_address = EXCLUDED.ip_address,
       browser = EXCLUDED.browser,
       platform = EXCLUDED.platform,
       device_label = EXCLUDED.device_label,
       last_seen_at = CURRENT_TIMESTAMP,
       revoked_at = NULL`,
    [sessionId, referenciaID, hashToken(refreshToken), userAgent, ipAddress, browser, platform, deviceLabel]
  );
}

export async function rotateUserSession({ sessionId, referenciaID, refreshToken, req }) {
  if (!sessionId || !refreshToken) return;
  await ensureUserSessionsTable();

  const userAgent = String(req?.headers?.["user-agent"] || "").slice(0, 1000) || null;
  const platform = parsePlatform(userAgent);
  const browser = parseBrowser(userAgent);
  const deviceLabel = `${browser} - ${platform}`;
  const ipAddress = getIpAddress(req);

  await pool.query(
    `UPDATE user_sessions
        SET refresh_token_hash = ?,
            referenciaid = COALESCE(?, referenciaid),
            user_agent = COALESCE(?, user_agent),
            ip_address = COALESCE(?, ip_address),
            browser = COALESCE(?, browser),
            platform = COALESCE(?, platform),
            device_label = COALESCE(?, device_label),
            last_seen_at = CURRENT_TIMESTAMP,
            revoked_at = NULL
      WHERE session_id = ?`,
    [hashToken(refreshToken), referenciaID || null, userAgent, ipAddress, browser, platform, deviceLabel, sessionId]
  );
}

export async function validateUserSessionRefreshToken({ sessionId, referenciaID, refreshToken }) {
  if (!sessionId || !refreshToken) return false;
  await ensureUserSessionsTable();

  const [rows] = await pool.query(
    `SELECT refresh_token_hash
       FROM user_sessions
      WHERE session_id = ?
        AND referenciaid = ?
        AND revoked_at IS NULL
      LIMIT 1`,
    [sessionId, referenciaID]
  );

  if (!rows?.length) return false;
  return rows[0].refresh_token_hash === hashToken(refreshToken);
}

export async function touchUserSession(sessionId) {
  if (!sessionId) return;
  await ensureUserSessionsTable();
  await pool.query(
    `UPDATE user_sessions
        SET last_seen_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
        AND revoked_at IS NULL`,
    [sessionId]
  );
}

export async function isUserSessionActive(sessionId, referenciaID = null) {
  if (!sessionId) return false;
  await ensureUserSessionsTable();

  const params = [sessionId];
  let sql = `SELECT session_id
               FROM user_sessions
              WHERE session_id = ?
                AND revoked_at IS NULL`;

  if (referenciaID) {
    sql += " AND referenciaid = ?";
    params.push(referenciaID);
  }

  sql += " LIMIT 1";
  const [rows] = await pool.query(sql, params);
  return Boolean(rows?.length);
}

export async function listUserSessions(referenciaID, currentSessionId = null) {
  if (!referenciaID) return [];
  await ensureUserSessionsTable();

  const [rows] = await pool.query(
    `SELECT session_id, ip_address, browser, platform, device_label, created_at, last_seen_at, revoked_at
       FROM user_sessions
      WHERE referenciaid = ?
      ORDER BY
        CASE WHEN revoked_at IS NULL THEN 0 ELSE 1 END,
        last_seen_at DESC,
        created_at DESC`,
    [referenciaID]
  );

  return (rows || []).map((row) => ({
    sessionId: row.session_id,
    ipAddress: row.ip_address,
    browser: row.browser,
    platform: row.platform,
    deviceLabel: row.device_label || `${row.browser || "Browser"} - ${row.platform || "Unknown"}`,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
    current: currentSessionId ? row.session_id === currentSessionId : false,
    active: !row.revoked_at
  }));
}

export async function revokeUserSession(sessionId, referenciaID = null) {
  if (!sessionId) return false;
  await ensureUserSessionsTable();

  const params = [sessionId];
  let sql = `
    UPDATE user_sessions
       SET revoked_at = CURRENT_TIMESTAMP
     WHERE session_id = ?
       AND revoked_at IS NULL
  `;

  if (referenciaID) {
    sql += " AND referenciaid = ?";
    params.push(referenciaID);
  }

  const [result] = await pool.query(sql, params);
  return (result?.rowCount || result?.affectedRows || 0) > 0;
}

export async function revokeOtherUserSessions(referenciaID, currentSessionId = null) {
  if (!referenciaID) return 0;
  await ensureUserSessionsTable();

  const params = [referenciaID];
  let sql = `
    UPDATE user_sessions
       SET revoked_at = CURRENT_TIMESTAMP
     WHERE referenciaid = ?
       AND revoked_at IS NULL
  `;

  if (currentSessionId) {
    sql += " AND session_id <> ?";
    params.push(currentSessionId);
  }

  const [result] = await pool.query(sql, params);
  return result?.rowCount || result?.affectedRows || 0;
}
