import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { runPriceMonitoring, startPriceMonitoring, stopPriceMonitoring, getMonitoringStats } from "../services/monitor.js";
import { getAlertStats } from "../services/alerts.js";

const router = express.Router();

// Referência global para o interval do monitoramento
let monitoringInterval = null;

/**
 * 🔍 Executar monitoramento manual
 */
router.post("/run", verifyToken, async (req, res) => {
  try {
    console.log("🔄 Executando monitoramento manual...");
    
    const stats = await runPriceMonitoring();
    
    res.json({
      status: "ok",
      message: "Monitoramento executado com sucesso",
      stats
    });
    
  } catch (error) {
    console.error("❌ Erro no monitoramento manual:", error.message);
    res.status(500).json({
      status: "error",
      error: "Erro ao executar monitoramento"
    });
  }
});

/**
 * ⏰ Iniciar monitoramento automático
 */
router.post("/start", verifyToken, async (req, res) => {
  try {
    if (monitoringInterval) {
      return res.status(400).json({
        status: "error",
        error: "Monitoramento já está ativo"
      });
    }
    
    const intervalMinutes = req.body.intervalMinutes || 30;
    
    monitoringInterval = startPriceMonitoring(intervalMinutes);
    
    res.json({
      status: "ok",
      message: `Monitoramento automático iniciado (${intervalMinutes}min)`,
      interval: intervalMinutes
    });
    
  } catch (error) {
    console.error("❌ Erro ao iniciar monitoramento:", error.message);
    res.status(500).json({
      status: "error",
      error: "Erro ao iniciar monitoramento"
    });
  }
});

/**
 * 🛑 Parar monitoramento automático
 */
router.post("/stop", verifyToken, async (req, res) => {
  try {
    if (!monitoringInterval) {
      return res.status(400).json({
        status: "error",
        error: "Monitoramento não está ativo"
      });
    }
    
    stopPriceMonitoring(monitoringInterval);
    monitoringInterval = null;
    
    res.json({
      status: "ok",
      message: "Monitoramento automático parado"
    });
    
  } catch (error) {
    console.error("❌ Erro ao parar monitoramento:", error.message);
    res.status(500).json({
      status: "error",
      error: "Erro ao parar monitoramento"
    });
  }
});

/**
 * 📊 Obter estatísticas do monitoramento
 */
router.get("/stats", verifyToken, async (req, res) => {
  try {
    const [monitoringStats, alertStats] = await Promise.all([
      getMonitoringStats(),
      getAlertStats()
    ]);
    
    res.json({
      status: "ok",
      monitoring: monitoringStats,
      alerts: alertStats,
      isActive: monitoringInterval !== null
    });
    
  } catch (error) {
    console.error("❌ Erro ao obter estatísticas:", error.message);
    res.status(500).json({
      status: "error",
      error: "Erro ao obter estatísticas"
    });
  }
});

/**
 * 🔄 Status do monitoramento
 */
router.get("/status", verifyToken, async (req, res) => {
  try {
    res.json({
      status: "ok",
      isActive: monitoringInterval !== null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Erro ao obter status:", error.message);
    res.status(500).json({
      status: "error",
      error: "Erro ao obter status"
    });
  }
});

export default router;
