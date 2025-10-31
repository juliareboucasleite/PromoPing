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
import rateLimit from "express-rate-limit";

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


// ================== IMPORTS DE ROTAS ==================
import authRoutes from "./routes/auth.js";                     // Login/Registro + Google OAuth
import produtosRoutes from "./routes/produtos.js";            // Produtos
import configRoutes from "./routes/config.js";                // Configurações
import userRoutes from "./routes/user.js";                    // Usuários
import notificacoesRoutes from "./routes/notificacoes.js";    // Notificações
import contasRoutes from "./routes/contas.js";                // Contas
import preferencesRoutes from "./routes/preferences.js";      // Preferências
import authEmailVerifyRoutes from "./routes/auth-email-verify.js"; // Verificação email
import paymentRoutes from "./routes/payment.js";              // Pagamentos
import statusRoutes from "./routes/status.js";                // Status
import chartsRoutes from "./routes/charts.js";                // Gráficos/series
import exportRoutes from "./routes/exportRoutes.js";         // Exportação
import gracePeriodRoutes from "./routes/grace-period.js";    // Períodos de graça
import supportRoutes from "./routes/support.js";             // Suporte
import githubRoutes from "./routes/github.js";               // GitHub API

// ================== MIDDLEWARE ==================
import { verifyToken } from "./middleware/auth.js";            // JWT

// ================== DATABASE ==================
import { pool } from "./database/db.js";                       // Pool de conexão

// ================== SERVIÇOS ==================
import { sendNotification } from "./services/notify.js";        // Notificações

// ================== CONFIGURAÇÃO DO EXPRESS ==================
const app = express();
app.use(cookieParser());  // Cookies
app.use(express.json());  // JSON parsing

// ================== RATE LIMITING ==================
// Rate limiting geral para todas as rotas
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // máximo 500 requisições por IP por janela (aumentado)
  message: {
    error: "Muitas requisições deste IP, tente novamente em 15 minutos",
    retryAfter: "15 minutos"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting mais restritivo para APIs de autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // máximo 50 tentativas de login por IP por janela (aumentado para desenvolvimento)
  message: {
    error: "Muitas tentativas de login, tente novamente em 15 minutos",
    retryAfter: "15 minutos"
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Rate limiting mais permissivo para OAuth (Google, Discord, etc.)
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 tentativas OAuth por IP por janela
  message: {
    error: "Muitas tentativas de OAuth, tente novamente em 15 minutos",
    retryAfter: "15 minutos"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para APIs de produtos (mais permissivo para usuários autenticados)
const productLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // máximo 100 requisições por IP por minuto (aumentado)
  message: {
    error: "Muitas requisições de produtos, tente novamente em 1 minuto",
    retryAfter: "1 minuto"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar rate limiting geral
app.use(generalLimiter);

// ================== CONFIGURAÇÃO CORS ==================
// CORS baseado no .env - SEGURO
const allowedOrigins = [
  `http://localhost:${process.env.PORT || 3000}`,
  `http://127.0.0.1:${process.env.PORT || 3000}`,
  `http://localhost:8080`,
  `http://127.0.0.1:8080`,
  `http://localhost:5500`,
  `http://127.0.0.1:5500`,
  // Suporte para páginas servidas via Apache/XAMPP sem porta explícita
  `http://localhost`,
  `http://127.0.0.1`,
  // file:// removido por segurança
];

// Adicionar domínios do .env se existirem
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.ALLOWED_ORIGINS) {
  const customOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  allowedOrigins.push(...customOrigins);
}

// Função para validar origem
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requisições sem origem (ex: mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    // Verificar se a origem está na lista permitida
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Não permitido pelo CORS'));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// ================== ROTAS DE AUTENTICAÇÃO ==================
// Aplicar rate limiting específico para cada tipo de autenticação
app.use("/api/auth/google", oauthLimiter);   // Google OAuth - mais permissivo
app.use("/api/auth/discord", oauthLimiter);  // Discord OAuth - mais permissivo
app.use("/api/auth", authLimiter);           // Login/Registro tradicional - mais restritivo
app.use("/api/auth", authRoutes);            // Login/Registro + Google OAuth
app.use("/api/auth", authEmailVerifyRoutes); // Verificação email

// ================== ROTAS ==================
app.get("/api/user/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Buscar dados completos do usuário incluindo foto de perfil
    try {
      const [rows] = await pool.query(
        "SELECT Id, Nome, Email, Telefone, FotoPerfil, Data_Registo, cidade, location FROM Utilizadores WHERE Id = ?",
        [userId]
      );
      
      if (rows.length > 0) {
        const user = rows[0];
        return res.json({ 
          status: "ok", 
          user: {
            id: user.Id,
            nome: user.Nome || user.name,
            name: user.Nome || user.name,
            email: user.Email || user.email,
            telefone: user.Telefone || user.phone,
            phone: user.Telefone || user.phone,
            fotoPerfil: user.FotoPerfil || user.fotoPerfil,
            cidade: user.cidade || user.location,
            location: user.cidade || user.location
          }
        });
      }
    } catch (dbErr) {
      // Se campo FotoPerfil não existe, buscar sem ele
      const [rows] = await pool.query(
        "SELECT Id, Nome, Email, Telefone, Data_Registo FROM Utilizadores WHERE Id = ?",
        [userId]
      );
      
      if (rows.length > 0) {
        const user = rows[0];
        return res.json({ 
          status: "ok", 
          user: {
            id: user.Id,
            nome: user.Nome || user.name,
            name: user.Nome || user.name,
            email: user.Email || user.email,
            telefone: user.Telefone || user.phone,
            phone: user.Telefone || user.phone
          }
        });
      }
    }
    
    // Fallback para dados do token
    res.json({ status: "ok", user: req.user });
  } catch (err) {
    console.error("Erro ao buscar dados do usuário:", err);
    res.json({ status: "ok", user: req.user });
  }
});

// Aplicar rate limiting para produtos
app.use("/api/produtos", productLimiter);
app.use("/api/produtos", produtosRoutes);        // Produtos
app.use("/api/config", configRoutes);            // Configurações
app.use("/api/user", userRoutes);               // Usuários
app.use("/api/notificacoes", notificacoesRoutes); // Notificações
app.use("/api/grace-period", gracePeriodRoutes); // Períodos de graça
app.use("/api/user/accounts", contasRoutes);      // Contas
app.use("/api/user/preferences", preferencesRoutes); // Preferências
app.use("/api/payment", paymentRoutes);          // Pagamentos
app.use("/api/exportar", exportRoutes);         // Exportação
app.use("/api/support", supportRoutes);         // Suporte (GET/POST) - caminho específico
app.use("/", githubRoutes);                     // GitHub API (releases)
app.use("/", statusRoutes);                      // Status
app.use("/", chartsRoutes);                      // Charts

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

// ================== SERVIÇOS DE INCLUDES ==================
// Servir includes específicos ANTES dos arquivos estáticos
app.get("/inc/header.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/header.html"));
});

