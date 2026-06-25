import express from "express";
import { sendEmail } from "../services/notify.js";
import { pool } from "../database/db.js";
import { notifySubscribersOfPromotion } from "../services/newsletterNotifier.js";

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.BASE_URL || "https://promoping.pt";

function parsePreferenceFlag(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value === 1 ? 1 : 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "on", "yes"].includes(normalized)) return 1;
    if (["0", "false", "off", "no", ""].includes(normalized)) return 0;
  }
  return 0;
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function buildPreferenceList(preferences) {
  const items = [];
  if (preferences.newsletter) items.push("Newsletter semanal com dicas de poupança");
  if (preferences.promotions) items.push("Alertas de promoções exclusivas");
  if (preferences.articles) items.push("Notificações de novos artigos do blog");
  return items;
}

function getNewsletterConfirmationEmail(preferences) {
  const preferencesList = buildPreferenceList(preferences);

  return `
<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo à Newsletter PromoPing</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f0f10; color: #e6e6e6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0f0f10;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #18181a; border-radius: 12px; border: 1px solid #232326;">
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 2px solid #2a2a2d;">
              <h1 style="margin: 0; font-size: 2rem; font-weight: 700; color: #fff; letter-spacing: -0.02em;">PromoPing</h1>
              <p style="margin: 10px 0 0; font-size: 1rem; color: #888;">Newsletter</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 1.5rem; font-weight: 600; color: #fff;">Bem-vindo à Newsletter PromoPing!</h2>

              <p style="margin: 0 0 20px; font-size: 1rem; line-height: 1.6; color: #bbb;">
                Obrigado por subscrever a nossa newsletter. A partir de agora vais receber apenas os conteúdos que escolheste.
              </p>

              <div style="background-color: #1a1a1c; border: 1px solid #2a2a2d; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px; font-size: 1.1rem; font-weight: 600; color: #fff;">As tuas preferências</h3>
                <ul style="margin: 0; padding-left: 20px; color: #bbb; line-height: 1.8;">
                  ${preferencesList.map((pref) => `<li style="margin-bottom: 8px;">${pref}</li>`).join("")}
                </ul>
              </div>

              <p style="margin: 20px 0; font-size: 1rem; line-height: 1.6; color: #bbb;">
                Podes visitar a plataforma a qualquer momento para acompanhar produtos, descobrir oportunidades e gerir os teus alertas.
              </p>

              <div style="text-align: center; margin: 40px 0 30px;">
                <a href="${FRONTEND_URL}" style="display: inline-block; background-color: #fff; color: #0f0f10; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 1rem;">Visitar PromoPing</a>
              </div>

              <p style="margin: 30px 0 0; font-size: 0.9rem; line-height: 1.6; color: #666; text-align: center; border-top: 1px solid #232326; padding-top: 30px;">
                Se não subscreveste esta newsletter, podes ignorar este email ou contactar-nos através do nosso suporte.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 40px; background-color: #1a1a1c; border-top: 1px solid #232326; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 10px; font-size: 0.85rem; color: #666; text-align: center;">
                <strong style="color: #888;">PromoPing</strong> - monitorização de preços para lojas online portuguesas
              </p>
              <p style="margin: 0; font-size: 0.8rem; color: #555; text-align: center;">
                © ${new Date().getFullYear()} PromoPing. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function ensureNewsletterSubscribersTable(connection) {
  await connection.query(`
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

router.post("/subscribe", async (req, res) => {
  const { email, newsletter, promotions, articles } = req.body || {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const newsletterFlag = parsePreferenceFlag(newsletter);
  const promotionsFlag = parsePreferenceFlag(promotions);
  const articlesFlag = parsePreferenceFlag(articles);

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: "Email inválido",
    });
  }

  if (newsletterFlag === 0 && promotionsFlag === 0 && articlesFlag === 0) {
    return res.status(400).json({
      success: false,
      message: "Selecione pelo menos uma preferência",
    });
  }

  const connection = await pool.getConnection();

  try {
    await ensureNewsletterSubscribersTable(connection);

    await connection.query(
      `
        INSERT INTO newsletter_subscribers (email, newsletter, promotions, articles)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (email) DO UPDATE
        SET newsletter = EXCLUDED.newsletter,
            promotions = EXCLUDED.promotions,
            articles = EXCLUDED.articles,
            updated_at = CURRENT_TIMESTAMP
      `,
      [normalizedEmail, newsletterFlag, promotionsFlag, articlesFlag]
    );

    const emailHtml = getNewsletterConfirmationEmail({
      newsletter: newsletterFlag === 1,
      promotions: promotionsFlag === 1,
      articles: articlesFlag === 1,
    });

    let emailSent = true;
    try {
      await sendEmail(normalizedEmail, "Bem-vindo à Newsletter PromoPing!", emailHtml);
    } catch (emailError) {
      emailSent = false;
      console.warn(
        "[NEWSLETTER] Subscrição guardada, mas falhou o envio do email de confirmação:",
        emailError.message
      );
    }

    console.log(`[NEWSLETTER] Nova subscrição: ${normalizedEmail}`);

    return res.json({
      success: true,
      message: emailSent
        ? "Subscrição realizada com sucesso. Verifica o teu email para confirmar."
        : "Subscrição realizada com sucesso, mas não foi possível enviar o email de confirmação.",
    });
  } catch (error) {
    console.error("[NEWSLETTER] Erro ao processar subscrição:", error);

    if (error.code === "23505" || error.code === "ER_DUP_ENTRY") {
      return res.json({
        success: true,
        message: "Já estás subscrito. As tuas preferências foram atualizadas.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Erro ao processar subscrição. Tenta novamente mais tarde.",
    });
  } finally {
    connection.release();
  }
});

