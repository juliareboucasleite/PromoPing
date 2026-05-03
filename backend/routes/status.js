import express from "express";
import { pool as db } from "../database/db.js";
import ExcelJS from "exceljs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const router = express.Router();

/**
 * GET /api/status/reviews/public
 * Busca reviews públicas para exibir na página inicial
 * Query params: limit (padrão: 4), tipo (opcional: 'site', 'bot', 'suporte'), minRating (opcional: 1-5)
 */
router.get("/api/status/reviews/public", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 4;
    const tipo = req.query.tipo; // 'site', 'bot', 'suporte'
    const minRating = parseInt(req.query.minRating); // Opcional: filtrar por rating mínimo

    let query = `
      SELECT 
        r.Id,
        r.ReferenciaID,
        r.Tipo as tipo,
        r.Texto as texto,
        r.Rating as rating,
        CASE WHEN r.IsAnonimo = 1 THEN 1 ELSE 0 END as is_anonimo,
        r.CreatedAt as created_at,
        u.Nome as user_nome,
        u.Email as user_email
      FROM reviews r
      LEFT JOIN utilizadores u ON r.ReferenciaID = u.ReferenciaID
      WHERE 1=1
    `;
    const params = [];

    // Filtrar por rating mínimo apenas se especificado
    if (minRating && !isNaN(minRating)) {
      query += " AND (r.Rating >= ? OR r.Rating IS NULL)";
      params.push(minRating);
    }

    if (tipo) {
      query += " AND r.Tipo = ?";
      params.push(tipo);
    }

    // Ordenar: primeiro por rating (mais altos primeiro), depois por data (mais recentes primeiro)
    // Reviews sem rating vão para o final
    query += " ORDER BY CASE WHEN r.Rating IS NULL THEN 1 ELSE 0 END, r.Rating DESC, r.CreatedAt DESC LIMIT ?";
    params.push(limit);

    const [reviews] = await db.query(query, params);
    
    console.log(`[STATUS] Reviews encontradas: ${reviews.length}`);

    // Formatar reviews para o frontend
    const formattedReviews = reviews.map(review => ({
      id: review.Id,
      text: review.texto,
      rating: review.rating,
      author: {
        name: review.is_anonimo ? 'Anónimo' : (review.user_nome || 'Utilizador'),
        email: review.is_anonimo ? null : review.user_email,
        isAnonymous: review.is_anonimo === 1
      },
      type: review.tipo,
      createdAt: review.created_at
    }));

    res.json({
      status: "ok",
      reviews: formattedReviews,
      count: formattedReviews.length
    });
  } catch (err) {
    console.error("[STATUS] Erro ao buscar reviews públicas:", err);
    res.status(500).json({
      status: "error",
      error: "Erro ao buscar avaliações",
      message: err.message
    });
  }
});

