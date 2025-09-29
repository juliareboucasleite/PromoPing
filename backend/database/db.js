import mysql from 'mysql2/promise';

// Criar pool de conexões
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "pap",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Testar conexão
pool.getConnection()
  .then(connection => {
    console.log('Conectado à base de dados MySQL');
    connection.release();
  })
  .catch(error => {
    console.error('Erro ao conectar à base de dados MySQL:', error.message);
    process.exit(1);
  });

export { pool };