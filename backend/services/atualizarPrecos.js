// backend/services/atualizarPrecos.js
import { pool } from "../database/db.js";
import { salvarPreco } from "../database/models/historico.js";
import { detectStore } from "../utils/storeDetector.js";

// Função mock que busca preço atual (aqui tu troca pelo scraping real depois)
async function fetchPreco(link) {
  // Exemplo: gerar preço aleatório para teste
  return (Math.random() * 1000).toFixed(2);
}

// Atualiza todos os produtos de um utilizador respeitando plano
export async function atualizarPrecos(userId) {
  // Buscar plano do utilizador
  const [config] = await pool.query(
    `SELECT p.VerificacaoIntervalo 
     FROM ConfigUtilizador c
     JOIN Planos p ON p.Id = c.PlanoId
     WHERE c.UserId = ?`,
    [userId]
  );

  if (!config.length) return { error: "Plano não encontrado" };

  const intervalo = config[0].VerificacaoIntervalo;

  // Buscar produtos do utilizador
  const [produtos] = await pool.query(
    "SELECT * FROM Produtos WHERE UserId = ?",
    [userId]
  );

  let atualizados = [];

  for (const p of produtos) {
    const ultimaAtualizacao = p.UpdatedAt || new Date(0);
    const agora = new Date();
    const diffHoras = (agora - ultimaAtualizacao) / (1000 * 60 * 60);

    // Premium (intervalo = 0) pode sempre
    if (intervalo === 0 || diffHoras >= intervalo) {
      const novoPreco = await fetchPreco(p.Link);

      // Atualizar Produtos
      await pool.query(
        "UPDATE Produtos SET PrecoAtual = ?, UpdatedAt = NOW() WHERE Id = ?",
        [novoPreco, p.Id]
      );

      // Salvar no histórico
      await salvarPreco(p.Id, novoPreco);

      atualizados.push({
        id: p.Id,
        nome: p.Nome,
        precoNovo: novoPreco,
        loja: detectStore(p.Link).name
      });
    }
  }

  return { status: "ok", atualizados };
}
