import { pool } from "../database/db.js";
import { formatPriceDisplay } from "../utils/format.js";
import { notifySubscribersOfPromotion } from "./newsletterNotifier.js";
import { isPlausiblePrice, describePriceRejection } from "../utils/priceValidation.js";
import { buildPriceChangeEmail, buildTargetPriceEmail } from "./emailTemplates.js";

const BACKEND_URL = process.env.BACKEND_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;

/**
 * Sistema de alertas inteligentes
 * Envia notificações quando preços atingem metas ou mudam significativamente.
 * Respeita as preferências do utilizador (email / Discord DM).
 */

/**
 * Obtém preferências de notificação do utilizador (preferenciasnotificacao).
 * @param {string} referenciaID
 * @returns {{ email: boolean, discord: boolean }}
 */
async function getNotificationPreferences(referenciaID) {
  const [rows] = await pool.query(
    "SELECT Tipo, Ativo FROM preferenciasnotificacao WHERE ReferenciaID = ?",
    [referenciaID]
  );
  const prefs = { email: false, discord: false };
  for (const r of rows || []) {
    const t = String(r.Tipo || "").toLowerCase().trim();
    if (t === "email") prefs.email = r.Ativo === 1;
    if (t === "discord") prefs.discord = r.Ativo === 1;
  }
  return prefs;
}

/**
 * Envia notificação de preço por DM no Discord via bot interno.
 * @param {string} discordId
 * @param {Object} productPayload - { Nome, Link, Id, Loja?, PrecoAnterior, PrecoAtual, PrecoAlvo, UpdatedAt }
 */
async function sendDiscordPriceDM(discordId, productPayload) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/internal/send-price-dm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordId, product: productPayload }),
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 503) {
        console.warn("[ALERTS] Bot Discord indisponível — notificação por DM não enviada. Certifica-te de que o bot está a correr (npm start).");
      } else {
        console.error("[ALERTS] Erro ao enviar DM Discord:", res.status, errText || "");
      }
      return;
    }
  } catch (err) {
    console.error("[ALERTS] Erro ao enviar DM Discord:", err.message);
  }
}

/**
 * Envia alerta de preço alvo atingido
 * @param {Object} product - Dados do produto
 * @param {number} novoPreco - Novo preço
 * @param {number} precoAlvo - Preço alvo
 */
async function sendTargetAlert(product, novoPreco, precoAlvo) {
  try {
    const savings = precoAlvo - novoPreco;
    const savingsPercent = ((savings / precoAlvo) * 100).toFixed(1);

    const [userRows] = await pool.query(
      "SELECT Email, Telefone, Nome, discord_id FROM utilizadores WHERE ReferenciaID = ?",
      [product.ReferenciaID]
    );
    const user = userRows[0] || {};
    const userName = user.Nome || "Utilizador";
    const prefs = await getNotificationPreferences(product.ReferenciaID);

    const emailContent = buildTargetPriceEmail({
      productName: product.Nome,
      storeName: product.Loja,
      targetPrice: formatPriceDisplay(precoAlvo),
      currentPrice: formatPriceDisplay(novoPreco),
      savingsLabel: formatPriceDisplay(savings),
      savingsPercent: `${savingsPercent}%`,
      productUrl: product.Link,
      userName,
    });

    if (prefs.email && user.Email) {
      const { sendEmail } = await import("./notify.js");
      await sendEmail(
        user.Email,
        emailContent.subject,
        emailContent.html,
        emailContent.text
      );
      console.log(`[ALERTS] Email de preço alvo enviado para ${user.Email}`);
      await pool.query(
        "INSERT INTO Notificacoes (ReferenciaID, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio, ValorPoupado) VALUES (?, ?, ?, ?, ?, NOW(), ?)",
        [product.ReferenciaID, product.Id, "email", emailContent.text, true, savings]
      );
    }

    if (prefs.discord && user.discord_id) {
      const productPayload = {
        Nome: product.Nome,
        Link: product.Link || "",
        Id: product.Id,
        Loja: product.Loja || null,
        PrecoAnterior: precoAlvo,
        PrecoAtual: novoPreco,
        PrecoAlvo,
        UpdatedAt: new Date(),
      };
      await sendDiscordPriceDM(user.discord_id, productPayload);
      console.log(`[ALERTS] DM Discord de preço alvo enviada para ${user.discord_id}`);
      await pool.query(
        "INSERT INTO Notificacoes (ReferenciaID, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio, ValorPoupado) VALUES (?, ?, ?, ?, ?, NOW(), ?)",
        [product.ReferenciaID, product.Id, "discord", "[DM]", true, savings]
      );
    }
  } catch (error) {
    console.error("[ALERTS] Erro ao enviar alerta de preço alvo:", error.message);
  }
}

