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
    const userId = req.user.id;
    const userPlano = req.user?.plano?.nome || "Free";
    
    console.log(`📊 Exportando Excel para usuário ${userId} (plano: ${userPlano})`);

    // 🔹 Definir o intervalo do histórico conforme o plano
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
      WHERE UserId = ? 
      ORDER BY DataCriacao DESC
    `, [userId]);

    if (produtos.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Nenhum produto encontrado para exportar"
      });
    }

    // Buscar histórico de preços se permitido pelo plano
    let historico = [];
    if (incluirHistorico) {
      console.log(`📈 Buscando histórico de preços (${dias ? `últimos ${dias} dias` : 'completo'})`);
      
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
    
    console.log(`✅ Excel gerado com sucesso: ${produtos.length} produtos, ${historico.reduce((acc, h) => acc + h.totalRegistros, 0)} registros de histórico`);
    res.send(buffer);
    
  } catch (err) {
    console.error("❌ Erro ao exportar Excel:", err);
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
    const userId = req.user.id;
    const userPlano = req.user?.plano?.nome || "Free";
    
    console.log(`📄 Exportando PDF para usuário ${userId} (plano: ${userPlano})`);

    // 🔹 Definir o intervalo do histórico conforme o plano
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
      WHERE UserId = ? 
      ORDER BY DataCriacao DESC
    `, [userId]);

    if (produtos.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Nenhum produto encontrado para exportar"
      });
    }

    // Buscar histórico de preços se permitido pelo plano
    let historico = [];
    if (incluirHistorico) {
      console.log(`📈 Buscando histórico de preços (${dias ? `últimos ${dias} dias` : 'completo'})`);
      
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
    
    console.log(`✅ PDF gerado com sucesso: ${produtos.length} produtos, ${historico.reduce((acc, h) => acc + h.totalRegistros, 0)} registros de histórico`);
    res.send(buffer);
    
  } catch (err) {
    console.error("❌ Erro ao exportar PDF:", err);
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
    const userId = req.user.id;
    const userPlano = req.user?.plano?.nome || "Free";
    
    console.log(`📊 Exportando incidentes Excel para usuário ${userId} (plano: ${userPlano})`);

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
    
    console.log(`✅ Excel de incidentes gerado com sucesso: ${incidentes.length} incidentes`);
    res.send(buffer);
    
  } catch (err) {
    console.error("❌ Erro ao exportar incidentes Excel:", err);
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
    const userId = req.user.id;
    const userPlano = req.user?.plano?.nome || "Free";
    
    console.log(`📈 Exportando relatório completo para usuário ${userId} (plano: ${userPlano})`);

    // Buscar dados completos
    const [produtos] = await db.query(`
      SELECT Nome, Link, PrecoAtual, PrecoAlvo, Loja, DataCriacao, Status
      FROM produtos WHERE UserId = ? ORDER BY DataCriacao DESC
    `, [userId]);

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
    
    console.log(`✅ Relatório completo gerado com sucesso`);
    res.send(buffer);
    
  } catch (err) {
    console.error("❌ Erro ao exportar relatório completo:", err);
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
    const userId = req.user.id;
    
    // Buscar informações do usuário e plano
    const [usuarios] = await db.query(`
      SELECT c.*, p.nome as plano_nome
      FROM configutilizador c
      LEFT JOIN planos p ON c.PlanoId = p.id
      WHERE c.UserId = ?
    `, [userId]);

    if (usuarios.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Usuário não encontrado"
      });
    }

    const usuario = usuarios[0];
    const plano = {
      nome: usuario.plano_nome || "Free",
      descricao: "Plano gratuito com funcionalidades básicas"
    };

    res.json({
      status: "ok",
      plano: plano,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error("❌ Erro ao obter plano do usuário:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Erro ao obter informações do plano",
      error: err.message 
    });
  }
}
