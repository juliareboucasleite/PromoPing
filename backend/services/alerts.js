import { pool } from "../database/db.js";
import { formatPriceDisplay } from "../utils/format.js";

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
    const userName = user.Nome || "Usuário";
    const prefs = await getNotificationPreferences(product.ReferenciaID);

    const messageHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background: #f9f9f9; border-radius: 8px; border: 1px solid #ddd; color: #333;">
        <div style="background: linear-gradient(135deg, #ff9800 0%, #ff6b35 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: white; margin: 0; font-size: 24px;">🎯 Preço Alvo Atingido!</h2>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Olá <b>${userName}</b>,
          </p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Ótimas notícias! O preço do produto <b>${product.Nome}</b> atingiu o seu preço alvo!
          </p>
          
          <div style="background: #f0f8ff; border-left: 4px solid #ff9800; padding: 20px; margin: 25px 0; border-radius: 4px;">
            <p style="margin: 5px 0; font-size: 14px; color: #666;"><b>Produto:</b> ${product.Nome}</p>
            <p style="margin: 5px 0; font-size: 14px; color: #666;"><b>Loja:</b> ${product.Loja || 'Loja'}</p>
            <p style="margin: 5px 0; font-size: 14px; color: #666;"><b>Preço Alvo:</b> ${formatPriceDisplay(precoAlvo)}</p>
            <p style="margin: 5px 0; font-size: 16px; color: #28a745; font-weight: bold;"><b>Preço Atual:</b> ${formatPriceDisplay(novoPreco)}</p>
            <p style="margin: 5px 0; font-size: 14px; color: #28a745; font-weight: bold;"><b>Você economizou:</b> ${formatPriceDisplay(savings)} (${savingsPercent}%)</p>
          </div>

          <div style="text-align: center; margin: 25px 0;">
            <a href="${product.Link}" target="_blank" 
               style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ff9800 0%, #ff6b35 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Ver Produto Agora
            </a>
          </div>

          <p style="text-align: center; color: #856404; font-size: 14px; font-weight: 600; margin-top: 20px;">
            ⚠️ Aproveite antes que o preço volte a subir!
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />

          <p style="font-size: 13px; color: #666; text-align: center;">
            Atenciosamente, <br/>
            <b>Equipe PromoPing</b><br/>
            <small>Esta é uma notificação automática — não responda a este email.</small>
          </p>
        </div>
      </div>
    `;

    if (prefs.email && user.Email) {
      const { sendEmail } = await import("./notify.js");
      await sendEmail(
        user.Email,
        `🎯 Preço Alvo Atingido: ${product.Nome}`,
        messageHtml
      );
      console.log(`[ALERTS] Email de preço alvo enviado para ${user.Email}`);
      await pool.query(
        "INSERT INTO Notificacoes (ReferenciaID, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio, ValorPoupado) VALUES (?, ?, ?, ?, ?, NOW(), ?)",
        [product.ReferenciaID, product.Id, "email", messageHtml, true, savings]
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
    
    const messageHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background: #f9f9f9; border-radius: 8px; border: 1px solid #ddd; color: #333;">
        
        <style>
          @media (prefers-color-scheme: dark) {
            div { background: #1e1e1e !important; color: #f0f0f0 !important; border: 1px solid #333 !important; }
            h2 { color: #4dabf7 !important; }
            .alert-box { background: #2d3748 !important; border: 1px solid #4a5568 !important; }
            .price-up { color: #fc8181 !important; }
            .price-down { color: #68d391 !important; }
            a.btn { background: #4dabf7 !important; color: #fff !important; }
          }
        </style>

        <h2 style="color: #1e90ff; text-align: center;">
          ${isIncrease ? '' : ''} Preço ${isIncrease ? 'Subiu' : 'Desceu'}
        </h2>
        
        <div class="alert-box" style="padding: 15px; background: #fff; border-radius: 8px; border: 1px solid #eee; margin: 20px 0;">
          <p><b> Produto:</b> ${product.Nome}</p>
          <p><b> Loja:</b> ${product.Loja}</p>
          <p><b> Preço anterior:</b> ${formatPriceDisplay(precoAnterior)}</p>
          <p><b> Preço atual:</b> <span class="${isIncrease ? 'price-up' : 'price-down'}">${formatPriceDisplay(novoPreco)}</span></p>
          <p><b> Mudança:</b> ${isIncrease ? '+' : ''}${formatPriceDisplay(Math.abs(diferenca))} (${isIncrease ? '+' : ''}${percentual}%)</p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a class="btn" href="${product.Link}" target="_blank" 
             style="display: inline-block; padding: 12px 24px; background: #1e90ff; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">
             Ver produto
          </a>
        </div>

        <p style="text-align: center; color: #666; font-size: 14px;">
          ${isIncrease ? 'O preço subiu - considere aguardar uma promoção.' : 'O preço desceu - pode ser uma boa oportunidade!'}
        </p>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />

        <p style="font-size: 13px; color: #666; text-align: center;">
          Atenciosamente, <br/>
          <b>Equipe PromoPing </b><br/>
          <small>Esta é uma notificação automática — não responda a este email.</small>
        </p>
      </div>
    `;

    const [userRows] = await pool.query(
      "SELECT Email, Telefone, Nome, discord_id FROM utilizadores WHERE ReferenciaID = ?",
      [product.ReferenciaID]
    );
    const user = userRows[0] || {};
    const userName = user.Nome || "Usuário";
    const prefs = await getNotificationPreferences(product.ReferenciaID);

    if (prefs.email && user.Email) {
      const { sendEmail } = await import("./notify.js");
      const emailSubject = isIncrease
        ? `📈 Preço Subiu: ${product.Nome}`
        : `📉 Preço Baixou: ${product.Nome}`;
      await sendEmail(user.Email, emailSubject, messageHtml);
      console.log(`[ALERTS] Email de mudança de preço enviado para ${user.Email}`);
      await pool.query(
        "INSERT INTO Notificacoes (ReferenciaID, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio, ValorPoupado) VALUES (?, ?, ?, ?, ?, NOW(), ?)",
        [product.ReferenciaID, product.Id, "email", messageHtml, true, Math.abs(diferenca)]
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
 *  Obtém estatísticas de alertas
 * @returns {Object} - Estatísticas dos alertas
 */
export async function getAlertStats() {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_alertas,
        COUNT(CASE WHEN DataEnvio >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as alertas_24h,
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
