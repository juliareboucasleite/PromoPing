// @ts-nocheck
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";

// ================== CARREGAR VARIÁVEIS DE AMBIENTE ==================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Força o carregamento do .env que está na raiz do projeto
dotenv.config({ path: join(__dirname, "../.env") });

// Debug de variáveis críticas
console.log("🔑 JWT_SECRET:", process.env.JWT_SECRET ? "OK" : "NÃO CARREGADO");
console.log("🔍 DB Variáveis:");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "***" : "vazio");
console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_PORT:", process.env.DB_PORT);

// ================== IMPORTS DE ROTAS ==================
import authGoogleRoutes from "./routes/auth-google.js";
import authRoutes from "./routes/auth.js";
import produtosRoutes from "./routes/produtos.js";
import configRoutes from "./routes/config.js";
import scrapeRoute from "./routes/scrape.js";
import userRoutes from "./routes/user.js";
import notificacoesRoutes from "./routes/notificacoes.js";
import contasRoutes from "./routes/contas.js";
import preferencesRoutes from "./routes/preferences.js";
import authEmailVerifyRoutes from "./routes/auth-email-verify.js";
import authSMSRoutes from "./routes/auth-sms.js";
import monitorRoutes from "./routes/monitor.js";

// ================== MIDDLEWARE ==================
import { verifyToken } from "./middleware/auth.js";

// ================== SERVIÇOS ==================
import { sendNotification } from "./services/notify.js";
import { startPriceChecker } from "./services/scrapers/price-checker.js";
import { startPriceMonitoring } from "./services/monitor.js";

// ================== EXPRESS ==================
const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:8080",
      "http://localhost:3000",
      "http://localhost:5500",
    ],
    credentials: true,
  })
);

// ================== AUTENTICAÇÃO ==================
app.use("/api/auth", authGoogleRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/auth", authEmailVerifyRoutes);
app.use("/api/auth", authSMSRoutes);

// ================== ROTAS ==================
app.get("/api/user/me", verifyToken, (req, res) => {
  res.json({ status: "ok", user: req.user });
});

app.use("/api/produtos", produtosRoutes);
app.use("/api/config", configRoutes);
app.use("/api/scrape", scrapeRoute);
app.use("/api/user", userRoutes);
app.use("/api/notificacoes", notificacoesRoutes);
app.use("/api/user/accounts", contasRoutes);
app.use("/api/user/preferences", preferencesRoutes);
app.use("/api/monitor", monitorRoutes);

// ================== HEALTH CHECK ==================
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
  });
});

// ================== API ROOT ==================
app.get("/api/", (req, res) => {
  res.json({
    status: "ok",
    message: "PromoPing API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth/",
      produtos: "/api/produtos/",
      user: "/api/user/",
      notificacoes: "/api/notificacoes/",
      monitor: "/api/monitor/",
      health: "/api/health",
    },
  });
});

// ================== NOTIFICAÇÕES DIRETAS ==================
app.post("/notify", async (req, res) => {
  try {
    const { canal, email, telefone, mensagem } = req.body;

    if (!mensagem || !canal) {
      return res.status(400).json({
        error: "Campos obrigatórios: mensagem e canal (email ou sms)",
      });
    }

    await sendNotification({ canal, email, telefone, mensagem });
    res.json({ status: "ok", canal, mensagem });
  } catch (err) {
    console.error("Erro na notificação:", err);
    res.status(500).json({ error: err.message || "erro desconhecido" });
  }
});

// ================== FRONTEND ESTÁTICO ==================
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/index.html"));
});

// ================== INICIAR SERVIDOR ==================
const HOST = process.env.HOST || "127.0.0.1";
const PORT = process.env.PORT || 3000;

app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor PromoPing rodando em http://${HOST}:${PORT}`);
  console.log(`📁 Frontend: http://${HOST}:${PORT}/`);
  console.log(`🔧 API: http://${HOST}:${PORT}/api/`);

  // Inicia checker periódico (sistema antigo)
  startPriceChecker();
  
  // Inicia monitoramento automático (sistema novo)
  console.log("🔄 Iniciando monitoramento automático de preços...");
  startPriceMonitoring(30); // 30 minutos de intervalo
  console.log("✅ Monitoramento automático ativo (30min)");
});
