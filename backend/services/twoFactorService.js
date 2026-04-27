/**
 * Serviço de autenticação em dois fatores (2FA).
 * Suporta: código por email, app autenticador (TOTP) e códigos de backup.
 */

import speakeasy from "speakeasy";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { pool } from "../database/db.js";
import { sendEmail } from "./notify.js";

const BACKUP_CODES_COUNT = 8;
const BACKUP_CODE_LENGTH = 8;
const EMAIL_CODE_LENGTH = 6;
const EMAIL_CODE_EXPIRY_MINUTES = 10;
const TOTP_ISSUER = "PromoPing";

function generateBackupCodes() {
    const codes = [];
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
        let code = "";
        for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
            code += chars[crypto.randomInt(0, chars.length)];
        }
        codes.push(code);
    }
    return codes;
}

function generateEmailCode() {
    return String(crypto.randomInt(0, 10 ** EMAIL_CODE_LENGTH)).padStart(EMAIL_CODE_LENGTH, "0");
}

async function hashBackupCodes(codes) {
    return Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
}

async function verifyBackupCode(plainCode, hashedList) {
    if (!Array.isArray(hashedList) || hashedList.length === 0) return false;
    for (const hashed of hashedList) {
        const match = await bcrypt.compare(plainCode, hashed);
        if (match) return true;
    }
    return false;
}

/**
 * Retorna o estado 2FA do utilizador.
 */
export async function getStatus(referenciaID) {
    const [rows] = await pool.query(
        "SELECT enabled, method, created_at FROM user_2fa WHERE ReferenciaID = ?",
        [referenciaID]
    );
    if (rows.length === 0) {
        return { enabled: false, method: null };
    }
    const r = rows[0];
    return {
        enabled: !!r.enabled,
        method: r.method || null,
        createdAt: r.created_at
    };
}

/**
 * Verifica se o utilizador tem 2FA ativo (para login / desativar / excluir).
 */
export async function is2FAEnabled(referenciaID) {
    const [rows] = await pool.query(
        "SELECT enabled FROM user_2fa WHERE ReferenciaID = ? AND enabled = 1",
        [referenciaID]
    );
    return rows.length > 0;
}

/**
 * Inicia setup 2FA. method: 'totp' | 'email'.
 * Para TOTP: gera secret e códigos de backup, retorna secret + otpauth_url para QR.
 * Para email: gera e envia código, retorna { method: 'email', sent: true }.
 */
export async function startSetup(referenciaID, method = "totp") {
    const [userRows] = await pool.query(
        "SELECT Email, Nome FROM utilizadores WHERE ReferenciaID = ?",
        [referenciaID]
    );
    if (userRows.length === 0) throw new Error("Utilizador nao encontrado");
    const email = userRows[0].Email;
    const nome = userRows[0].Nome || "Utilizador";

    const backupCodes = generateBackupCodes();
    const backupCodesHashed = await hashBackupCodes(backupCodes);
    const backupCodesJson = JSON.stringify(backupCodesHashed);

    if (method === "totp") {
        const secret = speakeasy.generateSecret({
            name: `${TOTP_ISSUER}:${email}`,
            issuer: TOTP_ISSUER,
            length: 20
        });
        const otpauthUrl = secret.otpauth_url;

        await pool.query(
            `INSERT INTO user_2fa (ReferenciaID, enabled, method, totp_secret, backup_codes, email_code, email_code_expires)
             VALUES (?, 0, 'totp', ?, ?, NULL, NULL)
             ON CONFLICT (ReferenciaID) DO UPDATE SET
                 totp_secret = EXCLUDED.totp_secret,
                 backup_codes = EXCLUDED.backup_codes,
                 method = 'totp',
                 email_code = NULL,
                 email_code_expires = NULL,
                 enabled = 0`,
            [referenciaID, secret.base32, backupCodesJson]
        );

        return {
            method: "totp",
            secret: secret.base32,
            otpauthUrl,
            backupCodes
        };
    }

    if (method === "email") {
        const emailCode = generateEmailCode();
        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + EMAIL_CODE_EXPIRY_MINUTES);

        await pool.query(
            `INSERT INTO user_2fa (ReferenciaID, enabled, method, totp_secret, backup_codes, email_code, email_code_expires)
             VALUES (?, 0, 'email', NULL, ?, ?, ?)
             ON CONFLICT (ReferenciaID) DO UPDATE SET
                 totp_secret = NULL,
                 backup_codes = EXCLUDED.backup_codes,
                 method = 'email',
                 email_code = EXCLUDED.email_code,
                 email_code_expires = EXCLUDED.email_code_expires,
                 enabled = 0`,
            [referenciaID, backupCodesJson, emailCode, expires]
        );

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <p>Olá <b>${nome}</b>,</p>
            <p>O seu código de verificação PromoPing (2FA) é:</p>
            <p style="font-size: 24px; letter-spacing: 4px; font-weight: bold;">${emailCode}</p>
            <p style="color: #666;">Válido por ${EMAIL_CODE_EXPIRY_MINUTES} minutos. Não partilhe este código.</p>
            <p style="color: #666; font-size: 12px;">Se não solicitou este código, ignore este email.</p>
          </div>
        `;
        await sendEmail(email, "PromoPing - Código de verificação 2FA", html);

        return { method: "email", sent: true, backupCodes };
    }

    throw new Error("Metodo invalido. Use totp ou email.");
}

/**
 * Envia um novo código por email (login ou reenvio). Usado quando method=email ou para login com 2FA por email.
 */
export async function sendEmailCode(referenciaID) {
    const [userRows] = await pool.query(
        "SELECT Email, Nome FROM utilizadores WHERE ReferenciaID = ?",
        [referenciaID]
    );
    if (userRows.length === 0) throw new Error("Utilizador nao encontrado");
    const email = userRows[0].Email;
    const nome = userRows[0].Nome || "Utilizador";

    const emailCode = generateEmailCode();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + EMAIL_CODE_EXPIRY_MINUTES);

    await pool.query(
        "UPDATE user_2fa SET email_code = ?, email_code_expires = ? WHERE ReferenciaID = ?",
        [emailCode, expires, referenciaID]
    );

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <p>Olá <b>${nome}</b>,</p>
        <p>O seu código de verificação PromoPing é:</p>
        <p style="font-size: 24px; letter-spacing: 4px; font-weight: bold;">${emailCode}</p>
        <p style="color: #666;">Válido por ${EMAIL_CODE_EXPIRY_MINUTES} minutos. Não partilhe este código.</p>
      </div>
    `;
    await sendEmail(email, "PromoPing - Código de verificação", html);
    return { sent: true };
}

