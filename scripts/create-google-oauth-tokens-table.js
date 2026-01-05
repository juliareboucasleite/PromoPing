/**
 * Script para criar a tabela google_oauth_tokens
 */

import { pool } from '../backend/database/db.js';

async function createGoogleOAuthTokensTable() {
    try {
        console.log('Criando tabela google_oauth_tokens...\n');

        const sql = `CREATE TABLE IF NOT EXISTS google_oauth_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            token_type VARCHAR(50) DEFAULT 'Bearer',
            expires_at TIMESTAMP NULL,
            scope TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_id (user_id),
            INDEX idx_expires_at (expires_at),
            UNIQUE KEY unique_user_token (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

        try {
            await pool.query(sql);
            console.log('✓ Tabela google_oauth_tokens criada/verificada');
        } catch (err) {
            if (err.code === 'ER_TABLE_EXISTS_ERROR') {
                console.log('⚠ Tabela já existe, continuando...');
            } else {
                throw err;
            }
        }

        // Verificar se a tabela foi criada
        const [tables] = await pool.query(
            "SHOW TABLES LIKE 'google_oauth_tokens'"
        );

        if (tables.length > 0) {
            console.log('\n✅ Tabela google_oauth_tokens criada/verificada com sucesso!');
            
            // Mostrar estrutura da tabela
            const [columns] = await pool.query("DESCRIBE google_oauth_tokens");
            console.log('\n📋 Estrutura da tabela:');
            console.table(columns);
        } else {
            console.log('\n⚠ Tabela não foi criada. Verifique os logs acima.');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao criar tabela:', error.message);
        console.error(error);
        process.exit(1);
    }
}

createGoogleOAuthTokensTable();

