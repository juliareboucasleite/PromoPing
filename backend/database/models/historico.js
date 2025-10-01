// backend/database/models/historico.js
import { pool } from "../db.js";

export async function salvarPreco(produtoId, preco) {
  await pool.query(
    `INSERT INTO HistoricoPrecos (ProdutoId, Preco, DataRegisto) 
     VALUES (?, ?, NOW())`,
    [produtoId, preco]
  );
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
