/**
 * Sistema Centralizado de Gerenciamento de Tabelas
 * 
 * Este módulo garante que todas as tabelas necessárias existam na base de dados,
 * recriando-as automaticamente quando necessário usando apenas definições existentes no código.
 * 
 * Regras:
 * - NÃO cria tabelas novas por inferência
 * - Usa apenas definições existentes no código
 * - Garante que ReferenciaID VARCHAR(13) seja usado para identificação de utilizador
 * - Mantém IDs externos (Discord, Twitch, etc.) quando apropriado
 */

import { pool } from './db.js';

/**
 * Obter query original para uso interno (evitar recursão)
 * Acessa pool._originalQuery de forma lazy para evitar referência circular
 * 
 * ATENÇÃO: NÃO MEXA NESSA FUNÇÃO
 * Essa função é importante para evitar loops infinitos ao recriar tabelas
 * Se você modificar, pode criar um loop infinito e derrubar o servidor
 * Deixe esta função como está, ela faz o trabalho corretamente
 */
function getOriginalQuery() {
    // pool._originalQuery é definido em db.js antes de modificar pool.query
    return pool._originalQuery || pool.query.bind(pool);
}

/**
 * Controle de tabelas criadas neste boot
 * Previne múltiplas recriações da mesma tabela
 */
const tablesCreatedThisBoot = new Set();

/**
 * Controle de queries em processo de recuperação
 * Previne loops infinitos de reexecução
 */
const queriesInRecovery = new Set();

/**
 * Mapa de definições de tabelas existentes no código
 * Cada entrada contém:
 * - tableName: Nome da tabela (case-insensitive)
 * - definition: SQL CREATE TABLE
 * - usesReferenciaID: Se a tabela usa ReferenciaID para identificação de utilizador
 * - source: Origem da definição (para logs)
 */
const TABLE_DEFINITIONS = {
    // ... (restante do objeto TABLE_DEFINITIONS sem alteração)
    // Manteve-se toda a definição de tabelas igual acima por extensão de contexto
    // Suprimido neste trecho para foco no pedido
    'utilizadores': { /* ... */ },
    // ... todas as demais definições ...
    'sugestoes': { /* ... */ }
};

/**
 * Verifica se uma tabela existe na base de dados
 */
async function tableExists(tableName) {
    try {
        // Usar query original para evitar recursão
        const originalQuery = getOriginalQuery();
        const [rows] = await originalQuery(
            `SELECT COUNT(*) as count FROM information_schema.tables 
             WHERE table_schema = DATABASE() AND table_name = ?`, [tableName]
        );
        return rows[0].count > 0;
    } catch (error) {
        console.error(`[TABLE MANAGER] Erro ao verificar existência da tabela ${tableName}:`, error);
        return false;
    }
}

/**
 * Obtém a definição de uma tabela (case-insensitive)
 */
function getTableDefinition(tableName) {
    const normalizedName = tableName.toLowerCase();
    return TABLE_DEFINITIONS[normalizedName];
}

/**
 * Recria uma tabela usando sua definição existente
 * Garante que cada tabela é criada no máximo uma vez por boot
 */
async function recreateTable(tableName, forceRecreate = false) {
    const normalizedName = tableName.toLowerCase();

    // Verificar se já foi criada neste boot (a menos que seja forçado)
    if (!forceRecreate && tablesCreatedThisBoot.has(normalizedName)) {
        return false; // Indica que não foi recriada (já existe)
    }

    const definition = getTableDefinition(normalizedName);

    if (!definition) {
        throw new Error(
            `[TABLE MANAGER] Definição não encontrada para a tabela "${normalizedName}". ` +
            `A tabela não será criada automaticamente. ` +
            `Adicione a definição em backend/database/tableManager.js se necessário.`
        );
    }

    try {
        // Remover IF NOT EXISTS para garantir recriação
        const createSql = definition.definition.replace(/CREATE TABLE IF NOT EXISTS/gi, 'CREATE TABLE');

        // Tentar dropar a tabela se existir (pode falhar se não existir, mas não é crítico)
        // Usar query original para evitar recursão
        const originalQuery = getOriginalQuery();
        try {
            await originalQuery(`DROP TABLE IF EXISTS \`${normalizedName}\``);
        } catch (dropError) {
            // Ignorar erros ao dropar (tabela pode não existir)
        }

        // Criar a tabela usando query original para evitar recursão
        await originalQuery(definition.definition);

        // Marcar como criada neste boot
        tablesCreatedThisBoot.add(normalizedName);

        return true;
    } catch (error) {
        console.error(`[TABLE MANAGER] Erro ao criar tabela ${normalizedName}:`, error.message);
        throw error;
    }
}

/**
 * Garante que uma tabela existe, recriando se necessário
 */
