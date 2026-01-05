/**
 * Script para criar a tabela admin_events
 * Executa o SQL do arquivo create_admin_events.sql
 */

import { pool } from '../backend/database/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createAdminEventsTable() {
    try {
        console.log('Criando tabela admin_events...\n');

        // Ler o arquivo SQL
        const sqlFile = path.join(__dirname, '..', 'sql', 'create_admin_events.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');

        // Remover a primeira linha (comentário Active)
        const cleanSql = sqlContent
            .split('\n')
            .filter(line => !line.trim().startsWith('-- Active:'))
            .join('\n');

        // Executar CREATE TABLE
        const createTableSql = `CREATE TABLE IF NOT EXISTS admin_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            type ENUM('scraper', 'bug', 'maintenance', 'deploy', 'milestone') DEFAULT 'maintenance',
            start_date DATETIME NOT NULL,
            end_date DATETIME NULL,
            status ENUM('scheduled', 'in-progress', 'completed', 'cancelled') DEFAULT 'scheduled',
            created_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_start_date (start_date),
            INDEX idx_end_date (end_date),
            INDEX idx_type (type),
            INDEX idx_status (status),
            INDEX idx_created_by (created_by)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

        try {
            await pool.query(createTableSql);
            console.log('✓ Tabela admin_events criada/verificada');
        } catch (err) {
            if (err.code === 'ER_TABLE_EXISTS_ERROR') {
                console.log('⚠ Tabela já existe, continuando...');
            } else {
                throw err;
            }
        }

        // Verificar se foreign key já existe e tentar adicionar se não existir
        try {
            const [constraints] = await pool.query(`
                SELECT CONSTRAINT_NAME 
                FROM information_schema.TABLE_CONSTRAINTS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'admin_events' 
                AND CONSTRAINT_TYPE = 'FOREIGN KEY'
                AND CONSTRAINT_NAME LIKE 'fk_%'
            `);
            
            if (constraints.length === 0) {
                // Tentar adicionar foreign key
                await pool.query(`
                    ALTER TABLE admin_events 
                    ADD CONSTRAINT fk_admin_events_created_by 
                    FOREIGN KEY (created_by) REFERENCES Utilizadores(Id) ON DELETE RESTRICT
                `);
                console.log('✓ Foreign key criada');
            } else {
                console.log('✓ Foreign key já existe');
            }
        } catch (err) {
            if (err.code === 'ER_DUP_KEY' || err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                console.log('Foreign key já existe, continuando...');
            } else if (err.code === 'ER_NO_SUCH_TABLE') {
                console.log('Tabela Utilizadores não encontrada, foreign key não será criada');
            } else {
                console.log('Aviso ao criar foreign key (não crítico):', err.message);
            }
        }

        // Adicionar comentários nas colunas
        const alterStatements = [
            "ALTER TABLE admin_events MODIFY COLUMN title VARCHAR(200) NOT NULL COMMENT 'Título do evento'",
            "ALTER TABLE admin_events MODIFY COLUMN description TEXT COMMENT 'Descrição detalhada do evento'",
            "ALTER TABLE admin_events MODIFY COLUMN type ENUM('scraper', 'bug', 'maintenance', 'deploy', 'milestone') DEFAULT 'maintenance' COMMENT 'Tipo de evento administrativo'",
            "ALTER TABLE admin_events MODIFY COLUMN start_date DATETIME NOT NULL COMMENT 'Data e hora de início'",
            "ALTER TABLE admin_events MODIFY COLUMN end_date DATETIME NULL COMMENT 'Data e hora de fim (opcional)'",
            "ALTER TABLE admin_events MODIFY COLUMN status ENUM('scheduled', 'in-progress', 'completed', 'cancelled') DEFAULT 'scheduled' COMMENT 'Status do evento'",
            "ALTER TABLE admin_events MODIFY COLUMN created_by INT NOT NULL COMMENT 'ID do administrador que criou o evento'"
        ];

        for (const stmt of alterStatements) {
            try {
                await pool.query(stmt);
            } catch (err) {
                // Ignorar erros de coluna já modificada
                console.log('Comentário já aplicado ou erro ignorado');
            }
        }
        console.log('Comentários nas colunas aplicados');

        // Verificar se a tabela foi criada
        const [tables] = await pool.query(
            "SHOW TABLES LIKE 'admin_events'"
        );

        if (tables.length > 0) {
            console.log('\nTabela admin_events criada/verificada com sucesso!');
            
            // Mostrar estrutura da tabela
            const [columns] = await pool.query("DESCRIBE admin_events");
            console.log('\nEstrutura da tabela:');
            console.table(columns);
        } else {
            console.log('\n⚠ Tabela não foi criada. Verifique os logs acima.');
        }

        process.exit(0);
    } catch (error) {
        console.error('\nErro ao criar tabela:', error.message);
        console.error(error);
        process.exit(1);
    }
}

createAdminEventsTable();

