// backend/database/models/historico.js
import { pool } from "../db.js";
import { processAlerts } from "../../services/alerts.js";

export async function salvarPreco(produtoId, preco) {
  // Buscar preço anterior antes de inserir o novo
  const [produtoRows] = await pool.query(
    `SELECT p.*, 
     (SELECT Preco FROM HistoricoPrecos WHERE ProdutoId = p.Id ORDER BY DataRegisto DESC LIMIT 1) as PrecoAnterior
     FROM Produtos p WHERE p.Id = ?`,
    [produtoId]
  );

  const produto = produtoRows[0];
  const precoAnterior = produto?.PrecoAnterior || produto?.PrecoAtual || null;

  // Inserir novo preço no histórico
  await pool.query(
    `INSERT INTO HistoricoPrecos (ProdutoId, Preco, DataRegisto) 
     VALUES (?, ?, NOW())`,
    [produtoId, preco]
  );

  // Atualizar preço atual do produto
  await pool.query(
    `UPDATE Produtos SET PrecoAtual = ?, UpdatedAt = NOW() WHERE Id = ?`,
    [preco, produtoId]
  );

  // Processar alertas se houver produto encontrado
  if (produto) {
    try {
      await processAlerts(produto, preco, precoAnterior);
    } catch (error) {
      console.error(`[HISTORICO] Erro ao processar alertas para produto ${produtoId}:`, error);
      // Não falhar a inserção se os alertas falharem
    }
  }
}

export async function ultimoPreco(produtoId) {
  const [rows] = await pool.query(
    `SELECT Preco 
     FROM HistoricoPrecos 
     WHERE ProdutoId = ? 
     ORDER BY DataRegisto DESC 
     LIMIT 1`,
    [produtoId]
  );
  return rows.length ? rows[0].Preco : null;
}