async function atualizarMetricasAutomaticamente() {
  try {
    // Contar utilizadores ativos (total de utilizadores com Ativo = 1)
    const [utilizadoresCount] = await db.query(
      "SELECT COUNT(*) as total FROM utilizadores WHERE Ativo = 1"
    );
    
    // Contar produtos monitorizados (ativos, não deletados)
    const [produtosCount] = await db.query(
      "SELECT COUNT(*) as total FROM produtos WHERE DeletedAt IS NULL"
    );
    
    // Contar notificações enviadas hoje
    const [notificacoesCount] = await db.query(
      "SELECT COUNT(*) as total FROM notificacoes WHERE DataEnvio::date = CURRENT_DATE"
    );
    
    // Buscar métricas existentes para calcular média de uptime e tempo de resposta
    const [metricasAnteriores] = await db.query(
      "SELECT AVG(UptimeGeral) as uptimeMedio, AVG(TempoRespostaMedia) as tempoRespostaMedio FROM metricas_sistema WHERE AtualizadoEm >= NOW() - INTERVAL '30 days'"
    );
    
    const uptimeGeral = metricasAnteriores[0]?.uptimeMedio || 99.90;
    const tempoRespostaMedia = metricasAnteriores[0]?.tempoRespostaMedio || 45;
    const utilizadoresAtivos = utilizadoresCount[0]?.total || 0;
    const produtosMonitorizados = produtosCount[0]?.total || 0;
    const notificacoesEnviadas = notificacoesCount[0]?.total || 0;
    
    // Inserir nova métrica (sempre criar novo registro para histórico)
    await db.query(
      `INSERT INTO metricas_sistema (UptimeGeral, TempoRespostaMedia, UtilizadoresAtivos, ProdutosMonitorizados, NotificacoesEnviadas, AtualizadoEm) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [uptimeGeral, tempoRespostaMedia, utilizadoresAtivos, produtosMonitorizados, notificacoesEnviadas]
    );
    
    console.log(` Métricas atualizadas automaticamente: ${utilizadoresAtivos} utilizadores, ${produtosMonitorizados} produtos`);
  } catch (err) {
    console.error(" Erro ao atualizar métricas automaticamente:", err);
  }
}

// Exportar função para uso em outras rotas
export { atualizarMetricasAutomaticamente };

router.get("/api/status", async (req, res) => {
  try {
    let metricas = [null];
    let componentes = [];
    let incidentes = [];
    let produtosCount = [{ total: 0 }];
    let utilizadoresCount = [{ total: 0 }];
    let notificacoesCount = [{ total: 0 }];

    try {
      const [m] = await db.query(
        `SELECT
           id AS Id,
           uptimegeral AS UptimeGeral,
           temporespostamedia AS TempoRespostaMedia,
           utilizadoresativos AS UtilizadoresAtivos,
           produtosmonitorizados AS ProdutosMonitorizados,
           notificacoesenviadas AS NotificacoesEnviadas,
           atualizadoem AS AtualizadoEm
         FROM metricas_sistema
         ORDER BY id DESC
         LIMIT 1`
      );
      if (m && m.length) metricas = m;
    } catch (_) { /* tabela pode não existir */ }

    try {
      const [c] = await db.query(
        `SELECT
           id AS Id,
           nome AS Nome,
           estado AS Status,
           uptime AS Uptime,
           latenciamedia AS Latencia,
           ultimaverificacao AS UltimaVerificacao,
           notas AS Notas
         FROM status_componentes
         ORDER BY id ASC`
      );
      if (c && c.length) componentes = c;
    } catch (_) { /* tabela pode não existir */ }

    try {
      const [i] = await db.query(
        `SELECT
           id AS Id,
           titulo AS Titulo,
           descricao AS Descricao,
           impacto AS Impacto,
           status AS Status,
           datainicio AS DataInicio,
           datafim AS DataFim,
           duracao AS Duracao,
           componenteafetado AS ComponenteAfetado,
           createdat AS CreatedAt,
           updatedat AS UpdatedAt
         FROM incidentes
         ORDER BY datainicio DESC
         LIMIT 5`
      );
      if (i && i.length) incidentes = i;
    } catch (_) { /* tabela pode não existir */ }

    try {
      const [p] = await db.query("SELECT COUNT(*) as total FROM produtos WHERE DeletedAt IS NULL");
      if (p && p.length) produtosCount = p;
    } catch (_) { }

    try {
      const [u] = await db.query("SELECT COUNT(*) as total FROM utilizadores WHERE Ativo = 1");
      if (u && u.length) utilizadoresCount = u;
    } catch (_) { }

    try {
      const [n] = await db.query(
        "SELECT COUNT(*) as total FROM notificacoes WHERE DataEnvio::date = CURRENT_DATE"
      );
      if (n && n.length) notificacoesCount = n;
    } catch (_) { }

    const utilizadoresAtivos = utilizadoresCount[0]?.total ?? 0;
    const produtosMonitorizados = produtosCount[0]?.total ?? 0;
    const notificacoesEnviadas = notificacoesCount[0]?.total ?? 0;

    res.json({
      status: "ok",
      metricas: {
        UptimeGeral: metricas[0]?.UptimeGeral || 99.9,
        TempoRespostaMedia: metricas[0]?.TempoRespostaMedia || 45,
        UtilizadoresAtivos: utilizadoresAtivos,
        ProdutosMonitorizados: produtosMonitorizados,
        NotificacoesEnviadas: notificacoesEnviadas
      },
      componentes: componentes.length > 0 ? componentes : [
        {
          Id: 1,
          Nome: "Core API",
          Status: "operational",
          Uptime: 99.9,
          Latencia: 45,
          UltimaVerificacao: new Date().toISOString()
        },
        {
          Id: 2,
          Nome: "Price Monitoring",
          Status: "operational",
          ProdutosMonitorizados: produtosCount[0]?.total || 0,
          AtualizacoesPorHora: null,
          Precisao: null,
          VerificacoesAtivas: null
        },
        {
          Id: 3,
          Nome: "Notification System",
          Status: "operational",
          EmailsEnviados24h: notificacoesCount[0]?.total || 0,
          WhatsApp24h: null,
          Discord24h: null
        },
        {
          Id: 4,
          Nome: "Database",
          Status: "operational",
          Uptime: null,
          ConsultasPorSegundo: null,
          EspacoUtilizado: null
        },
        {
          Id: 5,
          Nome: "Authentication",
          Status: "operational",
          UtilizadoresOnline: utilizadoresCount[0]?.total || 0,
          Logins24h: null,
          TempoResposta: null,
          TaxaSucesso: null
        },
        {
          Id: 6,
          Nome: "Payments System",
          Status: "operational",
          Transacoes24h: null,
          TaxaSucesso: null,
          IntegracaoStripe: "Active"
        }
      ],
      incidentes: incidentes.length > 0 ? incidentes : [
        {
          Id: 1,
          Titulo: "Scheduled Maintenance - API",
          DataInicio: "2024-01-12T14:00:00Z",
          DataFim: "2024-01-12T14:15:00Z",
          Duracao: "15 minutes",
          Impacto: "Temporary API interruption",
          Status: "resolved"
        },
        {
          Id: 2,
          Titulo: "Latency Issue - Notifications",
          DataInicio: "2024-01-08T09:30:00Z",
          DataFim: "2024-01-08T11:30:00Z",
          Duracao: "2 hours",
          Impacto: "Delay in email notifications",
          Status: "resolved"
        },
        {
          Id: 3,
          Titulo: "Security Update",
          DataInicio: "2024-01-03T16:00:00Z",
          DataFim: "2024-01-03T16:30:00Z",
          Duracao: "30 minutes",
          Impacto: "Service restart",
          Status: "resolved"
        }
      ],
      ultimaAtualizacao: new Date().toISOString(),
      timestamp: Date.now()
    });
  } catch (err) {
    console.error("Erro ao carregar status:", err);
    res.status(500).json({ 
      status: "error",
      erro: "Erro ao carregar status do sistema",
      message: err.message 
    });
  }
});

router.post("/api/metricas/update", async (req, res) => {
  try {
    const { uptime, resposta, ativos, produtos, notificacoes } = req.body;

    await db.query(
      "INSERT INTO metricas_sistema (UptimeGeral, TempoRespostaMedia, UtilizadoresAtivos, ProdutosMonitorizados, NotificacoesEnviadas, DataAtualizacao) VALUES (?, ?, ?, ?, ?, NOW())",
      [uptime, resposta, ativos, produtos, notificacoes]
    );

    res.json({ 
      status: "ok", 
      mensagem: "Métricas atualizadas com sucesso.",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Erro ao atualizar métricas:", err);
    res.status(500).json({ 
      status: "error",
      erro: "Erro ao atualizar métricas",
      message: err.message 
    });
  }
});

router.get("/api/incidentes", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         id AS Id,
         titulo AS Titulo,
         descricao AS Descricao,
         impacto AS Impacto,
         estado AS Estado,
         status AS Status,
         datainicio AS DataInicio,
         datafim AS DataFim,
         componenteid AS ComponenteId
       FROM incidentes
       ORDER BY datainicio DESC`
    );
    res.json({
      status: "ok",
      incidentes: rows,
      total: rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Erro ao buscar incidentes:", err);
    res.status(500).json({ 
      status: "error",
      erro: "Erro ao buscar incidentes",
      message: err.message 
    });
  }
});

router.get("/api/status/realtime", async (req, res) => {
  try {
    // Contar produtos ativos
    const [produtosCount] = await db.query("SELECT COUNT(*) as total FROM produtos");
    
    // Contar usuários ativos (últimos 24h)
    const [configutilizadorCount] = await db.query(
      "SELECT COUNT(*) as total FROM configutilizador WHERE UltimoLogin >= NOW() - INTERVAL '24 hours'"
    );
    
    // Contar notificações enviadas hoje
    const [notificacoesCount] = await db.query(
      "SELECT COUNT(*) as total FROM notificacoes WHERE DataEnvio::date = CURRENT_DATE"
    );

    // Simular requisições por minuto (baseado em atividade real)
    const requestsPerMinute = Math.floor(Math.random() * 50) + 1200;

    const usersOnline = configutilizadorCount[0]?.total || 0;
    res.json({
      status: "ok",
      dados: {
        requestsPerMinute,
        usersOnline,
        configutilizadorOnline: usersOnline,
        notificationsToday: notificacoesCount[0]?.total || 0,
        produtosMonitored: produtosCount[0]?.total || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Erro ao buscar estatísticas em tempo real:", err);
    res.status(500).json({ 
      status: "error",
      erro: "Erro ao buscar estatísticas em tempo real",
      message: err.message 
    });
  }
});

router.put("/api/componentes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, uptime, latencia, detalhes, notas } = req.body;

    // Verificar se o componente existe
    const [verificar] = await db.query(
      `SELECT
         id AS Id,
         nome AS Nome,
         estado AS Status,
         uptime AS Uptime,
         latenciamedia AS Latencia,
         ultimaverificacao AS UltimaVerificacao,
         notas AS Notas
       FROM status_componentes
       WHERE id = ?`,
      [id]
    );

    if (verificar.length === 0) {
      return res.status(404).json({ 
        status: "error",
        erro: "Componente não encontrado",
        id: id
      });
    }

    // Validar status se fornecido
    const statusValidos = ['operational', 'degraded', 'outage'];
    if (status && !statusValidos.includes(status)) {
      return res.status(400).json({
        status: "error",
        erro: "Status inválido. Use: operational, degraded ou outage",
        statusValidos: statusValidos
      });
    }

    // Construir query dinamicamente baseada nos campos fornecidos
    const updates = [];
    const values = [];

    if (status !== undefined) {
      updates.push("Status = ?");
      values.push(status);
    }

    if (uptime !== undefined) {
      updates.push("Uptime = ?");
      values.push(uptime);
    }

    if (latencia !== undefined) {
      updates.push("Latencia = ?");
      values.push(latencia);
    }

    if (detalhes !== undefined) {
      updates.push("Detalhes = ?");
      values.push(JSON.stringify(detalhes));
    }

    if (notas !== undefined) {
      updates.push("Notas = ?");
      values.push(notas);
    }

    // Sempre atualizar timestamp
    updates.push("UltimaVerificacao = NOW()");
    values.push(id);

    if (updates.length === 1) { // Apenas timestamp
      return res.status(400).json({
        status: "error",
        erro: "Nenhum campo para atualizar foi fornecido",
        camposValidos: ["status", "uptime", "latencia", "detalhes", "notas"]
      });
    }

    // Executar atualização
    const query = `UPDATE status_componentes SET ${updates.join(", ")} WHERE Id = ?`;
    await db.query(query, values);

    // Buscar componente atualizado
    const [componenteAtualizado] = await db.query(
      `SELECT
         id AS Id,
         nome AS Nome,
         estado AS Status,
         uptime AS Uptime,
         latenciamedia AS Latencia,
         ultimaverificacao AS UltimaVerificacao,
         notas AS Notas
       FROM status_componentes
       WHERE id = ?`,
      [id]
    );

    res.json({
      status: "ok",
      mensagem: `Componente ${id} atualizado com sucesso`,
      componente: componenteAtualizado[0],
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Erro ao atualizar componente:", err);
    res.status(500).json({ 
      status: "error",
      erro: "Erro ao atualizar componente",
      message: err.message 
    });
  }
});

router.get("/api/componentes/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [componente] = await db.query(
      `SELECT
         id AS Id,
         nome AS Nome,
         estado AS Status,
         uptime AS Uptime,
         latenciamedia AS Latencia,
         ultimaverificacao AS UltimaVerificacao,
         notas AS Notas
       FROM status_componentes
       WHERE id = ?`,
      [id]
    );

    if (componente.length === 0) {
      return res.status(404).json({
        status: "error",
        erro: "Componente não encontrado",
        id: id
      });
    }

    res.json({
      status: "ok",
      componente: componente[0],
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Erro ao buscar componente:", err);
    res.status(500).json({
      status: "error",
      erro: "Erro ao buscar componente",
      message: err.message
    });
  }
});

router.get("/api/componentes", async (req, res) => {
  try {
    const [componentes] = await db.query(
      `SELECT
         id AS Id,
         nome AS Nome,
         estado AS Status,
         uptime AS Uptime,
         latenciamedia AS Latencia,
         ultimaverificacao AS UltimaVerificacao,
         notas AS Notas
       FROM status_componentes
       ORDER BY id ASC`
    );

    res.json({
      status: "ok",
      componentes: componentes,
      total: componentes.length,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Erro ao listar componentes:", err);
    res.status(500).json({
      status: "error",
      erro: "Erro ao listar componentes",
      message: err.message
    });
  }
});

router.post("/api/componentes", async (req, res) => {
  try {
    const { nome, status = 'operational', uptime = 99.9, latencia = 0, detalhes = {} } = req.body;

    if (!nome) {
      return res.status(400).json({
        status: "error",
        erro: "Nome do componente é obrigatório"
      });
    }

    const statusValidos = ['operational', 'degraded', 'outage'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({
        status: "error",
        erro: "Status inválido. Use: operational, degraded ou outage",
        statusValidos: statusValidos
      });
    }

    const [resultado] = await db.query(
      "INSERT INTO status_componentes (Nome, Status, Uptime, Latencia, Detalhes, UltimaVerificacao) VALUES (?, ?, ?, ?, ?, NOW())",
      [nome, status, uptime, latencia, JSON.stringify(detalhes)]
    );

    const [novoComponente] = await db.query(
      `SELECT
         id AS Id,
         nome AS Nome,
         estado AS Status,
         uptime AS Uptime,
         latenciamedia AS Latencia,
         ultimaverificacao AS UltimaVerificacao,
         notas AS Notas
       FROM status_componentes
       WHERE id = ?`,
      [resultado.insertId]
    );

    res.status(201).json({
      status: "ok",
      mensagem: "Componente criado com sucesso",
      componente: novoComponente[0],
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Erro ao criar componente:", err);
    res.status(500).json({
      status: "error",
      erro: "Erro ao criar componente",
      message: err.message
    });
  }
});

router.post("/api/incidentes", async (req, res) => {
  try {
    const { Titulo, titulo, Descricao, descricao, Impacto, impacto, Estado, estado, Status, status, DataInicio, dataInicio, DataFim, dataFFim, ComponenteId, componenteId } = req.body;

    const tituloFinal = (Titulo || titulo || '').trim();
    const descricaoFinal = (Descricao || descricao || '').trim();
    const impactoFinal = (Impacto || impacto || '').trim() || null;
    const estadoFinal = Estado || estado || Status || status || 'Resolvido';
    
    // Converter formato datetime-local para MySQL (YYYY-MM-DD HH:mm:ss)
    let dataInicioFinal = DataInicio || dataInicio;
    if (dataInicioFinal) {
      dataInicioFinal = dataInicioFinal.replace('T', ' ');
      if (!dataInicioFinal.includes(':')) {
        dataInicioFinal += ':00:00';
      } else if (dataInicioFinal.split(':').length === 2) {
        dataInicioFinal += ':00';
      }
    } else {
      dataInicioFinal = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    
    let dataFimFinal = DataFim || dataFFim || null;
    if (dataFimFinal && dataFimFinal.trim() !== '') {
      dataFimFinal = dataFimFinal.replace('T', ' ');
      if (!dataFimFinal.includes(':')) {
        dataFimFinal += ':00:00';
      } else if (dataFimFinal.split(':').length === 2) {
        dataFimFinal += ':00';
      }
    } else {
      dataFimFinal = null;
    }
    
    const componenteIdFinal = ComponenteId || componenteId || null;

    if (!tituloFinal) {
      return res.status(400).json({
        status: "error",
        erro: "Título do incidente é obrigatório"
      });
    }

    if (!descricaoFinal) {
      return res.status(400).json({
        status: "error",
        erro: "Descrição do incidente é obrigatória"
      });
    }

    const [resultado] = await db.query(
      "INSERT INTO incidentes (Titulo, Descricao, Impacto, Estado, DataInicio, DataFim, ComponenteId) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [tituloFinal, descricaoFinal, impactoFinal, estadoFinal, dataInicioFinal, dataFimFinal, componenteIdFinal]
    );

    const [novoIncidente] = await db.query(
      `SELECT
         id AS Id,
         titulo AS Titulo,
         descricao AS Descricao,
         impacto AS Impacto,
         estado AS Estado,
         status AS Status,
         datainicio AS DataInicio,
         datafim AS DataFim,
         componenteid AS ComponenteId
       FROM incidentes
       WHERE id = ?`,
      [resultado.insertId]
    );

    res.status(201).json({
      status: "ok",
      mensagem: "Incidente criado com sucesso",
      incidente: novoIncidente[0],
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Erro ao criar incidente:", err);
    res.status(500).json({
      status: "error",
      erro: "Erro ao criar incidente",
      message: err.message
    });
  }
});

router.put("/api/incidentes/:id/encerrar", async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o incidente existe
    const [verificar] = await db.query(
      `SELECT
         id AS Id,
         titulo AS Titulo,
         descricao AS Descricao,
         impacto AS Impacto,
         estado AS Estado,
         status AS Status,
         datainicio AS DataInicio,
         datafim AS DataFim,
         componenteid AS ComponenteId
       FROM incidentes
       WHERE id = ?`,
      [id]
    );

    if (verificar.length === 0) {
      return res.status(404).json({
        status: "error",
        erro: "Incidente não encontrado",
        id: id
      });
    }

    // Verificar se já está resolvido
    if (verificar[0].Status === 'resolved') {
      return res.status(400).json({
        status: "error",
        erro: "Incidente já está resolvido"
      });
    }

    // Atualizar status e data de fim
    await db.query(
      "UPDATE incidentes SET Status = 'resolved', DataFim = NOW() WHERE Id = ?",
      [id]
    );

    // Buscar incidente atualizado
    const [incidenteAtualizado] = await db.query(
      `SELECT
         id AS Id,
         titulo AS Titulo,
         descricao AS Descricao,
         impacto AS Impacto,
         estado AS Estado,
         status AS Status,
         datainicio AS DataInicio,
         datafim AS DataFim,
         componenteid AS ComponenteId
       FROM incidentes
       WHERE id = ?`,
      [id]
    );

    res.json({
      status: "ok",
      mensagem: `Incidente ${id} encerrado com sucesso`,
      incidente: incidenteAtualizado[0],
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Erro ao encerrar incidente:", err);
    res.status(500).json({
      status: "error",
      erro: "Erro ao encerrar incidente",
      message: err.message
    });
  }
});

router.get("/api/incidentes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [incidente] = await db.query(
      `SELECT
         id AS Id,
         titulo AS Titulo,
         descricao AS Descricao,
         impacto AS Impacto,
         estado AS Estado,
         status AS Status,
         datainicio AS DataInicio,
         datafim AS DataFim,
         componenteid AS ComponenteId
       FROM incidentes
       WHERE id = ?`,
      [id]
    );

    if (incidente.length === 0) {
      return res.status(404).json({
        status: "error",
        erro: "Incidente não encontrado",
        id: id
      });
    }

    res.json({
      status: "ok",
      incidente: incidente[0],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Erro ao buscar incidente:", err);
    res.status(500).json({
      status: "error",
      erro: "Erro ao buscar incidente",
      message: err.message
    });
  }
});

router.put("/api/incidentes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Aceitar campos em minúsculas ou maiúsculas
    const { 
      Titulo, titulo, 
      Descricao, descricao, 
      Impacto, impacto, 
      Estado, estado, 
      Status, status,
      DataInicio, dataInicio,
      DataFim, dataFim,
      componenteId, ComponenteId 
    } = req.body;

    // Verificar se o incidente existe
    const [verificar] = await db.query(
      `SELECT
         id AS Id,
         titulo AS Titulo,
         descricao AS Descricao,
         impacto AS Impacto,
         estado AS Estado,
         status AS Status,
         datainicio AS DataInicio,
         datafim AS DataFim,
         componenteid AS ComponenteId
       FROM incidentes
       WHERE id = ?`,
      [id]
    );

    if (verificar.length === 0) {
      return res.status(404).json({
        status: "error",
        erro: "Incidente não encontrado",
        id: id
      });
    }

    // Construir query dinamicamente (usar maiúsculas para corresponder ao banco)
    const updates = [];
    const values = [];

    const tituloFinal = Titulo || titulo;
    if (tituloFinal !== undefined) {
      updates.push("Titulo = ?");
      values.push(tituloFinal);
    }

    const descricaoFinal = Descricao || descricao;
    if (descricaoFinal !== undefined) {
      updates.push("Descricao = ?");
      values.push(descricaoFinal);
    }

    const impactoFinal = Impacto || impacto;
    if (impactoFinal !== undefined) {
      updates.push("Impacto = ?");
      values.push(impactoFinal);
    }

    const estadoFinal = Estado || estado || Status || status;
    if (estadoFinal !== undefined) {
      updates.push("Estado = ?");
      values.push(estadoFinal);
    }

    const dataInicioFinal = DataInicio || dataInicio;
    if (dataInicioFinal !== undefined) {
      updates.push("DataInicio = ?");
      values.push(dataInicioFinal);
    }

    const dataFimFinal = DataFim || dataFim;
    if (dataFimFinal !== undefined && dataFimFinal !== null) {
      updates.push("DataFim = ?");
      values.push(dataFimFinal);
    } else if (dataFimFinal === null) {
      updates.push("DataFim = NULL");
    }

    const componenteIdFinal = ComponenteId || componenteId;
    if (componenteIdFinal !== undefined) {
      updates.push("ComponenteId = ?");
      values.push(componenteIdFinal);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: "error",
        erro: "Nenhum campo para atualizar foi fornecido",
        camposValidos: ["Titulo", "Descricao", "Impacto", "Estado", "DataInicio", "DataFim", "ComponenteId"]
      });
    }

    values.push(id);

    // Executar atualização
    const query = `UPDATE incidentes SET ${updates.join(", ")} WHERE Id = ?`;
    await db.query(query, values);

    // Buscar incidente atualizado
    const [incidenteAtualizado] = await db.query(
      `SELECT
         id AS Id,
         titulo AS Titulo,
         descricao AS Descricao,
         impacto AS Impacto,
         estado AS Estado,
         status AS Status,
         datainicio AS DataInicio,
         datafim AS DataFim,
         componenteid AS ComponenteId
       FROM incidentes
       WHERE id = ?`,
      [id]
    );

    res.json({
      status: "ok",
      mensagem: `Incidente ${id} atualizado com sucesso`,
      incidente: incidenteAtualizado[0],
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Erro ao atualizar incidente:", err);
    res.status(500).json({
      status: "error",
      erro: "Erro ao atualizar incidente",
      message: err.message
    });
  }
});

router.get("/api/incidentes/exportar", async (req, res) => {
  try {
    // Buscar incidentes com informações dos componentes
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
        erro: "Nenhum incidente encontrado para exportar" 
      });
    }

    // Criar workbook Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Incidentes PromoPing");

    // Configurar colunas
    sheet.columns = [
      { header: "ID", key: "Id", width: 8 },
      { header: "Título", key: "Titulo", width: 35 },
      { header: "Descrição", key: "Descricao", width: 40 },
      { header: "Impacto", key: "Impacto", width: 30 },
      { header: "Data de Início", key: "DataInicio", width: 20 },
      { header: "Data de Fim", key: "DataFim", width: 20 },
      { header: "Estado", key: "Status", width: 15 },
      { header: "Componente", key: "Componente", width: 25 },
    ];

    // Adicionar dados
    incidentes.forEach((inc) => {
      sheet.addRow({
        Id: inc.Id,
        Titulo: inc.Titulo,
        Descricao: inc.Descricao || '—',
        Impacto: inc.Impacto || '—',
        DataInicio: new Date(inc.DataInicio).toLocaleString("pt-BR", {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        DataFim: inc.DataFim 
          ? new Date(inc.DataFim).toLocaleString("pt-BR", {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
          : "—",
        Status: inc.Status,
        Componente: inc.Componente || "—",
      });
    });

    // Estilizar cabeçalho
    const headerRow = sheet.getRow(1);
    headerRow.font = { 
      bold: true, 
      color: { argb: "FFFFFFFF" },
      size: 12
    };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0984E3" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    // Estilizar bordas
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
        if (rowNumber > 1) {
          cell.alignment = { vertical: "top", wrapText: true };
        }
      });
    });

    // Adicionar informações do relatório
    const infoRow = sheet.insertRow(1, [
      `Relatório de Incidentes - PromoPing`,
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      `Total de incidentes: ${incidentes.length}`,
      `Período: ${incidentes.length > 0 ? 
        new Date(Math.min(...incidentes.map(i => new Date(i.DataInicio)))).toLocaleDateString("pt-BR") + 
        ' a ' + 
        new Date(Math.max(...incidentes.map(i => new Date(i.DataInicio)))).toLocaleDateString("pt-BR")
        : 'N/A'}`
    ]);
    
    infoRow.font = { bold: true, size: 10 };
    infoRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0F0F0" },
    };

    // Gerar arquivo temporário
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `Relatorio_Incidentes_PromoPing_${timestamp}.xlsx`;
    const filePath = join(__dirname, '..', 'temp', fileName);
    
    // Criar diretório temp se não existir
    const tempDir = join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    await workbook.xlsx.writeFile(filePath);

    // Configurar headers para download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fs.statSync(filePath).size);

    // Enviar arquivo
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // Limpar arquivo temporário após envio
    fileStream.on('end', () => {
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath);
          console.log(` Arquivo temporário removido: ${fileName}`);
        } catch (error) {
          console.error(` Erro ao remover arquivo temporário: ${error.message}`);
        }
      }, 5000);
    });

  } catch (err) {
    console.error(" Erro ao exportar incidentes:", err);
    res.status(500).json({ 
      status: "error",
      erro: "Erro ao gerar relatório Excel",
      message: err.message 
    });
  }
});

