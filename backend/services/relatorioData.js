/**
 * Dados partilhados para Relatório e Histórico (evita duplicação de queries e lógica).
 * Exporta obterDadosRelatorio(referenciaID, dataInicio, dataFim) → { user, produtos, totais, periodo }.
 */

import { pool } from "../database/db.js";

function parseDateInput(value, label) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
        throw new Error(`Data invalida para ${label}`);
    }
    return parsed;
}

function buildHistoricoMap(rows) {
    const map = new Map();
    for (const row of rows) {
        const list = map.get(row.ProdutoId) || [];
        list.push({
            preco: Number(row.Preco),
            data: row.DataRegisto instanceof Date ? row.DataRegisto : new Date(row.DataRegisto)
        });
        map.set(row.ProdutoId, list);
    }
    return map;
}

function calcularPrecoInicial(lista, dataInicio) {
    if (!lista || lista.length === 0) return null;
    const emIntervalo = lista.find((item) => item.data >= dataInicio);
    if (emIntervalo) return emIntervalo.preco;
    return lista[0].preco;
}

/**
 * Obtém os dados comuns para gerar PDF de relatório ou histórico.
 * @returns { Promise<{ user: object, produtos: array, totais: object, periodo: { inicio: Date, fim: Date } }> }
 */
export async function obterDadosRelatorio({ referenciaID, dataInicio, dataFim }) {
    const inicio = parseDateInput(dataInicio, "data_inicio");
    const fim = parseDateInput(dataFim, "data_fim");

    if (inicio > fim) {
        throw new Error("data_inicio nao pode ser maior que data_fim");
    }

    const [userRows] = await pool.query(
        `SELECT u.ReferenciaID, u.Nome, u.Email, u.DataRegisto, COALESCE(p.Nome, 'Free') as Plano
         FROM utilizadores u
         LEFT JOIN configutilizador c ON c.ReferenciaID = u.ReferenciaID
         LEFT JOIN planos p ON p.Id = COALESCE(c.PlanoAtivoId, c.PlanoAtualId)
         WHERE u.ReferenciaID = ?
         LIMIT 1`,
        [referenciaID]
    );

    if (userRows.length === 0) {
        throw new Error("Utilizador nao encontrado");
    }

    const userRow = userRows[0];

    const [produtosRows] = await pool.query(
        `SELECT p.Id, p.Nome, p.PrecoAtual, p.PrecoAlvo, p.CreatedAt, p.DeletedAt,
                COALESCE(l.Nome, '-') as LojaNome
         FROM produtos p
         LEFT JOIN lojas l ON l.Id = p.LojaId
         WHERE p.ReferenciaID = ? AND (p.DeletedAt IS NULL)
         ORDER BY p.CreatedAt ASC`,
        [referenciaID]
    );

    if (produtosRows.length === 0) {
        throw new Error("Nenhum produto monitorizado encontrado para este utilizador");
    }

    const productIds = produtosRows.map((p) => p.Id);
    let historicoMap = new Map();

    if (productIds.length > 0) {
        const inPlaceholders = productIds.map(() => "?").join(",");
        const [histRows] = await pool.query(
            `SELECT ProdutoId, Preco, DataRegisto
             FROM historicoprecos
             WHERE ProdutoId IN (${inPlaceholders}) AND DataRegisto <= ?
             ORDER BY DataRegisto ASC`,
            [...productIds, fim]
        );
        historicoMap = buildHistoricoMap(histRows);
    }

    const produtos = produtosRows.map((produto) => {
        const listaHistorico = historicoMap.get(produto.Id) || [];
        const precoInicial = calcularPrecoInicial(listaHistorico, inicio) ?? (Number(produto.PrecoAtual) || 0);
        const precoAtual = produto.PrecoAtual != null ? Number(produto.PrecoAtual) : precoInicial;
        const precoAlvo = produto.PrecoAlvo != null ? Number(produto.PrecoAlvo) : 0;
        const poupanca = Math.max(precoInicial - precoAtual, 0);

        return {
            id: produto.Id,
            nome: produto.Nome,
            loja: produto.LojaNome || "-",
            precoInicial,
            precoAtual,
            precoAlvo,
            poupanca
        };
    });

    const totalPoupado = produtos.reduce((acc, p) => acc + p.poupanca, 0);

    const [[alertaRow]] = await pool.query(
        `SELECT COUNT(*) as total FROM notificacoes
         WHERE ReferenciaID = ? AND DataEnvio BETWEEN ? AND ?`,
        [referenciaID, inicio, fim]
    );

    const totais = {
        produtos: produtos.length,
        alertas: alertaRow && typeof alertaRow.total !== "undefined" ? Number(alertaRow.total) : 0,
        poupado: Number(totalPoupado.toFixed(2))
    };

    const user = {
        nome: userRow.Nome,
        email: userRow.Email,
        plano: userRow.Plano || "Free",
        membroDesde: userRow.DataRegisto instanceof Date ? userRow.DataRegisto : new Date(userRow.DataRegisto)
    };

    return {
        user,
        produtos,
        totais,
        periodo: { inicio, fim }
    };
}
