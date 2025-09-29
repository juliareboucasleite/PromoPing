// @ts-nocheck
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";

// Importa rotas
import authGoogleRoutes from "./routes/auth-google.js";
import authRoutes from "./routes/auth.js";
import produtosRoutes from "./routes/produtos.js";
import configRoutes from "./routes/config.js";
import scrapeRoute from "./routes/scrape.js";
import userRoutes from "./routes/user.js";
import notificacoesRoutes from "./routes/notificacoes.js";
import contasRoutes from "./routes/contas.js";
import preferencesRoutes from "./routes/preferences.js";

// Importa middleware
import { verifyToken } from "./middleware/auth.js";

// Importa serviços
import { sendNotification } from "./services/notify.js";
import { startPriceChecker } from "./services/scrapers/price-checker.js";

// Express
const app = express();
app.use(cookieParser());

// ================== AUTENTICAÇÃO ==================
app.use("/auth", authGoogleRoutes); // login com Google
app.use("/auth", authRoutes);       // login/register local
import authEmailVerifyRoutes from "./routes/auth-email-verify.js";
app.use("/api/auth", authEmailVerifyRoutes);


// login/register com SMS
import authSMSRoutes from "./routes/auth-sms.js";
app.use("/api/auth", authSMSRoutes);



// ================== MIDDLEWARES ==================
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
app.use(express.json());

// ================== ROTAS DE AUTENTICAÇÃO ==================
app.get("/api/user/me", verifyToken, (req, res) => {
  res.json({ status: "ok", user: req.user });
});

// ================== ROTAS API ==================
app.use("/api/produtos", produtosRoutes);
app.use("/api/config", configRoutes);
app.use("/api/scrape", scrapeRoute);
app.use("/api/user", userRoutes);
app.use("/api/notificacoes", notificacoesRoutes);
app.use("/api/user/accounts", contasRoutes);
app.use("/api/user/preferences", preferencesRoutes);

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
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Inicia checker periódico
  startPriceChecker();
});
