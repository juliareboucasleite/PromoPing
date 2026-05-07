import { pool } from "../database/db.js";
import { sendEmail } from "./notify.js";
import { formatPriceDisplay } from "../utils/format.js";

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.BASE_URL || "https://promoping.pt";
const DELIVERY_EVENT_TYPES = Object.freeze({
  promotion: "promotion",
});

function escapeHtml(text) {
  if (!text) return "";
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

function trimDescription(text, maxLength = 200) {
  const content = String(text || "").trim();
  if (!content) return "";
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength).trim()}...`;
}

async function ensureNewsletterDeliveryEventsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS newsletter_delivery_events (
      id SERIAL PRIMARY KEY,
      event_type VARCHAR(50) NOT NULL,
      event_key VARCHAR(255) NOT NULL,
      payload TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (event_type, event_key)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_newsletter_delivery_events_type
    ON newsletter_delivery_events (event_type, created_at)
  `);
}

async function ensureNewsletterSubscribersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      newsletter INTEGER DEFAULT 1,
      promotions INTEGER DEFAULT 1,
      articles INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function reserveDeliveryEvent(eventType, eventKey, payload = {}) {
  await ensureNewsletterDeliveryEventsTable();

  const [result] = await pool.query(
    `
      INSERT INTO newsletter_delivery_events (event_type, event_key, payload)
      VALUES (?, ?, ?)
      ON CONFLICT (event_type, event_key) DO NOTHING
    `,
    [eventType, eventKey, JSON.stringify(payload)]
  );

  return (result?.affectedRows || result?.rowCount || 0) > 0;
}

async function releaseDeliveryEvent(eventType, eventKey) {
  await pool.query(
    `
      DELETE FROM newsletter_delivery_events
      WHERE event_type = ? AND event_key = ?
    `,
    [eventType, eventKey]
  );
}

async function getSubscribersByPreference(preferenceColumn) {
  const allowedColumns = new Set(["newsletter", "promotions", "articles"]);
  if (!allowedColumns.has(preferenceColumn)) {
    throw new Error(`Invalid newsletter preference column: ${preferenceColumn}`);
  }

  await ensureNewsletterSubscribersTable();

  const [rows] = await pool.query(
    `
      SELECT email
      FROM newsletter_subscribers
      WHERE ${preferenceColumn} = 1
        AND email IS NOT NULL
        AND TRIM(email) <> ''
      ORDER BY created_at ASC
    `
  );

  return rows || [];
}