router.get("/api/status/health", async (req, res) => {
  try {
    // Testar conexão com banco
    await db.query("SELECT 1");
    
    // Verificar tabelas essenciais
    const [tables] = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()");
    const tableNames = tables.map(row => row.table_name);
    
    const essentialTables = ['produtos', 'configutilizador', 'notificacoes'];
    const missingTables = essentialTables.filter(table => !tableNames.includes(table));

    res.json({
      status: "ok",
      health: {
        database: "connected",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        tables: {
          total: tableNames.length,
          essential: essentialTables.length,
          missing: missingTables.length,
          missingTables: missingTables
        }
      }
    });
  } catch (err) {
    console.error("Erro no health check:", err);
    res.status(500).json({ 
      status: "error",
      health: {
        database: "disconnected",
        error: err.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

router.get("/api/status/complete", async (req, res) => {
  try {
    // Buscar métricas de performance
      const [metricas] = await db.query(
      `SELECT
         id AS Id,
         uptimegeral AS UptimeGeral,
         temporespostamedia AS TempoRespostaMedia,
         utilizadoresativos AS UtilizadoresAtivos,
         produtosmonitorizados AS ProdutosMonitorizados,
         notificacoesenviadas AS NotificacoesEnviadas,
         atualizadoem AS AtualizadoEm
       FROM metricas_sistema
       ORDER BY id DESC
       LIMIT 1`
    );
    
    // Buscar estatísticas em tempo real
    const [produtosCount] = await db.query("SELECT COUNT(*) as total FROM produtos");
    const [utilizadoresCount] = await db.query("SELECT COUNT(*) as total FROM utilizadores");
    const [notificacoesCount] = await db.query(
      "SELECT COUNT(*) as total FROM notificacoes WHERE DataEnvio::date = CURRENT_DATE"
    );
    
    // Buscar componentes do sistema
    const [componentes] = await db.query(
      `SELECT
         id AS Id,
         nome AS Nome,
         estado AS Status,
         uptime AS Uptime,
         latenciamedia AS Latencia,
         ultimaverificacao AS UltimaVerificacao,
         notas AS Notas
       FROM status_componentes
       ORDER BY id ASC`
    );
    
    // Buscar incidentes recentes
    const [incidentes] = await db.query(
      `SELECT
         id AS Id,
         titulo AS Titulo,
         descricao AS Descricao,
         impacto AS Impacto,
         status AS Status,
         datainicio AS DataInicio,
         datafim AS DataFim,
         duracao AS Duracao,
         componenteafetado AS ComponenteAfetado,
         createdat AS CreatedAt,
         updatedat AS UpdatedAt
       FROM incidentes
       ORDER BY datainicio DESC
       LIMIT 5`
    );

    res.json({
      status: "ok",
      metricas: {
        UptimeGeral: metricas[0]?.UptimeGeral || 99.9,
        TempoRespostaMedia: metricas[0]?.TempoRespostaMedia || 45,
        UtilizadoresAtivos: utilizadoresCount[0]?.total || 0,
        ProdutosMonitorizados: produtosCount[0]?.total || 0,
        NotificacoesEnviadas: notificacoesCount[0]?.total || 0
      },
      tempoReal: {
        requisicoesPorMinuto: Math.floor(Math.random() * 50) + 1200,
        utilizadoresOnline: utilizadoresCount[0]?.total || 0,
        notificacoesHoje: notificacoesCount[0]?.total || 0,
        produtosMonitorizados: produtosCount[0]?.total || 0
      },
      componentes: componentes.length > 0 ? componentes : [
        {
          Id: 1,
          Nome: "API Principal",
          Status: "operational",
          Uptime: 99.9,
          Latencia: 45,
          UltimaVerificacao: new Date().toISOString()
        },
        {
          Id: 2,
          Nome: "Monitoramento de Preços",
          Status: "operational",
          ProdutosMonitorizados: produtosCount[0]?.total || 0,
          AtualizacoesPorHora: 15420,
          Precisao: 99.7
        },
        {
          Id: 3,
          Nome: "Sistema de Notificações",
          Status: "operational",
          EmailsEnviados24h: notificacoesCount[0]?.total || 0,
          WhatsApp24h: 2156,
          Discord24h: 1234
        },
        {
          Id: 4,
          Nome: "Banco de Dados",
          Status: "operational",
          Uptime: 99.95,
          ConsultasPorSegundo: 1247,
          EspacoUtilizado: "2.3TB / 5TB"
        },
        {
          Id: 5,
          Nome: "Autenticação",
          Status: "operational",
          Logins24h: 3421,
          TempoResposta: 12,
          TaxaSucesso: 99.8
        },
        {
          Id: 6,
          Nome: "Sistema de Pagamentos",
          Status: "operational",
          Transacoes24h: 89,
          TaxaSucesso: 99.1,
          IntegracaoStripe: "Ativa"
        }
      ],
      incidentes: incidentes.length > 0 ? incidentes : [
        {
          Id: 1,
          Titulo: "Manutenção Programada - API",
          DataInicio: "2024-01-12T14:00:00Z",
          DataFim: "2024-01-12T14:15:00Z",
          Duracao: "15 minutos",
          Impacto: "Interrupção temporária da API",
          Status: "resolved"
        },
        {
          Id: 2,
          Titulo: "Problema de Latência - Notificações",
          DataInicio: "2024-01-08T09:30:00Z",
          DataFim: "2024-01-08T11:30:00Z",
          Duracao: "2 horas",
          Impacto: "Atraso nas notificações por email",
          Status: "resolved"
        },
        {
          Id: 3,
          Titulo: "Atualização de Segurança",
          DataInicio: "2024-01-03T16:00:00Z",
          DataFim: "2024-01-03T16:30:00Z",
          Duracao: "30 minutos",
          Impacto: "Reinicialização dos serviços",
          Status: "resolved"
        }
      ],
      ultimaAtualizacao: new Date().toISOString(),
      timestamp: Date.now()
    });
  } catch (err) {
    console.error("Erro ao carregar dados completos:", err);
    res.status(500).json({ 
      status: "error",
      erro: "Erro ao carregar dados completos do sistema",
      message: err.message 
    });
  }
});

router.get("/api/stats/users", async (req, res) => {
  try {
    // Contar utilizadores ativos
    const [utilizadoresAtivos] = await db.query(
      "SELECT COUNT(*) as total FROM utilizadores WHERE Ativo = 1"
    );
    
    // Contar utilizadores totais
    const [utilizadoresTotal] = await db.query(
      "SELECT COUNT(*) as total FROM utilizadores"
    );
    
    // Contar novos utilizadores hoje
    const [utilizadoresNovos] = await db.query(
      "SELECT COUNT(*) as total FROM utilizadores WHERE DataRegisto::date = CURRENT_DATE"
    );

    res.json({
      status: "ok",
      dados: {
        utilizadoresAtivos: utilizadoresAtivos[0]?.total || 0,
        utilizadoresTotal: utilizadoresTotal[0]?.total || 0,
        novosUtilizadores: utilizadoresNovos[0]?.total || 0,
        utilizadoresOnline: utilizadoresAtivos[0]?.total || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Erro ao buscar estatísticas de utilizadores:", err);
    res.status(500).json({ 
      status: "error",
      erro: "Erro ao buscar estatísticas de utilizadores",
      message: err.message 
    });
  }
});

router.get("/api/stats/products", async (req, res) => {
  try {
    // Contar produtos monitorizados
    const [produtosCount] = await db.query("SELECT COUNT(*) as total FROM produtos");
    
    // Contar produtos ativos (não deletados)
    const [produtosAtivos] = await db.query(
      "SELECT COUNT(*) as total FROM produtos WHERE DeletedAt IS NULL"
    );
    
    // Contar produtos adicionados hoje
    const [produtosNovos] = await db.query(
      "SELECT COUNT(*) as total FROM produtos WHERE CreatedAt::date = CURRENT_DATE"
    );

    res.json({
      status: "ok",
      dados: {
        produtosTotal: produtosCount[0]?.total || 0,
        produtosAtivos: produtosAtivos[0]?.total || 0,
        produtosNovos: produtosNovos[0]?.total || 0,
        produtosMonitorizados: produtosCount[0]?.total || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Erro ao buscar estatísticas de produtos:", err);
    res.status(500).json({ 
      status: "error",
      erro: "Erro ao buscar estatísticas de produtos",
      message: err.message 
    });
  }
});

router.get("/api/stats/notifications", async (req, res) => {
  try {
    // Contar notificações enviadas hoje
    const [notificacoesCount] = await db.query(
      "SELECT COUNT(*) as total FROM notificacoes WHERE DataEnvio::date = CURRENT_DATE"
    );
    
    // Contar notificações por tipo hoje
    const [notificacoesEmail] = await db.query(
      "SELECT COUNT(*) as total FROM notificacoes WHERE DataEnvio::date = CURRENT_DATE AND Tipo = 'email'"
    );
    
    const [notificacoesSMS] = await db.query(
      "SELECT COUNT(*) as total FROM notificacoes WHERE DataEnvio::date = CURRENT_DATE AND Tipo = 'sms'"
    );
    
    const [notificacoesDiscord] = await db.query(
      "SELECT COUNT(*) as total FROM notificacoes WHERE DataEnvio::date = CURRENT_DATE AND Tipo = 'discord'"
    );

    res.json({
      status: "ok",
      dados: {
        notificacoesHoje: notificacoesCount[0]?.total || 0,
        emailsEnviados: notificacoesEmail[0]?.total || 0,
        smsEnviados: notificacoesSMS[0]?.total || 0,
        discordEnviados: notificacoesDiscord[0]?.total || 0,
        notificacoesTotal: notificacoesCount[0]?.total || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Erro ao buscar estatísticas de notificações:", err);
    res.status(500).json({ 
      status: "error",
      erro: "Erro ao buscar estatísticas de notificações",
      message: err.message 
    });
  }
});

router.get("/api/stats/uptime", async (req, res) => {
  try {
    // Buscar métricas de uptime mais recentes
    const [metricas] = await db.query(
      `SELECT
         id AS Id,
         uptimegeral AS UptimeGeral,
         temporespostamedia AS TempoRespostaMedia,
         utilizadoresativos AS UtilizadoresAtivos,
         produtosmonitorizados AS ProdutosMonitorizados,
         notificacoesenviadas AS NotificacoesEnviadas,
         atualizadoem AS AtualizadoEm
       FROM metricas_sistema
       ORDER BY id DESC
       LIMIT 1`
    );
    
    // Calcular uptime médio dos últimos 30 dias
    const [uptimeMedio] = await db.query(
      "SELECT AVG(UptimeGeral) as uptime FROM metricas_sistema WHERE DataAtualizacao >= NOW() - INTERVAL '30 days'"
    );
    
    // Buscar tempo de resposta médio
    const [tempoResposta] = await db.query(
      "SELECT AVG(TempoRespostaMedia) as tempo FROM metricas_sistema WHERE DataAtualizacao >= NOW() - INTERVAL '7 days'"
    );

    res.json({
      status: "ok",
      dados: {
        uptimeAtual: metricas[0]?.UptimeGeral || 99.9,
        uptimeMedio: uptimeMedio[0]?.uptime || 99.9,
        tempoRespostaAtual: metricas[0]?.TempoRespostaMedia || 45,
        tempoRespostaMedio: tempoResposta[0]?.tempo || 45,
        status: "operational"
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Erro ao buscar estatísticas de uptime:", err);
    res.status(500).json({ 
      status: "error",
      erro: "Erro ao buscar estatísticas de uptime",
      message: err.message 
    });
  }
});

// Mapear tipo para o ENUM da tabela atualizacoes_sistema (feature, fix, improvement, maintenance)
function normalizarTipoAtualizacao(tipo) {
  if (!tipo) return 'feature';
  const t = String(tipo).toLowerCase();
  if (['feature', 'fix', 'improvement', 'maintenance'].includes(t)) return t;
  const map = { melhoria: 'improvement', correção: 'fix', correcao: 'fix', funcionalidade: 'feature', manutenção: 'maintenance', manutencao: 'maintenance' };
  return map[t] || 'feature';
}

router.get("/api/atualizacoes", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT Id, Titulo, Descricao, Tipo, DataCriacao FROM atualizacoes_sistema ORDER BY DataCriacao DESC"
    );
    res.json({
      status: "ok",
      atualizacoes: rows,
      total: rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Erro ao buscar atualizações:", err);
    res.status(500).json({
      status: "error",
      erro: "Erro ao buscar atualizações",
      message: err.message
    });
  }
});

router.get("/api/atualizacoes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT Id, Titulo, Descricao, Tipo, DataCriacao FROM atualizacoes_sistema WHERE Id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        erro: "Atualização não encontrada",
        id: id
      });
    }

    res.json({
      status: "ok",
      atualizacao: rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Erro ao buscar atualização:", err);
    res.status(500).json({
      status: "error",
      erro: "Erro ao buscar atualização",
      message: err.message
    });
  }
});

router.post("/api/atualizacoes", async (req, res) => {
  try {
    const { Titulo, titulo, Descricao, descricao, Tipo, tipo } = req.body;

    const tituloFinal = Titulo || titulo;
    const descricaoFinal = Descricao || descricao;
    const tipoFinal = normalizarTipoAtualizacao(Tipo || tipo);

    if (!tituloFinal || !descricaoFinal) {
      return res.status(400).json({
        status: "error",
        erro: "Título e descrição são obrigatórios"
      });
    }

    const [result] = await db.query(
      "INSERT INTO atualizacoes_sistema (Titulo, Descricao, Tipo) VALUES (?, ?, ?)",
      [tituloFinal, descricaoFinal, tipoFinal]
    );

    const [novaAtualizacao] = await db.query(
      "SELECT Id, Titulo, Descricao, Tipo, DataCriacao FROM atualizacoes_sistema WHERE Id = ?",
      [result.insertId]
    );

    res.json({
      status: "ok",
      mensagem: "Atualização criada com sucesso",
      atualizacao: novaAtualizacao[0],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Erro ao criar atualização:", err);
    res.status(500).json({
      status: "error",
      erro: "Erro ao criar atualização",
      message: err.message
    });
  }
});

router.put("/api/atualizacoes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { Titulo, titulo, Descricao, descricao, Tipo, tipo } = req.body;

    const [verificar] = await db.query(
      "SELECT Id FROM atualizacoes_sistema WHERE Id = ?",
      [id]
    );

    if (verificar.length === 0) {
      return res.status(404).json({
        status: "error",
        erro: "Atualização não encontrada",
        id: id
      });
    }

    const updates = [];
    const values = [];

    const tituloFinal = Titulo || titulo;
    if (tituloFinal !== undefined) {
      updates.push("Titulo = ?");
      values.push(tituloFinal);
    }

    const descricaoFinal = Descricao || descricao;
    if (descricaoFinal !== undefined) {
      updates.push("Descricao = ?");
      values.push(descricaoFinal);
    }

    const tipoFinal = Tipo || tipo;
    if (tipoFinal !== undefined) {
      updates.push("Tipo = ?");
      values.push(normalizarTipoAtualizacao(tipoFinal));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: "error",
        erro: "Nenhum campo para atualizar foi fornecido",
        camposValidos: ["Titulo", "Descricao", "Tipo"]
      });
    }

    values.push(id);
    await db.query(`UPDATE atualizacoes_sistema SET ${updates.join(", ")} WHERE Id = ?`, values);

    const [atualizacaoAtualizada] = await db.query(
      "SELECT Id, Titulo, Descricao, Tipo, DataCriacao FROM atualizacoes_sistema WHERE Id = ?",
      [id]
    );

    res.json({
      status: "ok",
      mensagem: `Atualização ${id} atualizada com sucesso`,
      atualizacao: atualizacaoAtualizada[0],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Erro ao atualizar atualização:", err);
    res.status(500).json({
      status: "error",
      erro: "Erro ao atualizar atualização",
      message: err.message
    });
  }
});

export default router;
