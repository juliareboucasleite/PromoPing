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
import fs from "fs";
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

// Trust proxy para funcionar corretamente com NGINX/proxy reverso
// Em produção, confiar apenas no primeiro proxy (NGINX)
// Em desenvolvimento, confiar apenas em localhost (usando IPs válidos)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Confiar apenas no primeiro proxy
} else {
  // Em desenvolvimento, confiar apenas em localhost (127.0.0.1 e ::1)
  app.set('trust proxy', ['127.0.0.1', '::1']);
}

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
const isDevelopment = process.env.NODE_ENV !== 'production';
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
  // Adicionar variações comuns do XAMPP
  `http://localhost:80`,
  `http://127.0.0.1:80`,
  // Domínios de produção
  `http://promoping.pt`,
  `https://promoping.pt`,
  `http://www.promoping.pt`,
  `https://www.promoping.pt`,
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
    // Permitir requisições sem origem (ex: mobile apps, Postman, mesma origem, requisições diretas)
    // Verificação mais robusta para null, undefined, string "null" ou string vazia
    // Requisições sem origem são sempre permitidas (mesma origem, Postman, etc)
    if (!origin || origin === 'null' || origin === '' || origin === 'undefined') {
      // Permite silenciosamente - não precisa log
      return callback(null, true);
    }
    
    // Verificar se a origem está na lista permitida
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Permitir promoping.pt em qualquer ambiente (produção e desenvolvimento)
    try {
      const url = new URL(origin);
      const hostname = url.hostname.toLowerCase();
      
      if (hostname === 'promoping.pt' || hostname === 'www.promoping.pt') {
        return callback(null, true);
      }
    } catch (e) {
      // URL inválida - continuar para verificar outras condições
    }
    
    // Em desenvolvimento, permitir qualquer origem localhost/127.0.0.1
    if (isDevelopment) {
      try {
        const url = new URL(origin);
        const hostname = url.hostname.toLowerCase();
        
        // Permitir localhost, 127.0.0.1 e 0.0.0.0 em qualquer porta em desenvolvimento
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1') {
          // Permite silenciosamente em desenvolvimento
          return callback(null, true);
        }
        
        // Permitir IPs locais em desenvolvimento (192.168.x.x, 10.x.x.x, etc)
        const ipParts = hostname.split('.');
        if (ipParts.length === 4) {
          const firstOctet = parseInt(ipParts[0]);
          if (firstOctet === 192 || firstOctet === 10 || (firstOctet === 172 && parseInt(ipParts[1]) >= 16 && parseInt(ipParts[1]) <= 31)) {
            // Permite silenciosamente em desenvolvimento
            return callback(null, true);
          }
        }
      } catch (e) {
        // URL inválida - continuar para verificar outras condições
      }
    }
    
    // Log da origem bloqueada para debug (apenas em desenvolvimento)
    if (isDevelopment) {
      console.warn(`[CORS] Origem bloqueada: ${origin} (Ambiente: ${process.env.NODE_ENV || 'development'})`);
    }
    
    callback(new Error('Não permitido pelo CORS'));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-admin-panel", "X-Admin-Panel"],
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
    
    // Buscar dados completos do usuário incluindo foto de perfil e PerfilId
    try {
      const [rows] = await pool.query(
        "SELECT Id, Nome, Email, Telefone, FotoPerfil, Data_Registo, cidade, location, PerfilId FROM Utilizadores WHERE Id = ?",
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
            location: user.cidade || user.location,
            perfilId: user.PerfilId || user.perfilId || null,
            PerfilId: user.PerfilId || user.perfilId || null
          }
        });
      }
    } catch (dbErr) {
      // Se campo FotoPerfil não existe, buscar sem ele mas com PerfilId
      try {
        const [rows] = await pool.query(
          "SELECT Id, Nome, Email, Telefone, Data_Registo, PerfilId FROM Utilizadores WHERE Id = ?",
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
              perfilId: user.PerfilId || user.perfilId || null,
              PerfilId: user.PerfilId || user.perfilId || null
            }
          });
        }
      } catch (dbErr2) {
        console.error("Erro ao buscar dados do usuário:", dbErr2);
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

// ================== VERIFICAR PASTA BUILD ==================
// Verificar se a pasta build existe (usado em várias partes do código)
const buildPath = path.join(__dirname, "../frontend/pages/build");
const buildExists = fs.existsSync(buildPath);

// ================== SERVIÇOS DE INCLUDES ==================
// Servir includes específicos ANTES dos arquivos estáticos
app.get("/inc/header.html", (req, res) => {
  const filePath = buildExists 
    ? path.join(buildPath, "inc/header.html")
    : path.join(__dirname, "../frontend/pages/inc/header.html");
  res.sendFile(filePath);
});

app.get("/inc/header-login.html", (req, res) => {
  const filePath = buildExists 
    ? path.join(buildPath, "inc/header-login.html")
    : path.join(__dirname, "../frontend/pages/inc/header-login.html");
  res.sendFile(filePath);
});

app.get("/inc/header-register.html", (req, res) => {
  const filePath = buildExists 
    ? path.join(buildPath, "inc/header-register.html")
    : path.join(__dirname, "../frontend/pages/inc/header-register.html");
  res.sendFile(filePath);
});

app.get("/inc/footer.html", (req, res) => {
  const filePath = buildExists 
    ? path.join(buildPath, "inc/footer.html")
    : path.join(__dirname, "../frontend/pages/inc/footer.html");
  res.sendFile(filePath);
});

app.get("/inc/load-includes.js", (req, res) => {
  const filePath = buildExists 
    ? path.join(buildPath, "inc/load-includes.js")
    : path.join(__dirname, "../frontend/pages/inc/load-includes.js");
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(filePath);
});

app.get("/inc/load-includes-index.js", (req, res) => {
  const filePath = buildExists 
    ? path.join(buildPath, "inc/load-includes-index.js")
    : path.join(__dirname, "../frontend/pages/inc/load-includes-index.js");
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(filePath);
});

app.get("/inc/load-includes-login.js", (req, res) => {
  const filePath = buildExists 
    ? path.join(buildPath, "inc/load-includes-login.js")
    : path.join(__dirname, "../frontend/pages/inc/load-includes-login.js");
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(filePath);
});

app.get("/inc/load-includes-register.js", (req, res) => {
  const filePath = buildExists 
    ? path.join(buildPath, "inc/load-includes-register.js")
    : path.join(__dirname, "../frontend/pages/inc/load-includes-register.js");
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(filePath);
});

// ================== OPENAPI SPEC ==================
app.get("/openapi.yaml", (req, res) => {
  res.setHeader("Content-Type", "application/yaml");
  res.sendFile(path.join(__dirname, "../openapi.yaml"));
});

// ================== FRONTEND ESTÁTICO ==================
// Em produção, o NGINX serve o frontend estático
// Em desenvolvimento, o Express serve o frontend
const isProduction = process.env.NODE_ENV === 'production' && process.env.SERVE_FRONTEND !== 'true';

if (!isProduction) {
  // Servir arquivos estáticos apenas em desenvolvimento
  // Usar a pasta build se existir, senão usar frontend direto
  // buildPath e buildExists já foram definidos acima
  const frontendPath = path.join(__dirname, "../frontend");
  
  if (buildExists) {
    // Servir da pasta build
    app.use(express.static(buildPath));
  } else {
    // Fallback para frontend direto
    app.use(express.static(frontendPath));
  }
  
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
    const indexPath = buildExists 
      ? path.join(buildPath, "index.html")
      : path.join(__dirname, "../frontend/pages/index.html");
    res.sendFile(indexPath);
  });

  // Páginas principais
  app.get("/monitoramento", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "About/monitoramento.html")
      : path.join(__dirname, "../frontend/pages/inc/monitoramento.html");
    res.sendFile(filePath);
  });

  app.get("/alertas", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "About/alertas.html")
      : path.join(__dirname, "../frontend/pages/inc/alertas.html");
    res.sendFile(filePath);
  });

  app.get("/relatorios", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "About/relatorios.html")
      : path.join(__dirname, "../frontend/pages/inc/relatorios.html");
    res.sendFile(filePath);
  });

  app.get("/casos-uso", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "About/casos-uso.html")
      : path.join(__dirname, "../frontend/pages/inc/casos-uso.html");
    res.sendFile(filePath);
  });

  app.get("/blog", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "About/blog.html")
      : path.join(__dirname, "../frontend/pages/inc/blog.html");
    res.sendFile(filePath);
  });

  // Páginas de autenticação
  app.get("/login", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "business/create/login.html")
      : path.join(__dirname, "../frontend/pages/inc/Login.html");
    res.sendFile(filePath);
  });

  app.get("/register", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "business/create/registar.html")
      : path.join(__dirname, "../frontend/pages/inc/register.html");
    res.sendFile(filePath);
  });

  // Rotas adicionais para compatibilidade com frontend
  app.get("/inc/Login.html", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "business/create/login.html")
      : path.join(__dirname, "../frontend/pages/inc/Login.html");
    res.sendFile(filePath);
  });

  app.get("/inc/register.html", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "business/create/registar.html")
      : path.join(__dirname, "../frontend/pages/inc/register.html");
    res.sendFile(filePath);
  });

  // Página de recuperação de senha
  app.get("/forgot-password", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "inc/forgot-password.html")
      : path.join(__dirname, "../frontend/pages/inc/forgot-password.html");
    res.sendFile(filePath);
  });

  app.get("/inc/forgot-password.html", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "inc/forgot-password.html")
      : path.join(__dirname, "../frontend/pages/inc/forgot-password.html");
    res.sendFile(filePath);
  });

  // Páginas do dashboard
  app.get("/dashboard", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "dashboard/Painel.html")
      : path.join(__dirname, "../frontend/pages/dashboard/Painel.html");
    res.sendFile(filePath);
  });

  app.get("/dashboard/painel", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "dashboard/Painel.html")
      : path.join(__dirname, "../frontend/pages/dashboard/Painel.html");
    res.sendFile(filePath);
  });

  app.get("/dashboard/perfil", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "dashboard/perfil.html")
      : path.join(__dirname, "../frontend/pages/dashboard/perfil.html");
    res.sendFile(filePath);
  });

  app.get("/dashboard/planos", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "dashboard/planos.html")
      : path.join(__dirname, "../frontend/pages/dashboard/planos.html");
    res.sendFile(filePath);
  });

  app.get("/dashboard/produtos", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "dashboard/produtos.html")
      : path.join(__dirname, "../frontend/pages/dashboard/produtos.html");
    res.sendFile(filePath);
  });

  // Rotas adicionais para compatibilidade com frontend (com .html)
  app.get("/dashboard/Painel.html", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "dashboard/Painel.html")
      : path.join(__dirname, "../frontend/pages/dashboard/Painel.html");
    res.sendFile(filePath);
  });

  app.get("/dashboard/perfil.html", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "dashboard/perfil.html")
      : path.join(__dirname, "../frontend/pages/dashboard/perfil.html");
    res.sendFile(filePath);
  });

  app.get("/dashboard/planos.html", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "dashboard/planos.html")
      : path.join(__dirname, "../frontend/pages/dashboard/planos.html");
    res.sendFile(filePath);
  });

  app.get("/dashboard/produtos.html", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "dashboard/produtos.html")
      : path.join(__dirname, "../frontend/pages/dashboard/produtos.html");
    res.sendFile(filePath);
  });

  // Páginas de documentação
  app.get("/docs", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/docs.html")
      : path.join(__dirname, "../frontend/pages/docs/docs.html");
    res.sendFile(filePath);
  });

  app.get("/docs/support", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/support.html")
      : path.join(__dirname, "../frontend/pages/docs/support.html");
    res.sendFile(filePath);
  });

  app.get("/docs/service-status", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/service-status.html")
      : path.join(__dirname, "../frontend/pages/docs/service-status.html");
    res.sendFile(filePath);
  });

  app.get("/docs/terms", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/terms.html")
      : path.join(__dirname, "../frontend/pages/docs/terms.html");
    res.sendFile(filePath);
  });

  app.get("/docs/usage-guide", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/usage-guide.html")
      : path.join(__dirname, "../frontend/pages/docs/usage-guide.html");
    res.sendFile(filePath);
  });

  app.get("/docs/api-reference", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/api-reference.html")
      : path.join(__dirname, "../frontend/pages/docs/api-reference.html");
    res.sendFile(filePath);
  });

  app.get("/docs/FirstLaunch", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/FirstLaunch.html")
      : path.join(__dirname, "../frontend/pages/docs/FirstLaunch.html");
    res.sendFile(filePath);
  });

  app.get("/docs/faq", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/faq.html")
      : path.join(__dirname, "../frontend/pages/docs/faq.html");
    res.sendFile(filePath);
  });

  app.get("/docs/changelog", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/changelog.html")
      : path.join(__dirname, "../frontend/pages/docs/changelog.html");
    res.sendFile(filePath);
  });

  app.get("/docs/privacy", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/privacy.html")
      : path.join(__dirname, "../frontend/pages/docs/privacy.html");
    res.sendFile(filePath);
  });

  app.get("/docs/installation", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/installation.html")
      : path.join(__dirname, "../frontend/pages/docs/installation.html");
    res.sendFile(filePath);
  });

  app.get("/docs/incident-history", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/incident-history.html")
      : path.join(__dirname, "../frontend/pages/docs/incident-history.html");
    res.sendFile(filePath);
  });

  app.get("/docs/security-headers", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "docs/security-headers.html")
      : path.join(__dirname, "../frontend/pages/docs/security-headers.html");
    res.sendFile(filePath);
  });

  // Páginas About
  app.get("/about", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "About/about.html")
      : path.join(__dirname, "../frontend/pages/About/about.html");
    res.sendFile(filePath);
  });

  app.get("/about/alertas", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "About/alertas.html")
      : path.join(__dirname, "../frontend/pages/About/alertas.html");
    res.sendFile(filePath);
  });

  app.get("/about/blog", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "About/blog.html")
      : path.join(__dirname, "../frontend/pages/About/blog.html");
    res.sendFile(filePath);
  });

  app.get("/about/casos-uso", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "About/casos-uso.html")
      : path.join(__dirname, "../frontend/pages/About/casos-uso.html");
    res.sendFile(filePath);
  });

  app.get("/about/monitoramento", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "About/monitoramento.html")
      : path.join(__dirname, "../frontend/pages/About/monitoramento.html");
    res.sendFile(filePath);
  });

  app.get("/about/relatorios", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "About/relatorios.html")
      : path.join(__dirname, "../frontend/pages/About/relatorios.html");
    res.sendFile(filePath);
  });

  app.get("/about/privacy-cookies", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "About/privacy-cookies.html")
      : path.join(__dirname, "../frontend/pages/About/privacy-cookies.html");
    res.sendFile(filePath);
  });

  // Rotas adicionais para compatibilidade
  app.get("/business/create/login", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "business/create/login.html")
      : path.join(__dirname, "../frontend/pages/business/create/login.html");
    res.sendFile(filePath);
  });

  app.get("/business/create/registar", (req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "business/create/registar.html")
      : path.join(__dirname, "../frontend/pages/business/create/registar.html");
    res.sendFile(filePath);
  });

  // Redirecionamento baseado no .env
  app.get("/redirect", (req, res) => {
    const redirectUrl = process.env.REDIRECT_URL || `http://localhost:${process.env.PORT || 3000}`;
    res.redirect(redirectUrl);
  });

  // ================== MIDDLEWARE DE TRATAMENTO DE ERROS ==================
  // Garantir que CORS seja aplicado mesmo em erros
  app.use((err, req, res, next) => {
    // Aplicar CORS mesmo em caso de erro
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes(origin) || 
        origin.includes('promoping.pt') || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    console.error('Erro não tratado:', err);
    res.status(err.status || 500).json({
      status: 'error',
      message: err.message || 'Erro interno do servidor',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });

  // ================== MIDDLEWARE 404 ==================
  // Captura todas as rotas não encontradas e redireciona para a página 404 personalizada
  app.use((req, res) => {
    const filePath = buildExists 
      ? path.join(buildPath, "404.html")
      : path.join(__dirname, "../frontend/pages/404.html");
    res.status(404).sendFile(filePath);
  });
} else {
  // Em produção, apenas retornar 404 para rotas não-API
  app.use((req, res, next) => {
    // Se não começar com /api/, retornar 404 (NGINX deve servir o frontend)
    if (!req.path.startsWith('/api/') && req.path !== '/openapi.yaml') {
      return res.status(404).json({ error: 'Not found' });
    }
    next();
  });
  
  // Middleware de tratamento de erros em produção
  app.use((err, req, res, next) => {
    // Aplicar CORS mesmo em caso de erro
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes(origin) || 
        origin.includes('promoping.pt'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    console.error('Erro não tratado:', err);
    res.status(err.status || 500).json({
      status: 'error',
      message: err.message || 'Erro interno do servidor'
    });
  });
}

// ================== IMPORTAR SERVIÇOS ==================
import { GracePeriodManager } from './services/gracePeriodManager.js';
import { DeactivatedAccountsManager } from './services/deactivatedAccountsManager.js';

// ================== INICIAR SERVIDOR ==================
const HOST = process.env.HOST || "127.0.0.1";
const PORT = process.env.PORT || 3000;

app.listen(PORT, HOST, async () => {
  console.log(`PromoPing rodando em http://${HOST}:${PORT}`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`Frontend: http://${HOST}:${PORT}/ | API: http://${HOST}:${PORT}/api/`);
  }
  
  // Iniciar verificação automática de períodos de graça
  try {
    await GracePeriodManager.startAutomaticCheck();
  } catch (error) {
    console.error('Erro ao iniciar verificação automática de períodos de graça:', error);
  }
  
  // Iniciar verificação automática de contas desativadas
  try {
    await DeactivatedAccountsManager.startAutomaticCheck();
  } catch (error) {
    console.error('Erro ao iniciar verificação automática de contas desativadas:', error);
  }
});