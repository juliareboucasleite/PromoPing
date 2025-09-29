// backend/database/models/historico.js
import { pool } from "../db.js";

export async function salvarPreco(produtoId, preco) {
  await pool.query(
    "INSERT INTO historico_precos (produto_id, preco) VALUES (?, ?)",
    [produtoId, preco]
  );
}

export async function ultimoPreco(produtoId) {
  const [rows] = await pool.query(
    "SELECT preco FROM historico_precos WHERE produto_id = ? ORDER BY data_registo DESC LIMIT 1",
    [produtoId]
  );
  return rows.length ? rows[0].preco : null;
}