router.post("/unsubscribe", async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: "Email inválido",
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.query("DELETE FROM newsletter_subscribers WHERE email = ?", [normalizedEmail]);

    console.log(`[NEWSLETTER] Subscrição cancelada: ${normalizedEmail}`);

    return res.json({
      success: true,
      message: "Subscrição cancelada com sucesso.",
    });
  } catch (error) {
    console.error("[NEWSLETTER] Erro ao cancelar subscrição:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao cancelar subscrição. Tenta novamente mais tarde.",
    });
  } finally {
    connection.release();
  }
});

router.post("/internal/record-price", async (req, res) => {
  const configuredSecret = process.env.INTERNAL_NEWSLETTER_SECRET || "";
  const providedSecret = req.get("x-internal-secret") || "";

  if (configuredSecret && providedSecret !== configuredSecret) {
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  const { productId, price } = req.body || {};
  const parsedProductId = parseInt(productId, 10);
  const parsedPrice = Number(price);

  if (!Number.isFinite(parsedProductId) || !Number.isFinite(parsedPrice)) {
    return res.status(400).json({
      success: false,
      message: "Payload inválido para atualização de preço.",
    });
  }

  try {
    const { salvarPreco } = await import("../database/models/historico.js");
    const result = await salvarPreco(parsedProductId, parsedPrice);
    if (result?.skipped) {
      return res.status(422).json({
        success: false,
        skipped: true,
        reason: result.reason || "implausible_price",
      });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("[NEWSLETTER] Erro ao registar preço interno:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao registar preço.",
    });
  }
});

router.post("/internal/promotion", async (req, res) => {
  const configuredSecret = process.env.INTERNAL_NEWSLETTER_SECRET || "";
  const providedSecret = req.get("x-internal-secret") || "";

  if (configuredSecret && providedSecret !== configuredSecret) {
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  const { product, novoPreco, precoAnterior } = req.body || {};

  if (!product?.Id || novoPreco == null || precoAnterior == null) {
    return res.status(400).json({
      success: false,
      message: "Payload inválido para promoção.",
    });
  }

  try {
    const result = await notifySubscribersOfPromotion({ product, novoPreco, precoAnterior });
    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[NEWSLETTER] Erro ao enviar promoção interna:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao notificar promoção.",
    });
  }
});

router.get("/stats", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await ensureNewsletterSubscribersTable(connection);

    const [newsletterCount] = await connection.query(`
      SELECT COUNT(*) AS total FROM newsletter_subscribers
    `);

    const [usersCount] = await connection.query(`
      SELECT COUNT(*) AS total FROM utilizadores WHERE Ativo = 1
    `);

    const [productsCount] = await connection.query(`
      SELECT COUNT(*) AS total FROM produtos WHERE DeletedAt IS NULL
    `);

    const [notificationsCount] = await connection.query(`
      SELECT COUNT(*) AS total FROM Notificacoes
      WHERE DataEnvio >= NOW() - INTERVAL '30 days'
    `);

    const [totalNotificationsCount] = await connection.query(`
      SELECT COUNT(*) AS total FROM Notificacoes
    `);

    const [savingsTotal] = await connection.query(`
      SELECT COALESCE(SUM(ValorPoupado), 0) AS total FROM Notificacoes
      WHERE DataEnvio >= NOW() - INTERVAL '30 days' AND ValorPoupado IS NOT NULL
    `);

    const [totalSavings] = await connection.query(`
      SELECT COALESCE(SUM(ValorPoupado), 0) AS total FROM Notificacoes
      WHERE ValorPoupado IS NOT NULL
    `);

    const [historyCount] = await connection.query(`
      SELECT COUNT(*) AS total FROM historicoprecos
    `);

    return res.json({
      success: true,
      stats: {
        newsletterSubscribers: newsletterCount[0]?.total || 0,
        totalUsers: usersCount[0]?.total || 0,
        monitoredProducts: productsCount[0]?.total || 0,
        notificationsLast30Days: notificationsCount[0]?.total || 0,
        totalNotifications: totalNotificationsCount[0]?.total || 0,
        totalSavedLast30Days: parseFloat(savingsTotal[0]?.total || 0),
        totalSaved: parseFloat(totalSavings[0]?.total || 0),
        dataAnalyzed: historyCount[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error("[NEWSLETTER] Erro ao buscar estatísticas:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao buscar estatísticas.",
    });
  } finally {
    connection.release();
  }
});

export default router;
