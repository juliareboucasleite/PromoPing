// @ts-nocheck
import { pool } from '../db.js';
import { scrapeProductInfo } from './scrapers/index.js';
import { sendNotification } from './notify.js';

async function updateProductPrice(product) {
  const info = await scrapeProductInfo(product.Link);
  if (info?.preco == null) return null;

  await pool.query(
    'INSERT INTO HistoricoPrecos (ProdutoId, Preco) VALUES (?, ?)',
    [product.Id, info.preco]
  );

  const targetReached = product.PrecoAlvo != null && info.preco <= product.PrecoAlvo;

  return { info, targetReached };
}

export async function runPriceCheckOnce() {
  const [products] = await pool.query(
    'SELECT p.Id, p.UserId, p.Nome, p.Link, p.PrecoAlvo FROM Produtos p'
  );

  for (const p of products) {
    try {
      const result = await updateProductPrice(p);
      if (!result) continue;

      if (result.targetReached) {
        const message = `✅ Meta atingida! ${p.Nome} está por €${result.info.preco}.`;
        // encontrar canal preferido
        const [cfgRows] = await pool.query('SELECT CanalPreferido FROM ConfigUtilizador WHERE UserId=?', [p.UserId]);
        const canal = cfgRows[0]?.CanalPreferido || 'discord';
        await sendNotification({ numero: null, mensagem: message, canal });
        await pool.query('INSERT INTO Notificacoes (UserId, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio) VALUES (?, ?, ?, ?, ?, NOW())', [p.UserId, p.Id, canal, message, true]);
      }
    } catch (e) {
      console.warn('Falha ao atualizar preço:', p.Id, e.message);
    }
  }
}

let intervalRef = null;
export function startPriceChecker() {
  if (intervalRef) return;
  // a cada 30 minutos
  intervalRef = setInterval(() => {
    runPriceCheckOnce().catch(() => {});
  }, 30 * 60 * 1000);
}


