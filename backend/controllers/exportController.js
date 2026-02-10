import {
    gerarPDF
} from "../utils/gerarPDF.js";
import {
    pool as db
} from "../database/db.js";

/**
 * Exportar produtos para PDF
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export async function exportarPDF(req, res) {
    try {
        const referenciaID = req.user.ReferenciaID;
        const userPlano = (req.user && req.user.plano && req.user.plano.nome) ? req.user.plano.nome : "Free";

        console.log(` Exportando PDF para usuário ${referenciaID} (plano: ${userPlano})`);

        //  Definir o intervalo do histórico conforme o plano
        const dias = userPlano === "Basic" ? 30 : null;
        const incluirHistorico = ["Basic", "Standard", "Premium"].includes(userPlano);

        // Buscar produtos do usuário (Loja via JOIN com lojas)
        const [produtos] = await db.query(`
      SELECT 
        p.Id,
        p.Nome, 
        p.Link, 
        p.PrecoAtual, 
        p.PrecoAlvo, 
        COALESCE(l.Nome, 'Loja') AS Loja,
        p.CreatedAt AS DataCriacao,
        'Ativo' AS Status
      FROM produtos p
      LEFT JOIN lojas l ON l.Id = p.LojaId
      WHERE p.ReferenciaID = ? AND (p.DeletedAt IS NULL)
      ORDER BY p.CreatedAt DESC
    `, [referenciaID]);

        if (produtos.length === 0) {
            const buffer = await gerarPDF([], [], userPlano);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            res.setHeader("Content-Disposition", `attachment; filename="produtos_promoping_${timestamp}.pdf"`);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Length", buffer.length);
            return res.send(buffer);
        }

        // Buscar histórico de preços se permitido pelo plano
        let historico = [];
        if (incluirHistorico) {
            console.log(` Buscando histórico de preços (${dias ? `últimos ${dias} dias` : 'completo'})`);

            for (const produto of produtos) {
                const [hist] = await db.query(`
          SELECT ProdutoId, Preco, DataRegisto as Data
          FROM historicoprecos
          WHERE ProdutoId = ?
          ${dias ? "AND DataRegisto >= DATE_SUB(NOW(), INTERVAL ? DAY)" : ""}
          ORDER BY DataRegisto DESC
        `, dias ? [produto.Id, dias] : [produto.Id]);

                historico.push({
                    produtoId: produto.Id,
                    registos: hist,
                    totalRegistros: hist.length
                });
            }
        }

        // Gerar arquivo PDF com histórico
        const buffer = await gerarPDF(produtos, historico, userPlano);

        // Configurar headers para download
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `produtos_promoping_${timestamp}.pdf`;

        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);

    } catch (err) {
        console.error(" Erro ao exportar PDF:", err);
        res.status(500).json({
            status: "error",
            message: "Erro ao gerar arquivo PDF",
            error: err.message
        });
    }
}

/**
 * Exportar relatório completo (Premium) em PDF
 * Produtos com histórico completo, mesmo layout do PDF de produtos.
 */
export async function exportarRelatorioCompleto(req, res) {
    try {
        const referenciaID = req.user.ReferenciaID;
        const userPlano = (req.user && req.user.plano && req.user.plano.nome) ? req.user.plano.nome : "Premium";
        const [produtos] = await db.query(`
      SELECT 
        p.Id,
        p.Nome, 
        p.Link, 
        p.PrecoAtual, 
        p.PrecoAlvo, 
        COALESCE(l.Nome, 'Loja') AS Loja,
        p.CreatedAt AS DataCriacao,
        'Ativo' AS Status
      FROM produtos p
      LEFT JOIN lojas l ON l.Id = p.LojaId
      WHERE p.ReferenciaID = ? AND (p.DeletedAt IS NULL)
      ORDER BY p.CreatedAt DESC
    `, [referenciaID]);

        if (produtos.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Nenhum produto encontrado para exportar"
            });
        }

        let historico = [];
        for (const produto of produtos) {
            const [hist] = await db.query(`
          SELECT ProdutoId, Preco, DataRegisto as Data
          FROM historicoprecos
          WHERE ProdutoId = ?
          ORDER BY DataRegisto DESC
        `, [produto.Id]);
            historico.push({
                produtoId: produto.Id,
                registos: hist,
                totalRegistros: hist.length
            });
        }

        const buffer = await gerarPDF(produtos, historico, "Premium");

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `relatorio_completo_promoping_${timestamp}.pdf`;

        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Length", buffer.length);

        res.send(buffer);

    } catch (err) {
        console.error(" Erro ao exportar relatório completo:", err);
        res.status(500).json({
            status: "error",
            message: "Erro ao gerar relatório completo",
            error: err.message
        });
    }
}

