// ================== CONTROLLER DE EXPORTAÇÃO ==================

import { gerarExcel } from "../utils/gerarExcel.js";
import { gerarPDF } from "../utils/gerarPDF.js";
import { pool as db } from "../database/db.js";

/**
 * Exportar produtos para Excel
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export async function exportarExcel(req, res) {
  try {
    const referenciaID = req.user.ReferenciaID;
    const userPlano = req.user?.plano?.nome || "Free";
    
    console.log(` Exportando Excel para usuário ${referenciaID} (plano: ${userPlano})`);

    //  Definir o intervalo do histórico conforme o plano
    const dias = userPlano === "Basic" ? 30 : null;
    const incluirHistorico = ["Basic", "Standard", "Premium"].includes(userPlano);

    // Buscar produtos do usuário
    const [produtos] = await db.query(`
      SELECT 
        Id,
        Nome, 
        Link, 
        PrecoAtual, 
        PrecoAlvo, 
        Loja, 
        DataCriacao,
        Status
      FROM produtos 
      WHERE ReferenciaID = ? 
      ORDER BY DataCriacao DESC
    `, [referenciaID]);

    if (produtos.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Nenhum produto encontrado para exportar"
      });
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

    // Gerar arquivo Excel com histórico
    const buffer = await gerarExcel(produtos, historico, userPlano);
    
    // Configurar headers para download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `produtos_promoping_${timestamp}.xlsx`;
    
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Length", buffer.length);
    
    console.log(` Excel gerado com sucesso: ${produtos.length} produtos, ${historico.reduce((acc, h) => acc + h.totalRegistros, 0)} registros de histórico`);
    res.send(buffer);
    
  } catch (err) {
    console.error(" Erro ao exportar Excel:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Erro ao gerar arquivo Excel",
      error: err.message 
    });
  }
}

/**
 * Exportar produtos para PDF
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export async function exportarPDF(req, res) {
  try {
    const referenciaID = req.user.ReferenciaID;
    const userPlano = req.user?.plano?.nome || "Free";
    
    console.log(` Exportando PDF para usuário ${referenciaID} (plano: ${userPlano})`);

    //  Definir o intervalo do histórico conforme o plano
    const dias = userPlano === "Basic" ? 30 : null;
    const incluirHistorico = ["Basic", "Standard", "Premium"].includes(userPlano);

    // Buscar produtos do usuário
    const [produtos] = await db.query(`
      SELECT 
        Id,
        Nome, 
        Link, 
        PrecoAtual, 
        PrecoAlvo, 
        Loja, 
        DataCriacao,
        Status
      FROM produtos 
      WHERE ReferenciaID = ? 
      ORDER BY DataCriacao DESC
    `, [referenciaID]);

    if (produtos.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Nenhum produto encontrado para exportar"
      });
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
    
    console.log(` PDF gerado com sucesso: ${produtos.length} produtos, ${historico.reduce((acc, h) => acc + h.totalRegistros, 0)} registros de histórico`);
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
 * Exportar incidentes para Excel
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export async function exportarIncidentesExcel(req, res) {
  try {
    const referenciaID = req.user.ReferenciaID;
    const userPlano = req.user?.plano?.nome || "Free";
    
    console.log(` Exportando incidentes Excel para usuário ${referenciaID} (plano: ${userPlano})`);

    // Buscar incidentes (todos os incidentes do sistema para admin, ou apenas relacionados ao usuário)
    const [incidentes] = await db.query(`
      SELECT 
        i.Id, 
        i.Titulo, 
        i.Descricao,
        i.Impacto, 
        i.DataInicio, 
        i.DataFim, 
        i.Status, 
        c.Nome AS Componente
      FROM incidentes i
      LEFT JOIN status_componentes c ON i.ComponentesAfetados = c.Id
      ORDER BY i.DataInicio DESC
    `);

    if (incidentes.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Nenhum incidente encontrado para exportar"
      });
    }

    // Gerar arquivo Excel
    const buffer = await gerarExcel(incidentes, userPlano, 'incidentes');
    
    // Configurar headers para download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `incidentes_promoping_${timestamp}.xlsx`;
    
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Length", buffer.length);
    
    console.log(` Excel de incidentes gerado com sucesso: ${incidentes.length} incidentes`);
    res.send(buffer);
    
  } catch (err) {
    console.error(" Erro ao exportar incidentes Excel:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Erro ao gerar arquivo Excel de incidentes",
      error: err.message 
    });
  }
}

/**
 * Exportar relatório completo (Premium)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export async function exportarRelatorioCompleto(req, res) {
  try {
    const referenciaID = req.user.ReferenciaID;
    const userPlano = req.user?.plano?.nome || "Free";
    
    console.log(` Exportando relatório completo para usuário ${referenciaID} (plano: ${userPlano})`);

    // Buscar dados completos
    const [produtos] = await db.query(`
      SELECT Nome, Link, PrecoAtual, PrecoAlvo, Loja, DataCriacao, Status
      FROM produtos WHERE ReferenciaID = ? ORDER BY DataCriacao DESC
    `, [referenciaID]);

    const [incidentes] = await db.query(`
      SELECT i.Id, i.Titulo, i.Descricao, i.Impacto, i.DataInicio, i.DataFim, i.Status, c.Nome AS Componente
      FROM incidentes i
      LEFT JOIN status_componentes c ON i.ComponentesAfetados = c.Id
      ORDER BY i.DataInicio DESC
    `);

    const [metricas] = await db.query(`
      SELECT * FROM metricas_sistema ORDER BY Id DESC LIMIT 1
    `);

    // Gerar relatório completo
    const buffer = await gerarExcel({
      produtos,
      incidentes,
      metricas: metricas[0] || {},
      usuario: req.user,
      plano: userPlano
    }, userPlano, 'relatorio_completo');
    
    // Configurar headers para download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `relatorio_completo_promoping_${timestamp}.xlsx`;
    
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Length", buffer.length);
    
    console.log(` Relatório completo gerado com sucesso`);
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
            console.log(` [PLANO] Usuário ${referenciaID} em período de graça até ${graceEnd.toISOString()}`);
            console.log(` [PLANO] Plano original durante graça: ${originalPlan}`);
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
