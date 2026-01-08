// ================== ROTAS DE EXPORTAÇÃO COM PROTEÇÃO DE PLANOS ==================

import express from "express";
import { 
  exportarExcel, 
  exportarPDF, 
  exportarIncidentesExcel, 
  exportarRelatorioCompleto,
  obterPlanoUsuario 
} from "../controllers/exportController.js";
import { 
  verificarPlanoPermitido, 
  verificarPlanoPago, 
  verificarPlanoStandard, 
  verificarPlanoPremium,
  obterInfoPlano 
} from "../middleware/verificarPlano.js";
import { verifyToken } from "../middleware/auth.js"; // Middleware de autenticação existente

const router = express.Router();

// ================== ROTAS DE INFORMAÇÕES ==================

/**
 * GET /api/user/plano
 * Obter informações do plano do usuário
 */
router.get("/user/plano", verifyToken, obterPlanoUsuario);

// ================== ROTAS DE EXPORTAÇÃO DE PRODUTOS ==================

/**
 * GET /api/exportar/produtos/excel
 * Exportar produtos para Excel (Basic, Standard, Premium)
 */
router.get("/produtos/excel", 
  verifyToken, 
  obterInfoPlano,
  verificarPlanoPago(), 
  exportarExcel
);

/**
 * GET /api/exportar/produtos/pdf
 * Exportar produtos para PDF (Standard, Premium)
 */
router.get("/produtos/pdf", 
  verifyToken, 
  obterInfoPlano,
  verificarPlanoStandard(), 
  exportarPDF
);

// ================== ROTAS DE EXPORTAÇÃO DE INCIDENTES ==================

/**
 * GET /api/exportar/incidentes/excel
 * Exportar incidentes para Excel (Basic, Standard, Premium)
 */
router.get("/incidentes/excel", 
  verifyToken, 
  obterInfoPlano,
  verificarPlanoPago(), 
  exportarIncidentesExcel
);

// ================== ROTAS DE RELATÓRIOS PREMIUM ==================

/**
 * GET /api/exportar/relatorio/completo
 * Exportar relatório completo (Premium apenas)
 */
router.get("/relatorio/completo", 
  verifyToken, 
  obterInfoPlano,
  verificarPlanoPremium(), 
  exportarRelatorioCompleto
);

// ================== ROTAS DE EXPORTAÇÃO LEGACY (COMPATIBILIDADE) ==================

/**
 * GET /api/exportar/excel
 * Exportar Excel (Basic, Standard, Premium) - Rota legacy
 */
router.get("/excel", 
  verifyToken, 
  obterInfoPlano,
  verificarPlanoPago(), 
  exportarExcel
);

/**
 * GET /api/exportar/pdf
 * Exportar PDF (Standard, Premium) - Rota legacy
 */
router.get("/pdf", 
  verifyToken, 
  obterInfoPlano,
  verificarPlanoStandard(), 
  exportarPDF
);

// ================== ROTAS DE TESTE E DEBUG ==================

/**
 * GET /api/exportar/teste/plano
 * Testar verificação de plano (apenas para desenvolvimento)
 */
router.get("/teste/plano", verifyToken, obterInfoPlano, (req, res) => {
  res.json({
    status: "ok",
    message: "Teste de verificação de plano",
    plano: req.planoInfo,
    usuario: {
      ReferenciaID: req.user.ReferenciaID,
      email: req.user.email
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/exportar/status
 * Status das funcionalidades de exportação
 */
router.get("/status", verifyToken, obterInfoPlano, (req, res) => {
  const plano = req.planoInfo;
  
  res.json({
    status: "ok",
    plano: plano.nome,
    funcionalidades: {
      exportar_excel: ["Basic", "Standard", "Premium"].includes(plano.nome),
      exportar_pdf: ["Standard", "Premium"].includes(plano.nome),
      relatorio_completo: plano.nome === "Premium",
      limites: plano.limites,
      recursos: plano.recursos
    },
    timestamp: new Date().toISOString()
  });
});

// ================== MIDDLEWARE DE TRATAMENTO DE ERROS ==================

/**
 * Middleware para tratar erros de acesso negado
 */
router.use((err, req, res, next) => {
  if (err.status === 403) {
    return res.status(403).json({
      status: "error",
      message: "Acesso negado - plano insuficiente",
      error: err.message,
      upgrade_url: "/planos.html",
      timestamp: new Date().toISOString()
    });
  }
  
  if (err.status === 401) {
    return res.status(401).json({
      status: "error",
      message: "Não autorizado - faça login primeiro",
      login_url: "/Login.html",
      timestamp: new Date().toISOString()
    });
  }
  
  next(err);
});

export default router;