/**
 *  Envia alerta de mudança significativa de preço
 * @param {Object} product - Dados do produto
 * @param {number} novoPreco - Novo preço
 * @param {number} precoAnterior - Preço anterior
 */
async function sendPriceChangeAlert(product, novoPreco, precoAnterior) {
  try {
    const diferenca = novoPreco - precoAnterior;
    const percentual = ((diferenca / precoAnterior) * 100).toFixed(1);
    const isIncrease = diferenca > 0;
    const changeLabel = `${isIncrease ? "+" : "-"}${formatPriceDisplay(Math.abs(diferenca))}`;
    const changePercent = `${isIncrease ? "+" : ""}${percentual}%`;

    const [userRows] = await pool.query(
      "SELECT Email, Telefone, Nome, discord_id FROM utilizadores WHERE ReferenciaID = ?",
      [product.ReferenciaID]
    );
    const user = userRows[0] || {};
    const userName = user.Nome || "Utilizador";
    const prefs = await getNotificationPreferences(product.ReferenciaID);

    const emailContent = buildPriceChangeEmail({
      productName: product.Nome,
      storeName: product.Loja,
      previousPrice: formatPriceDisplay(precoAnterior),
      currentPrice: formatPriceDisplay(novoPreco),
      changeLabel,
      changePercent,
      productUrl: product.Link,
      isIncrease,
      userName,
    });

    if (prefs.email && user.Email) {
      const { sendEmail } = await import("./notify.js");
      await sendEmail(user.Email, emailContent.subject, emailContent.html, emailContent.text);
      console.log(`[ALERTS] Email de mudança de preço enviado para ${user.Email}`);
      await pool.query(
        "INSERT INTO Notificacoes (ReferenciaID, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio, ValorPoupado) VALUES (?, ?, ?, ?, ?, NOW(), ?)",
        [product.ReferenciaID, product.Id, "email", emailContent.text, true, Math.abs(diferenca)]
      );
    }

    if (prefs.discord && user.discord_id) {
      const productPayload = {
        Nome: product.Nome,
        Link: product.Link || "",
        Id: product.Id,
        Loja: product.Loja || null,
        PrecoAnterior: precoAnterior,
        PrecoAtual: novoPreco,
        PrecoAlvo: product.PrecoAlvo || 0,
        UpdatedAt: new Date(),
      };
      await sendDiscordPriceDM(user.discord_id, productPayload);
      console.log(`[ALERTS] DM Discord de mudança de preço enviada para ${user.discord_id}`);
      await pool.query(
        "INSERT INTO Notificacoes (ReferenciaID, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio, ValorPoupado) VALUES (?, ?, ?, ?, ?, NOW(), ?)",
        [product.ReferenciaID, product.Id, "discord", "[DM]", true, Math.abs(diferenca)]
      );
    }

    if (prefs.email || prefs.discord) {
      console.log(`[ALERTS] Alerta de mudança de preço enviado para ${product.Nome}`);
    }

  } catch (error) {
    console.error(" Erro ao enviar alerta de mudança de preço:", error.message);
  }
}

/**
 *  Processa alertas para um produto atualizado
 * @param {Object} product - Dados do produto
 * @param {number} novoPreco - Novo preço
 * @param {number} precoAnterior - Preço anterior
 */
export async function processAlerts(product, novoPreco, precoAnterior) {
  try {
    if (!isPlausiblePrice(novoPreco, precoAnterior)) {
      console.warn(
        `[ALERTS] Alerta ignorado para produto ${product?.Id}: ${describePriceRejection(novoPreco, precoAnterior)}`
      );
      return;
    }

    // Verificar se atingiu preço alvo
    if (product.PrecoAlvo && novoPreco <= product.PrecoAlvo) {
      console.log(`[ALERTS] Preço alvo atingido para produto ${product.Id}: ${novoPreco} <= ${product.PrecoAlvo}`);
      await sendTargetAlert(product, novoPreco, product.PrecoAlvo);
    }
    
    // Verificar mudança significativa
    if (precoAnterior && precoAnterior > 0) {
      const percentualMudanca = Math.abs(novoPreco - precoAnterior) / precoAnterior;
      const isDecrease = novoPreco < precoAnterior;
      
      // Se o preço baixou muito (mais de 10%), sempre enviar alerta
      if (isDecrease && percentualMudanca > 0.10) {
        console.log(`[ALERTS] Queda significativa detectada para produto ${product.Id}: ${percentualMudanca * 100}% de redução`);
        await sendPriceChangeAlert(product, novoPreco, precoAnterior);
        try {
          await notifySubscribersOfPromotion({ product, novoPreco, precoAnterior });
        } catch (newsletterError) {
          console.error("[ALERTS] Erro ao notificar subscritores de promoções:", newsletterError.message);
        }
      }
      // Se mudança significativa (mais de 5%) em qualquer direção
      else if (percentualMudanca > 0.05) {
        console.log(`[ALERTS] Mudança significativa detectada para produto ${product.Id}: ${percentualMudanca * 100}%`);
        await sendPriceChangeAlert(product, novoPreco, precoAnterior);
      }
    }
    
  } catch (error) {
    console.error(" Erro ao processar alertas:", error.message);
  }
}