async function sendBatchEmails(recipients, subject, html, logLabel) {
  if (!recipients || recipients.length === 0) {
    console.log(`[NEWSLETTER] Nenhum subscritor com a preferência "${logLabel}" ativa.`);
    return { recipients: 0, sent: 0 };
  }

  let sent = 0;

  for (const row of recipients) {
    try {
      await sendEmail(row.email, subject, html);
      sent += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[NEWSLETTER] Erro ao enviar email para ${row.email}:`, error.message);
    }
  }

  console.log(`[NEWSLETTER] ${logLabel}: ${sent}/${recipients.length} emails enviados.`);
  return { recipients: recipients.length, sent };
}

function buildNewArticlesEmailHtml(articles) {
  const articlesList = articles
    .slice(0, 10)
    .map(
      (article) => `
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #2a2a2d;">
            <a href="${article.url}" target="_blank" style="color: #4dabf7; text-decoration: none; font-weight: 600; font-size: 1rem;">${escapeHtml(article.title)}</a>
            ${article.source ? `<span style="color: #666; font-size: 0.85rem;"> - ${escapeHtml(article.source)}</span>` : ""}
            ${article.description ? `<p style="margin: 8px 0 0; color: #bbb; font-size: 0.9rem; line-height: 1.5;">${escapeHtml(trimDescription(article.description))}</p>` : ""}
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
                Recebeste este email porque ativaste as notificações de novos artigos no PromoPing.
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

function buildPromotionEmailHtml({ product, novoPreco, precoAnterior, discountPercent }) {
  const productName = escapeHtml(product?.Nome || product?.nome || "Produto em promoção");
  const storeName = escapeHtml(product?.Loja || product?.loja || "Loja");
  const productUrl = product?.Link || product?.link || FRONTEND_URL;
  const absoluteDrop = Math.max(0, Number(precoAnterior) - Number(novoPreco));

  return `
<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nova promoção detetada no PromoPing</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f0f10; color: #e6e6e6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0f0f10;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #18181a; border-radius: 12px; border: 1px solid #232326;">
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 2px solid #2a2a2d;">
              <h1 style="margin: 0; font-size: 2rem; font-weight: 700; color: #fff;">PromoPing</h1>
              <p style="margin: 10px 0 0; font-size: 1rem; color: #888;">Promoções</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 1.5rem; font-weight: 600; color: #fff;">Nova descida de preço detetada</h2>
              <p style="margin: 0 0 24px; font-size: 1rem; line-height: 1.6; color: #bbb;">
                Encontrámos uma promoção relevante numa das lojas monitorizadas pelo PromoPing.
              </p>

              <div style="background-color: #1a1a1c; border: 1px solid #2a2a2d; border-radius: 8px; padding: 22px; margin: 30px 0;">
                <p style="margin: 0 0 10px; font-size: 1.1rem; font-weight: 600; color: #fff;">${productName}</p>
                <p style="margin: 0 0 18px; font-size: 0.95rem; color: #999;">${storeName}</p>
                <p style="margin: 8px 0; color: #bbb;"><strong style="color: #fff;">Preço anterior:</strong> ${formatPriceDisplay(precoAnterior)}</p>
                <p style="margin: 8px 0; color: #7ee787; font-size: 1.1rem;"><strong style="color: #fff;">Preço atual:</strong> ${formatPriceDisplay(novoPreco)}</p>
                <p style="margin: 8px 0; color: #bbb;"><strong style="color: #fff;">Poupança:</strong> ${formatPriceDisplay(absoluteDrop)} (${discountPercent.toFixed(1)}%)</p>
              </div>

              <div style="text-align: center; margin: 32px 0 0;">
                <a href="${productUrl}" target="_blank" style="display: inline-block; background-color: #fff; color: #0f0f10; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 1rem;">Ver promoção</a>
              </div>

              <p style="margin: 30px 0 0; font-size: 0.9rem; color: #666; text-align: center; border-top: 1px solid #232326; padding-top: 30px;">
                Recebeste este email porque ativaste alertas de promoções no PromoPing.
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

export async function notifySubscribersOfNewArticles(articles) {
  if (!Array.isArray(articles) || articles.length === 0) return { recipients: 0, sent: 0 };

  const recipients = await getSubscribersByPreference("articles");
  const subject =
    articles.length === 1
      ? `Novo artigo no blog: ${articles[0].title}`
      : `${articles.length} novos artigos no blog PromoPing`;
  const html = buildNewArticlesEmailHtml(articles);

  return await sendBatchEmails(recipients, subject, html, "artigos");
}

export async function notifySubscribersOfPromotion({ product, novoPreco, precoAnterior }) {
  const currentPrice = Number(novoPreco);
  const previousPrice = Number(precoAnterior);

  if (!Number.isFinite(currentPrice) || !Number.isFinite(previousPrice) || previousPrice <= currentPrice) {
    return { recipients: 0, sent: 0, skipped: true };
  }

  const productId = product?.Id || product?.id;
  if (!productId) {
    console.warn("[NEWSLETTER] Promoção ignorada por falta de product id.");
    return { recipients: 0, sent: 0, skipped: true };
  }

  const discountPercent = ((previousPrice - currentPrice) / previousPrice) * 100;
  const eventKey = `${productId}:${currentPrice.toFixed(2)}`;
  const inserted = await reserveDeliveryEvent(DELIVERY_EVENT_TYPES.promotion, eventKey, {
    productId,
    currentPrice,
    previousPrice,
  });

  if (!inserted) {
    console.log(`[NEWSLETTER] Promoção já notificada para produto ${productId} com preço ${currentPrice.toFixed(2)}.`);
    return { recipients: 0, sent: 0, duplicate: true };
  }

  const recipients = await getSubscribersByPreference("promotions");
  const subject = `Promoção detetada: ${product?.Nome || product?.nome || "Produto"} por ${formatPriceDisplay(currentPrice)}`;
  const html = buildPromotionEmailHtml({
    product,
    novoPreco: currentPrice,
    precoAnterior: previousPrice,
    discountPercent,
  });

  const result = await sendBatchEmails(recipients, subject, html, "promoções");

  if (result.recipients > 0 && result.sent === 0) {
    await releaseDeliveryEvent(DELIVERY_EVENT_TYPES.promotion, eventKey);
  }

  return result;
}
