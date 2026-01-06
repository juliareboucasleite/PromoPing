/**
 * Script para criar a tabela de reviews no banco de dados
 * Execute: node scripts/create-reviews-table.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pap',
    port: parseInt(process.env.DB_PORT) || 3306
};

async function createReviewsTable() {
    let connection;
    try {
        console.log('[REVIEWS TABLE] Conectando ao banco de dados...');
        connection = await mysql.createConnection(dbConfig);

        console.log('[REVIEWS TABLE] Criando tabela reviews...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                discord_user_id VARCHAR(20) NOT NULL,
                discord_username VARCHAR(100) NOT NULL,
                discord_avatar_url VARCHAR(500) NULL,
                tipo ENUM('site', 'bot', 'suporte') NOT NULL,
                texto TEXT NOT NULL,
                rating INT NULL,
                is_anonimo TINYINT(1) DEFAULT 0,
                discord_channel_id VARCHAR(20) NULL,
                discord_message_id VARCHAR(20) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_discord_user_id (discord_user_id),
                INDEX idx_tipo (tipo),
                INDEX idx_rating (rating),
                INDEX idx_created_at (created_at),
                INDEX idx_is_anonimo (is_anonimo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('[REVIEWS TABLE] ✅ Tabela reviews criada com sucesso!');
        
        // Verificar se a tabela foi criada
        const [tables] = await connection.execute("SHOW TABLES LIKE 'reviews'");
        if (tables.length > 0) {
            console.log('[REVIEWS TABLE] ✅ Tabela verificada e existe no banco de dados');
        }

    } catch (error) {
        console.error('[REVIEWS TABLE] ❌ Erro ao criar tabela:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

createReviewsTable();

