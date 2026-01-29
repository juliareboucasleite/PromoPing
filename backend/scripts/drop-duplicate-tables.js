import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Tabelas duplicadas a serem removidas (versões com underscores ou maiúsculas)
const tablesToDrop = [
    'bugs_projetos',      // manter: bugsprojetos
    'config_utilizador',  // manter: configutilizador
    'contas_conectadas',  // manter: contasconectadas
    'historico_precos',   // manter: historicoprecos
    'suporte_mensagens',  // manter: supportmessages
    'suporte_threads',    // manter: supportmessages (threads são parte de supportmessages)
    'BugsProjetos',       // manter: bugsprojetos
    'ConfigUtilizador',   // manter: configutilizador
    'ContasConectadas',   // manter: contasconectadas
    'HistoricoPrecos',    // manter: historicoprecos
    'SupportMessages',    // manter: supportmessages
    'SuporteMensagens',   // manter: supportmessages
    'SuporteThreads'      // manter: supportmessages
];

async function dropDuplicateTables() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "root",
            password: process.env.DB_PASSWORD || "",
            database: process.env.DB_NAME || "papv5",
            port: parseInt(process.env.DB_PORT) || 3306
        });

        console.log("Verificando tabelas duplicadas...\n");

        // Verificar quais tabelas existem
        const [tables] = await connection.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ?
            ORDER BY TABLE_NAME
        `, [process.env.DB_NAME || "papv5"]);

        const existingTables = tables.map(t => t.TABLE_NAME);
        console.log(`Total de tabelas encontradas: ${existingTables.length}\n`);

        // Filtrar apenas as tabelas que existem e devem ser removidas
        const tablesToRemove = tablesToDrop.filter(tableName => 
            existingTables.includes(tableName)
        );

        if (tablesToRemove.length === 0) {
            console.log("Nenhuma tabela duplicada encontrada para remover.\n");
            await connection.end();
            return;
        }

        console.log(`Tabelas duplicadas encontradas (${tablesToRemove.length}):`);
        tablesToRemove.forEach(table => console.log(`  - ${table}`));
        console.log("\n");

        // Confirmar antes de remover
        console.log("ATENÇÃO: Estas tabelas serão REMOVIDAS permanentemente!");
        console.log("Certifique-se de que não há dados importantes nestas tabelas.\n");

        // Remover foreign keys primeiro (se existirem)
        for (const tableName of tablesToRemove) {
            try {
                // Verificar foreign keys
                const [fks] = await connection.query(`
                    SELECT CONSTRAINT_NAME
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                    WHERE TABLE_SCHEMA = ? 
                    AND TABLE_NAME = ?
                    AND REFERENCED_TABLE_NAME IS NOT NULL
                `, [process.env.DB_NAME || "papv5", tableName]);

                // Remover foreign keys
                for (const fk of fks) {
                    try {
                        await connection.query(`ALTER TABLE ?? DROP FOREIGN KEY ??`, [tableName, fk.CONSTRAINT_NAME]);
                        console.log(`  Foreign key ${fk.CONSTRAINT_NAME} removida de ${tableName}`);
                    } catch (error) {
                        // Ignorar se não existir
                        if (!error.message.includes("Unknown key")) {
                            console.log(`  Aviso ao remover FK ${fk.CONSTRAINT_NAME}: ${error.message}`);
                        }
                    }
                }
            } catch (error) {
                console.log(`  Aviso ao verificar FKs de ${tableName}: ${error.message}`);
            }
        }

        // Remover tabelas
        for (const tableName of tablesToRemove) {
            try {
                await connection.query(`DROP TABLE IF EXISTS ??`, [tableName]);
                console.log(`✓ Tabela ${tableName} removida com sucesso`);
            } catch (error) {
                console.error(`✗ Erro ao remover tabela ${tableName}: ${error.message}`);
            }
        }

        console.log("\nProcesso concluído!");

        await connection.end();
    } catch (error) {
        console.error("Erro:", error.message);
        if (connection) {
            await connection.end();
        }
        process.exit(1);
    }
}

dropDuplicateTables();