/**
 * Obter informações do plano do usuário
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export async function obterPlanoUsuario(req, res) {
    try {
        const referenciaID = req.user.ReferenciaID;

        // Buscar informações do usuário e plano
        const [usuarios] = await db.query(`
      SELECT c.*, p.Nome as plano_nome, p.Preco, p.LimiteProdutos, p.PermiteSMS, p.Relatorios
      FROM configutilizador c
      LEFT JOIN planos p ON c.PlanoAtualId = p.Id
      WHERE c.ReferenciaID = ?
    `, [referenciaID]);

        if (usuarios.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Usuário não encontrado"
            });
        }

        const usuario = usuarios[0];
        const plano = {
            nome: usuario.plano_nome || "Free",
            preco: usuario.preco || 0,
            limite_produtos: usuario.limite_produtos || 5,
            verificacao_intervalo: usuario.verificacao_intervalo || 24,
            permite_sms: usuario.permite_sms || false,
            relatorios: usuario.relatorios || false
        };

        // Buscar informações do Stripe se disponível
        let stripeInfo = {};
        let isInGracePeriod = false;
        let gracePeriodEnd = null;
        let originalPlan = null; // Plano original durante período de graça

        try {
            const [stripeData] = await db.query(`
        SELECT customer_id, subscription_id, subscription_status, grace_period_end, status, plan_name
        FROM stripe_subscriptions 
        WHERE ReferenciaID = ? AND (status = 'active' OR status = 'canceled')
        ORDER BY created_at DESC 
        LIMIT 1
      `, [referenciaID]);

            if (stripeData.length > 0) {
                const data = stripeData[0];

                // Verificar se está em período de graça
                if (data.status === 'canceled' && data.grace_period_end) {
                    const now = new Date();
                    const graceEnd = new Date(data.grace_period_end);

                    if (now < graceEnd) {
                        isInGracePeriod = true;
                        gracePeriodEnd = data.grace_period_end;
                        originalPlan = data.plan_name; // Nome do plano original
                    }
                }

                stripeInfo = {
                    customer_id: data.customer_id,
                    subscription_id: data.subscription_id,
                    subscription_status: data.subscription_status,
                    is_in_grace_period: isInGracePeriod,
                    grace_period_end: gracePeriodEnd,
                    original_plan: originalPlan
                };
            }
        } catch (stripeErr) {
            console.log("ℹ Nenhuma informação do Stripe encontrada para o usuário");
        }

        // Se está em período de graça, usar o plano original
        if (isInGracePeriod && originalPlan) {
            // Buscar informações do plano original
            const [originalPlanData] = await db.query(`
        SELECT Nome, Preco, LimiteProdutos, PermiteSMS, Relatorios
        FROM planos 
        WHERE Nome = ?
      `, [originalPlan]);

            if (originalPlanData.length > 0) {
                const original = originalPlanData[0];
                plano.nome = original.Nome;
                plano.preco = original.Preco;
                plano.limite_produtos = original.LimiteProdutos;
                // VerificacaoIntervalo removido - coluna não existe
                plano.permite_sms = original.PermiteSMS;
                plano.relatorios = original.Relatorios;

                console.log(` [PLANO] Usando plano original durante graça: ${original.Nome} (€${original.Preco})`);
            }
        }

        res.json({
            status: "ok",
            plano: plano,
            usuario: {
                ReferenciaID: referenciaID,
                nome: usuario.Nome,
                email: usuario.Email
            },
            stripe: stripeInfo,
            customer_id: stripeInfo.customer_id,
            subscription_id: stripeInfo.subscription_id,
            is_in_grace_period: isInGracePeriod,
            grace_period_end: gracePeriodEnd,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error(" Erro ao obter plano do usuário:", err);
        res.status(500).json({
            status: "error",
            message: "Erro ao obter informações do plano",
            error: err.message
        });
    }
}