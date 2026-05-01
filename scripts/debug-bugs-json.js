import { pool } from "../backend/database/db.js";

const [bugs] = await pool.query(
  `SELECT
    Id AS "Id",
    Titulo AS "Titulo",
    Descricao AS "Descricao",
    Tipo AS "Tipo",
    Prioridade AS "Prioridade",
    Status AS "Status",
    DataCriacao AS "DataCriacao"
   FROM bugsprojetos
  ORDER BY DataCriacao DESC
  LIMIT 2`
);

console.log("RAW row keys:", Object.keys(bugs[0] || {}));
console.log("RAW row.Titulo:", bugs[0] && bugs[0].Titulo);
console.log("RAW row.titulo:", bugs[0] && bugs[0].titulo);
console.log("JSON:", JSON.stringify(bugs, null, 2));

await pool.end();
