import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function checkTablesStructure() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "root",
            password: process.env.DB_PASSWORD || "",
            database: process.env.DB_NAME || "pap",
            port: parseInt(process.env.DB_PORT) || 3306
        });

        const tablesToCheck = ['configutilizador', 'supportmessages'];
        
        for (const tableName of tablesToCheck) {
            console.log(`\n=== Verificando tabela: ${tableName} ===\n`);
            
            // Verificar se existe
            const [tables] = await connection.query(`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            `, [process.env.DB_NAME || "pap", tableName]);

            if (tables.length === 0) {
                console.log(`Tabela ${tableName} NÃO existe!\n`);
                continue;
            }

            // Obter estrutura
            const [columns] = await connection.query(`
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    COLUMN_DEFAULT,
                    COLUMN_KEY,
                    EXTRA
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
            `, [process.env.DB_NAME || "pap", tableName]);

            console.log("Colunas:");
            columns.forEach(col => {
                console.log(`  ${col.COLUMN_NAME} (${col.DATA_TYPE}) - Key: ${col.COLUMN_KEY || "NONE"}`);
            });

            // Verificar foreign keys
            const [fks] = await connection.query(`
                SELECT 
                    CONSTRAINT_NAME,
                    COLUMN_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = ? 
                AND TABLE_NAME = ?
                AND REFERENCED_TABLE_NAME IS NOT NULL
            `, [process.env.DB_NAME || "pap", tableName]);

            if (fks.length > 0) {
                console.log("\nForeign Keys:");
                fks.forEach(fk => {
                    console.log(`  ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
                });
            }
        }

        await connection.end();
    } catch (error) {
        console.error("Erro:", error.message);
        process.exit(1);
    }
}

checkTablesStructure();
