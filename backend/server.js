// @ts-nocheck
// PromoPing - Servidor principal do sistema de monitoramento de preços
// Silenciar dotenv globalmente
process.env.DOTENV_CONFIG_SILENT = 'true';
process.env.DOTENV_CONFIG_DEBUG = 'false';

// Interceptar console.log para filtrar mensagens do dotenv
const originalConsoleLog = console.log;
console.log = (...args) => {
  const message = args.join(' ');
  if (!message.includes('[dotenv@') && !message.includes('injecting env')) {
    originalConsoleLog(...args);
  }
};

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

// Carrega variáveis de ambiente do .env
dotenv.config({ 
  path: join(__dirname, "../.env"), 
  silent: true,
  debug: false,
  override: false,
  quiet: true
});

// Debug de variáveis críticas removido para logs mais limpos

// ================== IMPORTS DE ROTAS ==================
import authGoogleRoutes from "./routes/auth-google.js";        // Google OAuth
import authRoutes from "./routes/auth.js";                     // Login/Registro
import produtosRoutes from "./routes/produtos.js";            // Produtos
import configRoutes from "./routes/config.js";                // Configurações
import userRoutes from "./routes/user.js";                    // Usuários
import notificacoesRoutes from "./routes/notificacoes.js";    // Notificações
import contasRoutes from "./routes/contas.js";                // Contas
import preferencesRoutes from "./routes/preferences.js";      // Preferências
import authEmailVerifyRoutes from "./routes/auth-email-verify.js"; // Verificação email
import paymentRoutes from "./routes/payment.js";              // Pagamentos
import statusRoutes from "./routes/status.js";                // Status
import exportRoutes from "./routes/exportRoutes.js";         // Exportação

// ================== MIDDLEWARE ==================
import { verifyToken } from "./middleware/auth.js";            // JWT

// ================== SERVIÇOS ==================
import { sendNotification } from "./services/notify.js";        // Notificações
import { atualizarPrecos } from "./services/atualizarPrecos.js"; // Atualização preços
// WhatsApp desabilitado temporariamente

// ================== CONFIGURAÇÃO DO EXPRESS ==================
const app = express();
app.use(cookieParser());  // Cookies
app.use(express.json());  // JSON parsing

// ================== CONFIGURAÇÃO CORS ==================
// CORS baseado no .env
const allowedOrigins = [
  `http://localhost:${process.env.PORT || 3000}`,
  `http://127.0.0.1:${process.env.PORT || 3000}`,
  `http://localhost:8080`,
  `http://127.0.0.1:8080`,
  `http://localhost:5500`,
  `http://127.0.0.1:5500`,
  "file://",
];

// Adicionar domínios do .env se existirem
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.ALLOWED_ORIGINS) {
  const customOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  allowedOrigins.push(...customOrigins);
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ================== ROTAS DE AUTENTICAÇÃO ==================
app.use("/api/auth", authGoogleRoutes);      // Google OAuth
app.use("/api/auth", authRoutes);            // Login/Registro
app.use("/api/auth", authEmailVerifyRoutes); // Verificação email

// ================== ROTAS ==================
app.get("/api/user/me", verifyToken, (req, res) => {
  res.json({ status: "ok", user: req.user });
});

app.use("/api/produtos", produtosRoutes);        // Produtos
app.use("/api/config", configRoutes);            // Configurações
app.use("/api/user", userRoutes);               // Usuários
app.use("/api/notificacoes", notificacoesRoutes); // Notificações
app.use("/api/user/accounts", contasRoutes);      // Contas
app.use("/api/user/preferences", preferencesRoutes); // Preferências
app.use("/api/payment", paymentRoutes);          // Pagamentos
app.use("/api/exportar", exportRoutes);         // Exportação
app.use("/", statusRoutes);                      // Status

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

// Redirecionamento baseado no .env
app.get("/redirect", (req, res) => {
  const redirectUrl = process.env.REDIRECT_URL || `http://localhost:${process.env.PORT || 3000}`;
  res.redirect(redirectUrl);
});

// ================== AGENDAMENTO CRON ==================
import cron from "node-cron";

// A cada 6 horas (ajusta como quiser)
// formato cron: "0 */6 * * *" = de 6h em 6h
cron.schedule("0 */6 * * *", async () => {
  console.log("Executando atualização automática de preços...");
  try {
    await atualizarPrecos();
    console.log("Atualização automática concluída com sucesso");
  } catch (error) {
    console.error("Erro na atualização automática:", error);
  }
});

// ================== INICIAR SERVIDOR ==================
const HOST = process.env.HOST || "127.0.0.1";
const PORT = process.env.PORT || 3000;

app.listen(PORT, HOST, () => {
  console.log(`PromoPing rodando em http://${HOST}:${PORT}`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`Frontend: http://${HOST}:${PORT}/`);
    console.log(`API: http://${HOST}:${PORT}/api/`);
    console.log(`Cron: atualização automática a cada 6 horas`);
  }
});
