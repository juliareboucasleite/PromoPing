import { pool } from "../database/db.js";
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
    try {
        const [tables] = await pool.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = current_schema()
             ORDER BY table_name`
        );

        // PG dobra identificadores não-quotados para minúsculas; comparamos case-insensitively.
        const existing = new Set(tables.map(t => String(t.table_name).toLowerCase()));
        console.log(`Total de tabelas encontradas: ${existing.size}\n`);

        const targets = tablesToDrop.filter(name => existing.has(name.toLowerCase()));

        if (targets.length === 0) {
            console.log("Nenhuma tabela duplicada encontrada para remover.\n");
            await pool.end();
            return;
        }

        console.log(`Tabelas duplicadas encontradas (${targets.length}):`);
        targets.forEach(t => console.log(`  - ${t}`));
        console.log("\nATENÇÃO: estas tabelas serão REMOVIDAS permanentemente (CASCADE).");
        console.log("Certifique-se de que não há dados importantes nestas tabelas.\n");

        for (const tableName of targets) {
            const lower = tableName.toLowerCase();
            try {
                // CASCADE em PG já remove foreign keys dependentes — não é preciso passo separado.
                await pool._rawQuery(`DROP TABLE IF EXISTS "${lower}" CASCADE`);
                console.log(`✓ Tabela ${tableName} removida com sucesso`);
            } catch (error) {
                console.error(`✗ Erro ao remover tabela ${tableName}: ${error.message}`);
            }
        }

        console.log("\nProcesso concluído!");
        await pool.end();
    } catch (error) {
        console.error("Erro:", error.message);
        try { await pool.end(); } catch (_) {}
        process.exit(1);
    }
}

dropDuplicateTables();
