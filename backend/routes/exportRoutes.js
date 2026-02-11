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
import { verifyToken } from "../middleware/auth.js"; // Middleware de autenticação existente

const router = express.Router();

/**
 * GET /api/user/plano
 * Obter informações do plano do usuário
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
 * Exportar relatório completo (Premium apenas)
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
      exportar_pdf: ["Basic", "Standard", "Premium"].includes(plano.nome),
      relatorio_completo: plano.nome === "Premium",
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
