/**
 * Sistema Centralizado de Gerenciamento de Tabelas (PostgreSQL)
 *
 * Garante que todas as tabelas necessárias existam, recriando-as automaticamente
 * quando uma query bate com tabela inexistente.
 *
 * Regras:
 * - NÃO cria tabelas novas por inferência
 * - Usa apenas definições existentes em TABLE_DEFINITIONS
 */

import { pool } from './db.js';

/**
 * Acessa a query original (sem recovery) para evitar recursão.
 * Em PG, pool._originalQuery devolve [rows, fields] como o mysql2.
 */
function getOriginalQuery() {
    return pool._originalQuery;
}

const tablesCreatedThisBoot = new Set();
const queriesInRecovery = new Set();

/**
 * Definições de tabelas (vazio por padrão — base é criada via sql/PAPv5.sql).
 * Adicione entradas aqui se quiser auto-recovery para uma tabela específica:
 *   { definition: 'CREATE TABLE IF NOT EXISTS x (...)', usesReferenciaID: false, source: 'manual' }
 */
const TABLE_DEFINITIONS = {};

async function tableExists(tableName) {
    try {
        const originalQuery = getOriginalQuery();
        const [rows] = await originalQuery(
            `SELECT COUNT(*)::int AS count FROM information_schema.tables
             WHERE table_schema = current_schema() AND table_name = ?`,
            [tableName.toLowerCase()]
        );
        return rows[0].count > 0;
    } catch (error) {
        console.error(`[TABLE MANAGER] Erro ao verificar existência da tabela ${tableName}:`, error);
        return false;
    }
}

function getTableDefinition(tableName) {
    return TABLE_DEFINITIONS[tableName.toLowerCase()];
}

async function recreateTable(tableName, forceRecreate = false) {
    const normalizedName = tableName.toLowerCase();

    if (!forceRecreate && tablesCreatedThisBoot.has(normalizedName)) {
        return false;
    }

    const definition = getTableDefinition(normalizedName);
    if (!definition) {
        throw new Error(
            `[TABLE MANAGER] Definição não encontrada para "${normalizedName}". ` +
            `Adicione em backend/database/tableManager.js TABLE_DEFINITIONS.`
        );
    }

    try {
        const originalQuery = getOriginalQuery();
        try {
            await originalQuery(`DROP TABLE IF EXISTS "${normalizedName}" CASCADE`);
        } catch (_) {}
        await originalQuery(definition.definition);
        tablesCreatedThisBoot.add(normalizedName);
        return true;
    } catch (error) {
        console.error(`[TABLE MANAGER] Erro ao criar tabela ${normalizedName}:`, error.message);
        throw error;
    }
}

async function ensureTable(tableName) {
    const normalizedName = tableName.toLowerCase();
    const exists = await tableExists(normalizedName);
    if (!exists) {
        await recreateTable(normalizedName);
        return true;
    }
    return false;
}

/**
 * Detecta erro "tabela não existe":
 *   PG: code === '42P01' (UndefinedTable)
 *   Mensagem típica: `relation "xxx" does not exist`
 */
function isUndefinedTableError(error) {
    return error && (error.code === '42P01' || error.code === 'ER_NO_SUCH_TABLE');
}

function extractMissingTableName(error) {
    const msg = error?.message || '';
    const m = msg.match(/relation "([^"]+)" does not exist/i)
           || msg.match(/Table ['`]([^'`]+)['`]/i);
    return m ? m[1] : null;
}

export async function handleTableError(error, tableName = null) {
    if (!isUndefinedTableError(error)) {
        throw error;
    }

    if (!tableName) {
        tableName = extractMissingTableName(error);
    }
    if (!tableName) {
        throw new Error(
            `[TABLE MANAGER] Erro de tabela inexistente sem nome identificável. Original: ${error.message}`
        );
    }

    const normalizedName = tableName.toLowerCase();

    if (tablesCreatedThisBoot.has(normalizedName)) {
        throw new Error(
            `[TABLE MANAGER] Tabela ${normalizedName} já foi criada neste boot mas ainda não existe. ` +
            `Verifique permissões. Original: ${error.message}`
        );
    }

    const definition = getTableDefinition(normalizedName);
    if (!definition) {
        throw new Error(
            `[TABLE MANAGER] Tabela "${normalizedName}" inexistente e sem definição em TABLE_DEFINITIONS. ` +
            `Original: ${error.message}`
        );
    }

    await recreateTable(normalizedName);
}

export async function queryWithTableRecovery(sql, params = []) {
    const queryKey = `${sql.substring(0, 50)}_${JSON.stringify(params).substring(0, 50)}`;

    if (queriesInRecovery.has(queryKey)) {
        throw new Error(
            `[TABLE MANAGER] Query já em recuperação. Evitando loop. Original será propagado.`
        );
    }

    try {
        const originalQuery = getOriginalQuery();
        return await originalQuery(sql, params);
    } catch (error) {
        if (isUndefinedTableError(error)) {
            queriesInRecovery.add(queryKey);
            try {
                await handleTableError(error);
                const originalQuery = getOriginalQuery();
                const result = await originalQuery(sql, params);
                queriesInRecovery.delete(queryKey);
                return result;
            } catch (recoveryError) {
                queriesInRecovery.delete(queryKey);
                throw recoveryError;
            }
        }
        throw error;
    }
}

export async function initializeAllTables() {
    const results = { created: [], existing: [], errors: [] };

    for (const [tableName, definition] of Object.entries(TABLE_DEFINITIONS)) {
        try {
            const exists = await tableExists(tableName);
            if (!exists) {
                const wasCreated = await recreateTable(tableName);
                if (wasCreated) {
                    results.created.push({ table: tableName, source: definition.source, status: 'criada' });
                }
            } else {
                results.existing.push({ table: tableName, source: definition.source, status: 'já_existia' });
            }
        } catch (error) {
            console.error(`[TABLE MANAGER] Erro ao inicializar tabela ${tableName}:`, error.message);
            results.errors.push({ table: tableName, source: definition.source, error: error.message });
        }
    }

    if (results.created.length > 0 || results.errors.length > 0) {
        console.log(
            `[TABLE MANAGER] Inicialização: ${results.created.length} criadas, ` +
            `${results.existing.length} existentes` +
            (results.errors.length > 0 ? `, ${results.errors.length} erros` : '')
        );
    }
    return results;
}

export function listDefinedTables() {
    return Object.keys(TABLE_DEFINITIONS).map(name => ({
        name,
        usesReferenciaID: TABLE_DEFINITIONS[name].usesReferenciaID,
        source: TABLE_DEFINITIONS[name].source,
    }));
}

export {
    ensureTable,
    recreateTable,
    getTableDefinition,
    tableExists,
    TABLE_DEFINITIONS,
};