/**
 * Verifica o código (TOTP, email ou backup) e ativa 2FA após setup.
 * code: código de 6 dígitos (TOTP/email) ou código de backup.
 */
export async function verifyAndEnable(referenciaID, code) {
    const [rows] = await pool.query(
        "SELECT method, totp_secret, backup_codes, email_code, email_code_expires FROM user_2fa WHERE ReferenciaID = ?",
        [referenciaID]
    );
    if (rows.length === 0) throw new Error("Setup 2FA nao iniciado");
    const r = rows[0];
    const codeStr = String(code).replace(/\s/g, "");

    // Pode ser código de backup (8 caracteres)
    if (codeStr.length === BACKUP_CODE_LENGTH) {
        const hashedList = JSON.parse(r.backup_codes || "[]");
        const valid = await verifyBackupCode(codeStr, hashedList);
        if (!valid) throw new Error("Codigo invalido");
    } else {
        // TOTP ou email (6 dígitos)
        if (r.method === "totp" && r.totp_secret) {
            const valid = speakeasy.totp.verify({
                secret: r.totp_secret,
                encoding: "base32",
                token: codeStr,
                window: 1
            });
            if (!valid) throw new Error("Codigo do app invalido ou expirado");
        } else if (r.method === "email") {
            if (r.email_code !== codeStr) throw new Error("Codigo de email incorreto");
            if (!r.email_code_expires || new Date(r.email_code_expires) < new Date()) {
                throw new Error("Codigo de email expirado");
            }
        } else {
            throw new Error("Codigo invalido");
        }
    }

    await pool.query(
        "UPDATE user_2fa SET enabled = 1, email_code = NULL, email_code_expires = NULL WHERE ReferenciaID = ?",
        [referenciaID]
    );

    const [backupRow] = await pool.query(
        "SELECT backup_codes FROM user_2fa WHERE ReferenciaID = ?",
        [referenciaID]
    );
    let backupCodes = [];
    try {
        const hashed = JSON.parse(backupRow[0]?.backup_codes || "[]");
        if (hashed.length > 0) {
            backupCodes = []; // já foram devolvidos no startSetup; não expor de novo
        }
    } catch (_) {}

    return { enabled: true, backupCodes };
}

/**
 * Verifica um código para login ou para ações sensíveis (desativar/excluir conta).
 * Aceita: TOTP, código email atual, ou código de backup. Se for backup, remove o código usado.
 */
export async function verifyCode(referenciaID, code) {
    const [rows] = await pool.query(
        "SELECT enabled, method, totp_secret, backup_codes, email_code, email_code_expires FROM user_2fa WHERE ReferenciaID = ? AND enabled = 1",
        [referenciaID]
    );
    if (rows.length === 0) throw new Error("2FA nao ativo");
    const r = rows[0];
    const codeStr = String(code).replace(/\s/g, "");

    // Código de backup (8 caracteres)
    if (codeStr.length === BACKUP_CODE_LENGTH) {
        const hashedList = JSON.parse(r.backup_codes || "[]");
        for (let i = 0; i < hashedList.length; i++) {
            const match = await bcrypt.compare(codeStr, hashedList[i]);
            if (match) {
                hashedList.splice(i, 1);
                await pool.query(
                    "UPDATE user_2fa SET backup_codes = ? WHERE ReferenciaID = ?",
                    [JSON.stringify(hashedList), referenciaID]
                );
                return { verified: true, usedBackupCode: true };
            }
        }
        throw new Error("Codigo de backup invalido ou ja utilizado");
    }

    // TOTP (6 dígitos)
    if (r.method === "totp" && r.totp_secret) {
        const valid = speakeasy.totp.verify({
            secret: r.totp_secret,
            encoding: "base32",
            token: codeStr,
            window: 1
        });
        if (valid) return { verified: true };
    }

    // Email (6 dígitos)
    if (r.email_code === codeStr && r.email_code_expires && new Date(r.email_code_expires) >= new Date()) {
        await pool.query(
            "UPDATE user_2fa SET email_code = NULL, email_code_expires = NULL WHERE ReferenciaID = ?",
            [referenciaID]
        );
        return { verified: true };
    }

    throw new Error("Codigo invalido ou expirado");
}

/**
 * Desativa 2FA após verificar o código.
 */
export async function disable(referenciaID, code) {
    await verifyCode(referenciaID, code);
    await pool.query(
        "UPDATE user_2fa SET enabled = 0, method = 'totp', totp_secret = NULL, backup_codes = NULL, email_code = NULL, email_code_expires = NULL WHERE ReferenciaID = ?",
        [referenciaID]
    );
    return { enabled: false };
}
