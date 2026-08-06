import { pool } from "../backend/database/db.js";

const [standard] = await pool.query(
  "UPDATE planos SET intervaloverificacao = '2' WHERE LOWER(nome) = 'standard' RETURNING id, nome, intervaloverificacao"
);
const [premium] = await pool.query(
  "UPDATE planos SET intervaloverificacao = '1' WHERE LOWER(nome) = 'premium' RETURNING id, nome, intervaloverificacao"
);

console.log("Standard atualizado:", standard);
console.log("Premium atualizado:", premium);
await pool.end();