/**
 * Notifica o utilizador quando a equipa de suporte altera manualmente o preço no painel admin.
 * Envia email sempre (ignora preferências) se o utilizador tiver email válido.
 */
export async function notifyAdminProductPriceUpdate(product, novoPreco, precoAnterior) {
  try {
    if (!product?.ReferenciaID) return { sent: false, reason: "missing_user" };

    const parsedNew = Number(novoPreco);
    const parsedOld = Number(precoAnterior);
    if (!Number.isFinite(parsedNew) || parsedNew === parsedOld) {
      return { sent: false, reason: "unchanged_price" };
    }

    const [userRows] = await pool.query(
      "SELECT Email, Nome FROM utilizadores WHERE ReferenciaID = ?",
      [product.ReferenciaID]
    );
    const user = userRows[0];
    if (!user?.Email) {
      console.warn(`[ADMIN-ALERTS] Utilizador ${product.ReferenciaID} sem email — notificação não enviada`);
      return { sent: false, reason: "no_email" };
    }

    const userName = user.Nome || "Utilizador";
    const precoAlvo = Number(product.PrecoAlvo) || 0;
    const { sendEmail } = await import("./notify.js");

    if (precoAlvo > 0 && parsedNew <= precoAlvo) {
      const savings = precoAlvo - parsedNew;
      const savingsPercent = ((savings / precoAlvo) * 100).toFixed(1);
      const emailContent = buildTargetPriceEmail({
        productName: product.Nome,
        storeName: product.Loja,
        targetPrice: formatPriceDisplay(precoAlvo),
        currentPrice: formatPriceDisplay(parsedNew),
        savingsLabel: formatPriceDisplay(savings),
        savingsPercent: `${savingsPercent}%`,
        productUrl: product.Link,
        userName,
        updatedBySupport: true,
      });

      await sendEmail(user.Email, emailContent.subject, emailContent.html, emailContent.text);
      console.log(`[ADMIN-ALERTS] Email de preço alvo (suporte) enviado para ${user.Email}`);
    } else {
      const diferenca = parsedNew - parsedOld;
      const percentual = parsedOld > 0 ? ((diferenca / parsedOld) * 100).toFixed(1) : "0.0";
      const isIncrease = diferenca > 0;
      const changeLabel = `${isIncrease ? "+" : "-"}${formatPriceDisplay(Math.abs(diferenca))}`;
      const changePercent = `${isIncrease ? "+" : ""}${percentual}%`;

      const emailContent = buildPriceChangeEmail({
        productName: product.Nome,
        storeName: product.Loja,
        previousPrice: formatPriceDisplay(parsedOld),
        currentPrice: formatPriceDisplay(parsedNew),
        changeLabel,
        changePercent,
        productUrl: product.Link,
        isIncrease,
        userName,
        updatedBySupport: true,
      });

      await sendEmail(user.Email, emailContent.subject, emailContent.html, emailContent.text);
      console.log(`[ADMIN-ALERTS] Email de preço atualizado (suporte) enviado para ${user.Email}`);
    }

    await pool.query(
      "INSERT INTO Notificacoes (ReferenciaID, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio, ValorPoupado) VALUES (?, ?, ?, ?, ?, NOW(), ?)",
      [
        product.ReferenciaID,
        product.Id,
        "email",
        `[Suporte] Preço atualizado para ${formatPriceDisplay(parsedNew)}`,
        true,
        Math.abs(parsedNew - parsedOld),
      ]
    );

    return { sent: true, email: user.Email };
  } catch (error) {
    console.error("[ADMIN-ALERTS] Erro ao notificar utilizador sobre atualização de preço:", error.message);
    return { sent: false, reason: "error", error: error.message };
  }
}

/**
 *  Obtém estatísticas de alertas
 * @returns {Object} - Estatísticas dos alertas
 */
export async function getAlertStats() {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_alertas,
        COUNT(CASE WHEN DataEnvio >= NOW() - INTERVAL '24 hours' THEN 1 END) as alertas_24h,
        COUNT(CASE WHEN ValorPoupado > 0 THEN 1 END) as alertas_poupanca,
        SUM(COALESCE(ValorPoupado, 0)) as total_poupado
      FROM Notificacoes
    `);
    
    return stats[0];
    
  } catch (error) {
    console.error(" Erro ao obter estatísticas de alertas:", error.message);
    return null;
  }
}
