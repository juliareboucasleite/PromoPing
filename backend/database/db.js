import mysql from "mysql2/promise";

// Debug (só em dev)
if (process.env.NODE_ENV !== "production") {
  console.log("🔍 Variáveis de ambiente:");
  console.log("DB_HOST:", process.env.DB_HOST);
  console.log("DB_USER:", process.env.DB_USER);
  console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "***" : "vazio");
  console.log("DB_NAME:", process.env.DB_NAME);
  console.log("DB_PORT:", process.env.DB_PORT);
}

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

// Testar conexão inicial
pool.getConnection()
  .then((connection) => {
    console.log("✅ Conectado à base de dados MySQL");
    connection.release();
  })
  .catch((error) => {
    console.error("❌ Erro ao conectar à base de dados MySQL:", error.message);
    process.exit(1);
  });

export { pool };
