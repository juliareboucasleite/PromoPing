import mysql from "mysql2/promise";
import { queryWithTableRecovery } from "./tableManager.js";

// Debug removido para logs mais limpos

// Criar pool de conexões
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "pap",
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Guardar referência ao query original para uso interno ANTES de modificar pool.query
// Isso evita referências circulares e permite que tableManager use a query original
const originalQuery = pool.query.bind(pool);

// Exportar query original para uso interno do tableManager ANTES de modificar pool.query
pool._originalQuery = originalQuery;

// Wrapper para pool.query que automaticamente recria tabelas se necessário
// Usa queryWithTableRecovery que já tem proteção contra loops infinitos
pool.query = async function(sql, params) {
  return await queryWithTableRecovery(sql, params);
};

// Testar conexão inicial (silencioso)
pool.getConnection()
  .then((connection) => {
    connection.release();
  })
  .catch((error) => {
    console.error(" Erro ao conectar à base de dados MySQL:", error.message);
    process.exit(1);
  });

export { pool };
