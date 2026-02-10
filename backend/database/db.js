import mysql from "mysql2/promise";
import { queryWithTableRecovery } from "./tableManager.js";

// Debug removido para logs mais limpos

//  ZONA CRÍTICA: CONEXÃO COM BANCO
// Se alterar essa configuração do pool sem saber o que está fazendo,
// pode prejudicar todas as conexões e derrubar o sistema inteiro
// Deixe essa parte como está, pois está funcionando perfeitamente
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "papv5",
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10, // Não aumente isso sem entender o impacto, pode sobrecarregar o MySQL
  queueLimit: 0,
});

// ATENÇÃO: ESSA PARTE É MUITO IMPORTANTE
// Guardar referência ao query original para uso interno ANTES de modificar pool.query
// Isso evita referências circulares e permite que tableManager use a query original
// Se alterar isso, pode criar um loop infinito e prejudicar tudo
// NÃO ALTERE ESSA PARTE
const originalQuery = pool.query.bind(pool);

// Exportar query original para uso interno do tableManager ANTES de modificar pool.query
// Essa linha aqui é essencial, sem ela o tableManager não funciona
pool._originalQuery = originalQuery;

// Wrapper para pool.query que automaticamente recria tabelas se necessário
// Usa queryWithTableRecovery que já tem proteção contra loops infinitos
// Essa função aqui é importante, deixe ela cuidando dessa tarefa
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
