/**
 * Envia notificações de novos artigos do blog aos subscritores da newsletter
 * que ativaram "Receber notificações de novos artigos do blog" (articles = 1).
 */

import { pool } from "../database/db.js";
import { sendEmail } from "./notify.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://promoping.pt";

/**
 * Gera HTML do email com a lista de novos artigos
 * @param {Array<{ title: string, url: string, description?: string, category?: string, source?: string }>} articles
 */
function buildNewArticlesEmailHtml(articles) {
  const articlesList = articles
    .slice(0, 10)
    .map(
      (a) => `
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #2a2a2d;">
            <a href="${a.url}" target="_blank" style="color: #4dabf7; text-decoration: none; font-weight: 600; font-size: 1rem;">${escapeHtml(a.title)}</a>
            ${a.source ? `<span style="color: #666; font-size: 0.85rem;"> — ${escapeHtml(a.source)}</span>` : ""}
            ${a.description ? `<p style="margin: 8px 0 0; color: #bbb; font-size: 0.9rem; line-height: 1.5;">${escapeHtml(a.description.substring(0, 200))}${a.description.length > 200 ? "…" : ""}</p>` : ""}
          </td>
        </tr>
      `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novos artigos no blog PromoPing</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f0f10; color: #e6e6e6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0f0f10;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #18181a; border-radius: 12px; border: 1px solid #232326;">
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 2px solid #2a2a2d;">
              <h1 style="margin: 0; font-size: 2rem; font-weight: 700; color: #fff;">PromoPing</h1>
              <p style="margin: 10px 0 0; font-size: 1rem; color: #888;">Blog</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 1.5rem; font-weight: 600; color: #fff;">Novos artigos para ti</h2>
              <p style="margin: 0 0 24px; font-size: 1rem; line-height: 1.6; color: #bbb;">
                Há novos conteúdos no nosso blog. Dá uma vista de olhos:
              </p>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                ${articlesList}
              </table>
              <div style="text-align: center; margin: 32px 0 0;">
                <a href="${FRONTEND_URL}/blog" style="display: inline-block; background-color: #fff; color: #0f0f10; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 1rem;">Ver todos no blog</a>
              </div>
              <p style="margin: 30px 0 0; font-size: 0.9rem; color: #666; text-align: center; border-top: 1px solid #232326; padding-top: 30px;">
                Recebeste este email porque subscreveste as notificações de novos artigos no PromoPing.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #1a1a1c; border-top: 1px solid #232326; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 0.8rem; color: #555; text-align: center;">© ${new Date().getFullYear()} PromoPing</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function escapeHtml(text) {
  if (!text) return "";
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Notifica todos os subscritores com "artigos" ativo sobre os novos artigos.
 * @param {Array<{ title: string, description?: string, url: string, source?: string, category?: string }>} articles
 */
export async function notifySubscribersOfNewArticles(articles) {
  if (!articles || articles.length === 0) return;

  try {
    const [rows] = await pool.query(
      "SELECT email FROM newsletter_subscribers WHERE articles = 1 AND email IS NOT NULL AND email != ''"
    );
    if (!rows || rows.length === 0) {
      console.log("[NEWSLETTER] Nenhum subscritor com notificações de artigos ativas.");
      return;
    }

    const subject = articles.length === 1
      ? `Novo artigo no blog: ${articles[0].title}`
      : `${articles.length} novos artigos no blog PromoPing`;
    const html = buildNewArticlesEmailHtml(articles);

    let sent = 0;
    for (const row of rows) {
      try {
        await sendEmail(row.email, subject, html);
        sent++;
        await new Promise((r) => setTimeout(r, 100));
      } catch (err) {
        console.error(`[NEWSLETTER] Erro ao enviar email para ${row.email}:`, err.message);
      }
    }

    console.log(`[NEWSLETTER] Notificação de novos artigos enviada para ${sent}/${rows.length} subscritores.`);
  } catch (error) {
    console.error("[NEWSLETTER] Erro ao notificar subscritores de novos artigos:", error.message);
  }
}
