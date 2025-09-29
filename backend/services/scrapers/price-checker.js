// @ts-nocheck
import { pool } from "../../database/db.js";
import { scrapeProductInfo } from "./index.js";
import { sendNotification } from "../notify.js";

// 🔎 Atualiza preço de um produto
async function updateProductPrice(product) {
  const info = await scrapeProductInfo(product.Link);

  if (info?.preco == null) {
    console.warn(`⚠️ Não foi possível capturar preço de ${product.Nome}`);
    return null;
  }

  // Atualiza preço atual na tabela Produtos
  await pool.query(
    "UPDATE Produtos SET PrecoAtual=? WHERE Id=?",
    [info.preco, product.Id]
  );

  // Grava no histórico
  await pool.query(
    "INSERT INTO HistoricoPrecos (ProdutoId, Preco, DataRegisto) VALUES (?, ?, NOW())",
    [product.Id, info.preco]
  );

  console.log(`🛒 [${product.Nome}] atualizado para €${info.preco}`);

  const targetReached =
    product.PrecoAlvo != null && info.preco <= product.PrecoAlvo;

  return { info, targetReached };
}

// 🚀 Executa a verificação uma vez
export async function runPriceCheckOnce() {
  const [products] = await pool.query(
    "SELECT p.Id, p.UserId, p.Nome, p.Link, p.PrecoAlvo FROM Produtos p"
  );

  for (const p of products) {
    try {
      const result = await updateProductPrice(p);
      if (!result) continue;

      if (result.targetReached) {
        // ✉️ Email HTML com suporte a dark mode
        const messageHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background: #f9f9f9; border-radius: 8px; border: 1px solid #ddd; color: #333;">
            
            <style>
              @media (prefers-color-scheme: dark) {
                div {
                  background: #1e1e1e !important;
                  color: #f0f0f0 !important;
                  border: 1px solid #333 !important;
                }
                h2 { color: #4dabf7 !important; }
                a.btn {
                  background: #4dabf7 !important;
                  color: #fff !important;
                }
              }
            </style>

            <h2 style="color: #1e90ff; text-align: center;">🎉 Oferta atingiu o preço desejado!</h2>
            <p>Olá 👋,</p>
            <p>Boa notícia! O produto que você está acompanhando caiu de preço e atingiu a sua meta.</p>
            
            <div style="padding: 15px; background: #fff; border-radius: 8px; border: 1px solid #eee; margin: 20px 0;">
              <p><b>📌 Produto:</b> ${p.Nome}</p>
              <p><b>💰 Preço atual:</b> €${result.info.preco}</p>
            </div>

            <div style="text-align: center; margin: 20px 0;">
              <a class="btn" href="${p.Link}" target="_blank" 
                 style="display: inline-block; padding: 12px 24px; background: #1e90ff; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">
                🔗 Ver oferta agora
              </a>
            </div>

            <p>Aproveite para conferir antes que o preço volte a subir!</p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />

            <p style="font-size: 13px; color: #666; text-align: center;">
              Atenciosamente, <br/>
              <b>Equipe PromoPing 🚀</b><br/>
              <small>Esta é uma notificação automática — não responda a este email.</small>
            </p>
          </div>
        `;

        // Busca canal + contacto preferido do utilizador
        const [cfgRows] = await pool.query(
          "SELECT CanalPreferido, Email, Telefone FROM ConfigUtilizador WHERE UserId=?",
          [p.UserId]
        );

        const config = cfgRows[0] || {};
        const canal = config.CanalPreferido || "email";

        // Envia notificação (email ou sms)
        await sendNotification({
          canal,
          email: config.Email || process.env.EMAIL_USER, // fallback
          telefone: config.Telefone || null,
          mensagem: messageHtml,
        });

        // Grava notificação
        await pool.query(
          "INSERT INTO Notificacoes (UserId, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio) VALUES (?, ?, ?, ?, ?, NOW())",
          [p.UserId, p.Id, canal, messageHtml, true]
        );

        console.log(`📢 Notificação enviada (${canal}) para ${p.Nome}`);
      }
    } catch (e) {
      console.warn("❌ Falha ao atualizar preço:", p.Id, e.message);
    }
  }
}

// ⏳ Inicia monitor automático
let intervalRef = null;
export function startPriceChecker() {
  if (intervalRef) return;

  console.log("⏳ Monitor de preços ativo (30min)");
  intervalRef = setInterval(() => {
    runPriceCheckOnce().catch((err) =>
      console.error("Erro no price-checker:", err.message)
    );
  }, 30 * 60 * 1000); // 30 minutos
}
