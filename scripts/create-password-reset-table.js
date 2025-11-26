import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function createPasswordResetTable() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pap',
      port: parseInt(process.env.DB_PORT) || 3306
    });

    console.log('Conectado ao banco de dados');

    // Verificar estrutura da tabela Utilizadores
    const [tables] = await connection.query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('Utilizadores', 'utilizadores')
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `, [process.env.DB_NAME || 'pap']);

    console.log('Tabelas encontradas:', tables);

    // Determinar nome correto da tabela e coluna
    const userTable = tables.find(t => t.TABLE_NAME.toLowerCase() === 'utilizadores')?.TABLE_NAME || 'Utilizadores';
    const userIdColumn = tables.find(t => t.COLUMN_KEY === 'PRI')?.COLUMN_NAME || 'Id';

    console.log(`Usando tabela: ${userTable}, coluna ID: ${userIdColumn}`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        UserId INT(10) UNSIGNED NOT NULL,
        Token VARCHAR(255) NOT NULL UNIQUE,
        Email VARCHAR(255) NOT NULL,
        ExpiresAt TIMESTAMP NOT NULL,
        Used BOOLEAN DEFAULT FALSE,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (Token),
        INDEX idx_user_id (UserId),
        INDEX idx_email (Email),
        INDEX idx_expires_at (ExpiresAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Adicionar foreign key separadamente se não existir
    try {
      await connection.query(`
        ALTER TABLE password_reset_tokens
        ADD CONSTRAINT fk_password_reset_user
        FOREIGN KEY (UserId) REFERENCES ${userTable}(${userIdColumn})
        ON DELETE CASCADE
      `);
      console.log('Foreign key adicionada com sucesso');
    } catch (fkError) {
      if (fkError.code === 'ER_DUP_KEY' || fkError.message.includes('Duplicate key')) {
        console.log('Foreign key já existe, continuando...');
      } else {
        console.log('Aviso: Não foi possível adicionar foreign key (pode já existir):', fkError.message);
      }
    }

    console.log('✅ Tabela password_reset_tokens criada/verificada com sucesso!');

    await connection.end();
  } catch (error) {
    console.error('❌ Erro ao criar tabela:', error);
    process.exit(1);
  }
}

createPasswordResetTable();

