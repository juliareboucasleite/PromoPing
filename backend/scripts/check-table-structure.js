import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function checkTableStructure() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "root",
            password: process.env.DB_PASSWORD || "",
            database: process.env.DB_NAME || "pap",
            port: parseInt(process.env.DB_PORT) || 3306
        });

        console.log("Verificando estrutura da tabela utilizadores...\n");

        // Verificar se a tabela existe
        const [tables] = await connection.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('utilizadores', 'Utilizadores')
        `, [process.env.DB_NAME || "pap"]);

        if (tables.length === 0) {
            console.log("Tabela utilizadores não encontrada!");
            await connection.end();
            return;
        }

        const tableName = tables[0].TABLE_NAME;
        console.log(`Tabela encontrada: ${tableName}\n`);

        // Obter estrutura completa
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

        console.log("Colunas encontradas:");
        console.log("===================");
        columns.forEach(col => {
            console.log(`${col.COLUMN_NAME}:`);
            console.log(`  Tipo: ${col.DATA_TYPE}`);
            console.log(`  Nullable: ${col.IS_NULLABLE}`);
            console.log(`  Default: ${col.COLUMN_DEFAULT || "NULL"}`);
            console.log(`  Key: ${col.COLUMN_KEY || "NONE"}`);
            console.log(`  Extra: ${col.EXTRA || "NONE"}`);
            console.log("");
        });

        await connection.end();
    } catch (error) {
        console.error("Erro:", error.message);
        process.exit(1);
    }
}

checkTableStructure();
