// backend/services/atualizarPrecos.js
import { pool } from "../database/db.js";
import { salvarPreco } from "../database/models/historico.js";
import { detectStore } from "../utils/storeDetector.js";

// Função fake de scraping -> trocar pelo real
async function fetchPreco(link) {
  // TODO: aqui vem scraping/API real
  // por enquanto devolve número aleatório pra testar
  return (Math.random() * 1000).toFixed(2);
}

export async function atualizarPrecos(userId = null) {
  try {
    let query = "SELECT * FROM Produtos";
    let params = [];

    if (userId) {
      query += " WHERE UserId = ?";
      params.push(userId);
    }

    const [produtos] = await pool.query(query, params);

    console.log(`🔄 Iniciando atualização de preços para ${produtos.length} produtos...`);

    for (const p of produtos) {
      try {
        const novoPreco = await fetchPreco(p.Link);

        // Atualiza PrecoAtual no produto
        await pool.query(
          "UPDATE Produtos SET PrecoAtual = ?, UpdatedAt = NOW() WHERE Id = ?",
          [novoPreco, p.Id]
        );

        // Salva no histórico
        await salvarPreco(p.Id, novoPreco);

        console.log(`✅ Produto ${p.Nome} atualizado para €${novoPreco}`);
      } catch (produtoError) {
        console.error(`❌ Erro ao atualizar produto ${p.Nome}:`, produtoError);
        // Continua com o próximo produto mesmo se um falhar
      }
    }

    console.log(`🎉 Atualização concluída para ${produtos.length} produtos`);
    return { success: true, produtosAtualizados: produtos.length };
  } catch (err) {
    console.error("Erro ao atualizar preços:", err);
    throw err;
  }
}