app.get("/inc/header-login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/header-login.html"));
});

app.get("/inc/header-register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/header-register.html"));
});

app.get("/inc/footer.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/footer.html"));
});

app.get("/inc/load-includes.js", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/load-includes.js"));
});

app.get("/inc/load-includes-index.js", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/load-includes-index.js"));
});

app.get("/inc/load-includes-login.js", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/load-includes-login.js"));
});

app.get("/inc/load-includes-register.js", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/load-includes-register.js"));
});

// ================== FRONTEND ESTÁTICO ==================
app.use(express.static(path.join(__dirname, "../frontend")));

// Rota para ignorar requests do Chrome DevTools
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ================== ROTAS DISCORD DIRETAS ==================
// Discord OAuth - redirecionar para API
app.get("/auth/discord", (req, res) => {
  res.redirect("/api/auth/discord");
});

app.get("/auth/discord/callback", (req, res) => {
  // Preservar os parâmetros da query string
  const queryString = new URLSearchParams(req.query).toString();
  res.redirect(`/api/auth/discord/callback?${queryString}`);
});

// ================== ROTAS DO FRONTEND ==================
// Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/index.html"));
});

// Páginas principais
app.get("/monitoramento", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/monitoramento.html"));
});

app.get("/alertas", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/alertas.html"));
});

app.get("/relatorios", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/relatorios.html"));
});

app.get("/casos-uso", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/casos-uso.html"));
});

app.get("/blog", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/blog.html"));
});

// Páginas de autenticação
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/Login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/register.html"));
});

// Rotas adicionais para compatibilidade com frontend
app.get("/inc/Login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/Login.html"));
});

app.get("/inc/register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/inc/register.html"));
});

// Páginas do dashboard
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/dashboard/Painel.html"));
});

app.get("/dashboard/painel", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/dashboard/Painel.html"));
});

app.get("/dashboard/perfil", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/dashboard/perfil.html"));
});

app.get("/dashboard/planos", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/dashboard/planos.html"));
});

app.get("/dashboard/produtos", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/dashboard/produtos.html"));
});

// Rotas adicionais para compatibilidade com frontend (com .html)
app.get("/dashboard/Painel.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/dashboard/Painel.html"));
});

app.get("/dashboard/perfil.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/dashboard/perfil.html"));
});

app.get("/dashboard/planos.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/dashboard/planos.html"));
});

app.get("/dashboard/produtos.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/dashboard/produtos.html"));
});

// Páginas de documentação
app.get("/docs", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/docs/docs.html"));
});

app.get("/docs/support", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/docs/support.html"));
});

app.get("/docs/service-status", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/docs/service-status.html"));
});

app.get("/docs/terms", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/docs/terms.html"));
});

app.get("/docs/usage-guide", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/docs/usage-guide.html"));
});

app.get("/docs/api-reference", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/docs/api-reference.html"));
});

app.get("/docs/FirstLaunch", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/docs/FirstLaunch.html"));
});

// Redirecionamento baseado no .env
app.get("/redirect", (req, res) => {
  const redirectUrl = process.env.REDIRECT_URL || `http://localhost:${process.env.PORT || 3000}`;
  res.redirect(redirectUrl);
});


// ================== MIDDLEWARE 404 ==================
// Captura todas as rotas não encontradas e redireciona para a página 404 personalizada
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "../frontend/pages/404.html"));
});

// ================== IMPORTAR SERVIÇOS ==================
import { GracePeriodManager } from './services/gracePeriodManager.js';

// ================== INICIAR SERVIDOR ==================
const HOST = process.env.HOST || "127.0.0.1";
const PORT = process.env.PORT || 3000;

app.listen(PORT, HOST, async () => {
  console.log(`PromoPing rodando em http://${HOST}:${PORT}`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`Frontend: http://${HOST}:${PORT}/`);
    console.log(`API: http://${HOST}:${PORT}/api/`);
    console.log(`Cron: atualização automática a cada 6 horas`);
  }
  
  // Iniciar verificação automática de períodos de graça
  try {
    await GracePeriodManager.startAutomaticCheck();
  } catch (error) {
    console.error('Erro ao iniciar verificação automática de períodos de graça:', error);
  }
});