import { pool } from "../database/db.js";
import { sendNotification } from "./notify.js";
import { formatPriceDisplay, formatDate } from "../utils/format.js";

/**
 *  Sistema de alertas inteligentes
 * Envia notificações quando preços atingem metas ou mudam significativamente
 */

/**
 *  Envia alerta de preço alvo atingido
 * @param {Object} product - Dados do produto
 * @param {number} novoPreco - Novo preço
 * @param {number} precoAlvo - Preço alvo
 */
async function sendTargetAlert(product, novoPreco, precoAlvo) {
  try {
    const savings = precoAlvo - novoPreco;
    const savingsPercent = ((savings / precoAlvo) * 100).toFixed(1);
    
    const messageHtml = `
    Olá <b>${product.Nome}</b> ,
    O preço do produto ${product.Nome} atingiu o preço alvo de ${formatPriceDisplay(precoAlvo)}.
    Aproveite antes que o preço volte a subir! 
    Atenciosamente, <br/>
    <b>Equipe PromoPing </b><br/>
    <small>Esta é uma notificação automática — não responda a este email.</small>
  `;
        

    // Buscar configurações de notificação do utilizador
    const [configRows] = await pool.query(
      "SELECT CanalPreferido, Email, Telefone FROM ConfigUtilizador WHERE UserId = ?",
      [product.UserId]
    );

    const config = configRows[0] || {};
    const canal = config.CanalPreferido || "email";

    // Enviar notificação
    await sendNotification({
      canal,
      email: config.Email || process.env.EMAIL_USER,
      telefone: config.Telefone || null,
      mensagem: messageHtml,
    });

    // Gravar notificação no banco
    await pool.query(
      "INSERT INTO Notificacoes (UserId, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio, ValorPoupado) VALUES (?, ?, ?, ?, ?, NOW(), ?)",
      [product.UserId, product.Id, canal, messageHtml, true, savings]
    );

    console.log(` Alerta de preço alvo enviado para ${product.Nome} (${canal})`);

  } catch (error) {
    console.error(" Erro ao enviar alerta de preço alvo:", error.message);
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

    // Buscar configurações de notificação do utilizador
    const [configRows] = await pool.query(
      "SELECT CanalPreferido, Email, Telefone FROM ConfigUtilizador WHERE UserId = ?",
      [product.UserId]
    );

    const config = configRows[0] || {};
    const canal = config.CanalPreferido || "email";

    // Enviar notificação
    await sendNotification({
      canal,
      email: config.Email || process.env.EMAIL_USER,
      telefone: config.Telefone || null,
      mensagem: messageHtml,
    });

    // Gravar notificação no banco
    await pool.query(
      "INSERT INTO Notificacoes (UserId, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio, ValorPoupado) VALUES (?, ?, ?, ?, ?, NOW(), ?)",
      [product.UserId, product.Id, canal, messageHtml, true, Math.abs(diferenca)]
    );

    console.log(` Alerta de mudança de preço enviado para ${product.Nome} (${canal})`);

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
      await sendTargetAlert(product, novoPreco, product.PrecoAlvo);
    }
    
    // Verificar mudança significativa (mais de 5%)
    if (precoAnterior && Math.abs(novoPreco - precoAnterior) / precoAnterior > 0.05) {
      await sendPriceChangeAlert(product, novoPreco, precoAnterior);
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
