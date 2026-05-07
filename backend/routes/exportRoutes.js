import express from "express";
import {
  exportarPDF,
  exportarRelatorioCompleto,
  obterPlanoUsuario
} from "../controllers/exportController.js";
import {
  carregarPlanoNoRequest,
  verificarPlanoPermitido,
  verificarPlanoPago,
  verificarPlanoStandard,
  verificarPlanoPremium,
  obterInfoPlano
} from "../middleware/verificarPlano.js";
import { verifyToken } from "../middleware/auth.js"; // Middleware de autenticaÃ§Ã£o existente

const router = express.Router();

/**
 * GET /api/user/plano
 * Obter informaÃ§Ãµes do plano do usuÃ¡rio
 */
router.get("/user/plano", verifyToken, obterPlanoUsuario);

/**
 * GET /api/exportar/produtos/pdf
 * Exportar produtos para PDF (Basic, Standard, Premium)
 */
router.get("/produtos/pdf",
  verifyToken,
  carregarPlanoNoRequest,
  obterInfoPlano,
  verificarPlanoPago(),
  exportarPDF
);

/**
 * GET /api/exportar/relatorio/completo
 * Exportar relatÃ³rio completo (Premium apenas)
 */
router.get("/relatorio/completo",
  verifyToken,
  carregarPlanoNoRequest,
  obterInfoPlano,
  verificarPlanoPremium(),
  exportarRelatorioCompleto
);

/**
 * GET /api/exportar/pdf
 * Exportar PDF (Standard, Premium) - Rota legacy
 */
router.get("/pdf",
  verifyToken,
  carregarPlanoNoRequest,
  obterInfoPlano,
  verificarPlanoPago(),
  exportarPDF
);

/**
 * GET /api/exportar/teste/plano
 * Testar verificaÃ§Ã£o de plano (apenas para desenvolvimento)
 */
router.get("/teste/plano", verifyToken, obterInfoPlano, (req, res) => {
  res.json({
    status: "ok",
    message: "Teste de verificaÃ§Ã£o de plano",
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
 * Status das funcionalidades de exportaÃ§Ã£o
 */
router.get("/status", verifyToken, obterInfoPlano, (req, res) => {
  const plano = req.planoInfo;
  
  res.json({
    status: "ok",
    plano: plano.nome,
    funcionalidades: {
      exportar_pdf: ["Basic", "Standard", "Premium", "Corporate"].includes(plano.nome),
      relatorio_completo: ["Premium", "Corporate"].includes(plano.nome),
      limites: plano.limites,
      recursos: plano.recursos
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Middleware para tratar erros de acesso negado
 */
router.use((err, req, res, next) => {
  if (err.status === 403) {
    return res.status(403).json({
      status: "error",
      message: "Acesso negado - plano insuficiente",
      error: err.message,
      upgrade_url: "/dashboard/subscription-plans.html",
      timestamp: new Date().toISOString()
    });
  }
  
  if (err.status === 401) {
    return res.status(401).json({
      status: "error",
      message: "NÃ£o autorizado - faÃ§a login primeiro",
      login_url: "/login",
      timestamp: new Date().toISOString()
    });
  }
  
  next(err);
});

export default router;