async function ensureTable(tableName) {
    const normalizedName = tableName.toLowerCase();
    const exists = await tableExists(normalizedName);

    if (!exists) {
        await recreateTable(normalizedName);
        return true; // Tabela foi criada
    } else {
        return false; // Tabela já existia
    }
}

/**
 * Handler de erro para queries SQL que detecta tabelas ausentes
 * e as recria automaticamente
 * 
 * IMPORTANTE: Recriação automática ocorre APENAS para ER_NO_SUCH_TABLE
 * Outros erros SQL são propagados normalmente
 */
export async function handleTableError(error, tableName = null) {
    // Verificar APENAS ER_NO_SUCH_TABLE (hardening: não recriar para outros erros)
    if (error.code !== 'ER_NO_SUCH_TABLE') {
        // Não é ER_NO_SUCH_TABLE, propagar erro normalmente
        throw error;
    }

    // Tentar extrair nome da tabela do erro se não foi fornecido
    if (!tableName) {
        const msg = error.message || "";
        const match = msg.match(/Table ['`](\w+)['`]/i) || msg.match(/table ['`](\w+)['`]/i);
        if (match) {
            tableName = match[1];
        }
    }

    if (!tableName) {
        throw new Error(
            `[TABLE MANAGER] Erro ER_NO_SUCH_TABLE detectado, mas não foi possível identificar o nome da tabela. ` +
            `Erro original: ${error.message}`
        );
    }

    const normalizedName = tableName.toLowerCase();

    // Verificar se já foi criada neste boot (prevenir loops)
    if (tablesCreatedThisBoot.has(normalizedName)) {
        throw new Error(
            `[TABLE MANAGER] Tabela ${normalizedName} já foi criada neste boot, mas ainda não existe. ` +
            `Possível problema de permissões ou conexão com a base de dados. ` +
            `Erro original: ${error.message}`
        );
    }

    // Verificar se temos definição para esta tabela
    const definition = getTableDefinition(normalizedName);
    if (!definition) {
        throw new Error(
            `[TABLE MANAGER] Tabela "${normalizedName}" não existe e não há definição disponível no código. ` +
            `Adicione a definição em backend/database/tableManager.js se necessário. ` +
            `Erro original: ${error.message}`
        );
    }

    // Recriar a tabela (já tem proteção contra múltiplas criações)
    await recreateTable(normalizedName);
}

/**
 * Wrapper para queries SQL que automaticamente recria tabelas se necessário
 * 
 * IMPORTANTE: Query é reexecutada apenas UMA vez após recriação.
 * Erros subsequentes são propagados normalmente.
 * 
 * ATENÇÃO: NÃO MEXA NESSA FUNÇÃO SEM COMPREENDER SEU FUNCIONAMENTO
 * Esta função faz com que uma tabela ausente seja recriada automaticamente
 * Se você modificar a lógica de prevenção de loops, pode causar loop infinito
 * E isso pode travar o servidor tentando recriar tabela sem parar
 * A parte do queriesInRecovery é ESSENCIAL, não remova
 */
export async function queryWithTableRecovery(sql, params = []) {
    // Criar uma chave única para esta query (para prevenir loops)
    // Esta chave previne loops infinitos
    // Se você alterar como a chave é gerada, pode quebrar a proteção
    const queryKey = `${sql.substring(0, 50)}_${JSON.stringify(params).substring(0, 50)}`;

    // Se esta query já está em processo de recuperação, não tentar novamente
    // Esta verificação é crítica, sem ela pode haver loop infinito
    if (queriesInRecovery.has(queryKey)) {
        throw new Error(
            `[TABLE MANAGER] Query já está em processo de recuperação. ` +
            `Evitando loop infinito. Erro original será propagado.`
        );
    }

    try {
        // Usar query original para evitar recursão infinita
        // NÃO ALTERE ESTA LINHA, usa originalQuery para não criar loop
        const originalQuery = getOriginalQuery();
        return await originalQuery(sql, params);
    } catch (error) {
        // Verificar se é ER_NO_SUCH_TABLE antes de tentar recuperação
        // Só recria tabela se for esse erro específico, outros erros são propagados
        if (error.code === 'ER_NO_SUCH_TABLE') {
            // Marcar query como em recuperação
            // Esta linha previne que a mesma query tente recriar a tabela várias vezes
            queriesInRecovery.add(queryKey);

            try {
                await handleTableError(error);

                // Reexecutar a query APENAS UMA VEZ após recriação (usar original para evitar loop)
                const originalQuery = getOriginalQuery();
                const result = await originalQuery(sql, params);

                // Remover da lista de recuperação após sucesso
                queriesInRecovery.delete(queryKey);

                return result;
            } catch (recoveryError) {
                // Remover da lista mesmo em caso de erro
                queriesInRecovery.delete(queryKey);

                // Propagar erro de recuperação
                throw recoveryError;
            }
        } else {
            // Não é ER_NO_SUCH_TABLE, propagar erro normalmente
            throw error;
        }
    }
}

/**
 * Inicializa todas as tabelas definidas (útil na inicialização do sistema)
 * 
 * Garante que cada tabela é verificada/criada apenas uma vez por boot
 * Cria tabelas em ordem de dependência para evitar erros de foreign key
 */
export async function initializeAllTables() {
    const results = {
        created: [],
        existing: [],
        errors: []
    };

    // Ordem de criação: tabelas base primeiro, depois dependentes
    // Tabelas sem dependências (ou com dependências já criadas)
    const creationOrder = [
        'perfis', // Base - sem dependências
        'planos', // Base - sem dependências
        'lojas', // Base - sem dependências
        'utilizadores', // Base - depende de perfis
        'user_2fa', // Depende de utilizadores (2FA)
        'produtos', // Depende de utilizadores e lojas
        'historicoprecos', // Depende de produtos
        'notificacoes', // Depende de utilizadores e produtos
        'relatorios', // Depende de utilizadores (relatórios de economia)
        'preferenciasnotificacao', // Depende de utilizadores
        'contasconectadas', // Depende de utilizadores
        'configutilizador', // Depende de utilizadores e planos
        'password_reset_tokens', // Depende de utilizadores
        'qr_tokens', // Depende de utilizadores (login por QR)
        'recuperar_senha', // Depende de utilizadores
        'stripe_subscriptions', // Depende de utilizadores
        'supportmessages', // Depende de utilizadores (auto-referência)
        'chat_start', // Depende de utilizadores (chat da start)
        'twitch_channels', // Sem dependências
        'counting_config', // Sem dependências
        'processed_releases', // Sem dependências
        'pages', // Sem dependências
        'webhook_configs', // Sem dependências
        'metricas_sistema', // Sem dependências
        'status_componentes', // Sem dependências
        'incidentes', // Sem dependências
        'atualizacoes', // Sem dependências
        'atualizacoes_sistema', // Sem dependências
        'bugsprojetos', // Sem dependências
        'reviews', // Sem dependências (usa discord_id, não ReferenciaID)
        'newsletter_subscribers', // Sem dependências
        'sugestoes' // Sem dependências
    ];

    // Processar tabelas na ordem definida
    for (const tableName of creationOrder) {
        const definition = TABLE_DEFINITIONS[tableName];
        if (!definition) {
            continue;
        }

        try {
            const exists = await tableExists(tableName);
            if (!exists) {
                const wasCreated = await recreateTable(tableName);

                if (wasCreated) {
                    results.created.push({
                        table: tableName,
                        source: definition.source,
                        status: 'criada'
                    });
                } else {
                    // Já foi criada neste boot (não deveria acontecer, mas protegido)
                    results.existing.push({
                        table: tableName,
                        source: definition.source,
                        status: 'já_criada_neste_boot'
                    });
                }
            } else {
                results.existing.push({
                    table: tableName,
                    source: definition.source,
                    status: 'já_existia'
                });
            }
        } catch (error) {
            console.error(`[TABLE MANAGER] Erro ao inicializar tabela ${tableName}:`, error.message);
            results.errors.push({
                table: tableName,
                source: definition.source,
                error: error.message
            });
        }
    }

    // Processar tabelas que não estão na ordem (caso alguma tenha sido esquecida)
    for (const [tableName, definition] of Object.entries(TABLE_DEFINITIONS)) {
        if (!creationOrder.includes(tableName)) {
            try {
                const exists = await tableExists(tableName);
                if (!exists) {
                    const wasCreated = await recreateTable(tableName);

                    if (wasCreated) {
                        results.created.push({
                            table: tableName,
                            source: definition.source,
                            status: 'criada'
                        });
                    }
                } else {
                    results.existing.push({
                        table: tableName,
                        source: definition.source,
                        status: 'já_existia'
                    });
                }
            } catch (error) {
                console.error(`[TABLE MANAGER] Erro ao inicializar tabela ${tableName}:`, error.message);
                results.errors.push({
                    table: tableName,
                    source: definition.source,
                    error: error.message
                });
            }
        }
    }

    if (results.created.length > 0 || results.errors.length > 0) {
        console.log(`[TABLE MANAGER] Inicialização: ${results.created.length} criadas, ${results.existing.length} existentes${results.errors.length > 0 ? `, ${results.errors.length} erros` : ''}`);
    }

    return results;
}

/**
 * Lista todas as tabelas definidas
 */
export function listDefinedTables() {
    return Object.keys(TABLE_DEFINITIONS).map(name => ({
        name,
        usesReferenciaID: TABLE_DEFINITIONS[name].usesReferenciaID,
        source: TABLE_DEFINITIONS[name].source
    }));
}

export {
    ensureTable,
    recreateTable,
    getTableDefinition,
    tableExists,
    TABLE_DEFINITIONS
};