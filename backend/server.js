process.env.DOTENV_CONFIG_SILENT = 'true';
process.env.DOTENV_CONFIG_DEBUG = 'false';

// Interceptar console.log para filtrar mensagens do dotenv e logs desnecessÃ¡rios
const originalConsoleLog = console.log;
console.log = (...args) => {
    const message = args.join(' ');
    // Filtrar mensagens do dotenv
    if (message.includes('[dotenv@') ||
        message.includes('injecting env') ||
        message.includes('encrypt with Dotenvx') ||
        message.includes('add access controls to secrets')) {
        return;
    }
    // Filtrar mensagens de verificaÃ§Ã£o de Twitch repetitivas
    if (message.includes('[DISCORD] Verificando lives da Twitch...') ||
        message.includes('[DISCORD] Verificando') && message.includes('canal(is) da Twitch')) {
        return;
    }
    originalConsoleLog(...args);
};

import express from "express";
import {
    fileURLToPath
} from "url";
import {
    dirname,
    join
} from "path";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = dirname(__filename);

// Carrega variÃ¡veis de ambiente do .env
dotenv.config({
    path: join(__dirname, "../.env"),
    silent: true,
    debug: false,
    override: false,
    quiet: true
});


import authRoutes from "./routes/auth.js"; // Login/Registro + Google OAuth
import produtosRoutes from "./routes/produtos.js"; // Produtos
import configRoutes from "./routes/config.js"; // ConfiguraÃ§Ãµes
import userRoutes from "./routes/user.js"; // UsuÃ¡rios
import notificacoesRoutes from "./routes/notificacoes.js"; // NotificaÃ§Ãµes
import contasRoutes from "./routes/contas.js"; // Contas
import preferencesRoutes from "./routes/preferences.js"; // PreferÃªncias
import authEmailVerifyRoutes from "./routes/auth-email-verify.js"; // VerificaÃ§Ã£o email
import paymentRoutes, { stripeWebhookHandler } from "./routes/payment.js"; // Pagamentos
import statusRoutes from "./routes/status.js"; // Status
import chartsRoutes from "./routes/charts.js"; // GrÃ¡ficos/series
import exportRoutes from "./routes/exportRoutes.js"; // ExportaÃ§Ã£o
import gracePeriodRoutes from "./routes/grace-period.js"; // PerÃ­odos de graÃ§a
import supportRoutes from "./routes/support.js"; // Suporte
import githubRoutes from "./routes/github.js"; // GitHub API
import adminRoutes from "./routes/admin.js"; // Admin Panel
import corporationRoutes from "./routes/corporation.js"; // Painel CorporaÃ§Ã£o (PerfilId 3)
import newsletterRoutes from "./routes/newsletter.js"; // Newsletter
import blogRoutes from "./routes/blog.js"; // Blog
import heraldRoutes from "./routes/herald.js"; // Herald API
import relatoriosRoutes from "./routes/relatorios.js"; // Relatorios PDF
import historicoRoutes from "./routes/historico.js"; // Historico PDF (sem graficos)
import discordPanelRoutes from "./routes/discord-panel.js"; // Discord OAuth + cupÃµes corporativos
import { verifyToken } from "./middleware/auth.js"; // JWT

import { pool } from "./database/db.js"; // Pool de conexÃ£o
import { sendNotification } from "./services/notify.js"; // NotificaÃ§Ãµes

const app = express();

// Trust proxy para funcionar corretamente com NGINX/proxy reverso
// Em produÃ§Ã£o, confiar apenas no primeiro proxy (NGINX)
// Em desenvolvimento, confiar apenas em localhost (usando IPs vÃ¡lidos)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1); // Confiar apenas no primeiro proxy
} else {
    app.set('trust proxy', ['127.0.0.1', '::1']);
}
app.use(cookieParser()); // Cookies
app.post("/api/payment/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);
app.use(express.json({ limit: '10mb' })); // JSON parsing com limite aumentado para upload de imagens

// Rate limiting geral para todas as rotas
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 500, // mÃ¡ximo 500 requisiÃ§Ãµes por IP por janela (aumentado)
    message: {
        error: "Muitas requisiÃ§Ãµes deste IP, tente novamente em 15 minutos",
        retryAfter: "15 minutos"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiting mais restritivo para APIs de autenticaÃ§Ã£o
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 50, // mÃ¡ximo 50 tentativas de login por IP por janela (aumentado para desenvolvimento)
    message: {
        error: "Muitas tentativas de login, tente novamente em 15 minutos",
        retryAfter: "15 minutos"
    },
    standardHeaders: true,
    legacyHeaders: false,
    // QR login faz polling a cada 2s; nÃ£o contar esses pedidos no limite de login
    skip: (req) => /\/api\/auth\/qr-session/.test(req.originalUrl || req.path || ""),
})

// Rate limiting mais permissivo para OAuth (Google, Discord, etc.)
const oauthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // mÃ¡ximo 100 tentativas OAuth por IP por janela
    message: {
        error: "Muitas tentativas de OAuth, tente novamente em 15 minutos",
        retryAfter: "15 minutos"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiting para APIs de produtos (mais permissivo para usuÃ¡rios autenticados)
const productLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // mÃ¡ximo 100 requisiÃ§Ãµes por IP por minuto (aumentado)
    message: {
        error: "Muitas requisiÃ§Ãµes de produtos, tente novamente em 1 minuto",
        retryAfter: "1 minuto"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Aplicar rate limiting geral
app.use(generalLimiter);

// CORS baseado no .env - SEGURO
const isDevelopment = process.env.NODE_ENV !== 'production';
const allowedOrigins = [
    `http://localhost:${process.env.PORT || 3000}`,
    `http://127.0.0.1:${process.env.PORT || 3000}`,
    `http://localhost:8080`,
    `http://127.0.0.1:8080`,
    `http://localhost:5500`,
    `http://127.0.0.1:5500`,
    // Suporte para pÃ¡ginas servidas via Apache/XAMPP sem porta explÃ­cita
    `http://localhost`,
    `http://127.0.0.1`,
    // Adicionar variaÃ§Ãµes comuns do XAMPP
    `http://localhost:80`,
    `http://127.0.0.1:80`,
    // DomÃ­nios de produÃ§Ã£o
    `http://promoping.pt`,
    `https://promoping.pt`,
    `http://www.promoping.pt`,
    `https://www.promoping.pt`,
    // file:// removido por seguranÃ§a
];

// Adicionar domÃ­nios do .env se existirem
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.ALLOWED_ORIGINS) {
    const customOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    allowedOrigins.push(...customOrigins);
}

// FunÃ§Ã£o para validar origem
const corsOptions = {
    origin: function(origin, callback) {
        // Permitir requisiÃ§Ãµes sem origem (ex: mobile apps, Postman, mesma origem, requisiÃ§Ãµes diretas)
        // VerificaÃ§Ã£o mais robusta para null, undefined, string "null" ou string vazia
        // RequisiÃ§Ãµes sem origem sÃ£o sempre permitidas (mesma origem, Postman, etc)
        if (!origin || origin === 'null' || origin === '' || origin === 'undefined') {
            // Permite silenciosamente - nÃ£o precisa log
            return callback(null, true);
        }

        // Verificar se a origem estÃ¡ na lista permitida
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Permitir promoping.pt em qualquer ambiente (produÃ§Ã£o e desenvolvimento)
        try {
            const url = new URL(origin);
            const hostname = url.hostname.toLowerCase();

            if (hostname === 'promoping.pt' || hostname === 'www.promoping.pt') {
                return callback(null, true);
            }
        } catch (e) {
            // URL invÃ¡lida - continuar para verificar outras condiÃ§Ãµes
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
                // URL invÃ¡lida - continuar para verificar outras condiÃ§Ãµes
            }
        }

        // Log da origem bloqueada para debug (apenas em desenvolvimento)
        if (isDevelopment) {
            console.warn(`[CORS] Origem bloqueada: ${origin} (Ambiente: ${process.env.NODE_ENV || 'development'})`);
        }

        callback(new Error('NÃ£o permitido pelo CORS'));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-admin-panel", "X-Admin-Panel"],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Aplicar rate limiting especÃ­fico para cada tipo de autenticaÃ§Ã£o
app.use("/api/auth/google", oauthLimiter); // Google OAuth - mais permissivo
app.use("/api/auth/discord", oauthLimiter); // Discord OAuth - mais permissivo
app.use("/api/auth", authLimiter); // Login/Registro tradicional - mais restritivo
app.use("/api/auth", authRoutes); // Login/Registro + Google OAuth
app.use("/api/auth", authEmailVerifyRoutes); // VerificaÃ§Ã£o email

app.get("/auth/google", (req, res) => {
    const queryString = new URLSearchParams(req.query).toString();
    const target = queryString ? `/api/auth/google?${queryString}` : "/api/auth/google";
    res.redirect(target);
});

app.get("/auth/google/callback", (req, res) => {
    const queryString = new URLSearchParams(req.query).toString();
    const target = queryString ? `/api/auth/google/callback?${queryString}` : "/api/auth/google/callback";
    res.redirect(target);
});

app.get("/auth/github", (req, res) => {
    const queryString = new URLSearchParams(req.query).toString();
    const target = queryString ? `/api/auth/github?${queryString}` : "/api/auth/github";
    res.redirect(target);
});

app.get("/auth/github/callback", (req, res) => {
    const queryString = new URLSearchParams(req.query).toString();
    const target = queryString ? `/api/auth/github/callback?${queryString}` : "/api/auth/github/callback";
    res.redirect(target);
});

app.get("/auth/discord", (req, res) => {
    const queryString = new URLSearchParams(req.query).toString();
    const target = queryString ? `/api/auth/discord?${queryString}` : "/api/auth/discord";
    res.redirect(target);
});

app.get("/auth/discord/callback", (req, res) => {
    const queryString = new URLSearchParams(req.query).toString();
    const target = queryString ? `/api/auth/discord/callback?${queryString}` : "/api/auth/discord/callback";
    res.redirect(target);
});

app.get("/auth/discord/check/:discordId", (req, res) => {
    const queryString = new URLSearchParams(req.query).toString();
    const encodedDiscordId = encodeURIComponent(req.params.discordId);
    const target = queryString
        ? `/api/auth/discord/check/${encodedDiscordId}?${queryString}`
        : `/api/auth/discord/check/${encodedDiscordId}`;
    res.redirect(target);
});

app.get("/auth/discord/direct/:discordId", (req, res) => {
    const queryString = new URLSearchParams(req.query).toString();
    const encodedDiscordId = encodeURIComponent(req.params.discordId);
    const target = queryString
        ? `/api/auth/discord/direct/${encodedDiscordId}?${queryString}`
        : `/api/auth/discord/direct/${encodedDiscordId}`;
    res.redirect(target);
});

app.get("/api/user/me", verifyToken, async(req, res) => {
    try {
        const referenciaID = req.user.ReferenciaID;

        // Buscar dados completos do usuÃ¡rio incluindo foto de perfil e PerfilId
        try {
            const [rows] = await pool.query(
                "SELECT ReferenciaID, Nome, Email, Telefone, FotoPerfil, DataRegisto, cidade, location, PerfilId FROM Utilizadores WHERE ReferenciaID = ?", [referenciaID]
            );

            if (rows.length > 0) {
                const user = rows[0];
                return res.json({
                    status: "ok",
                    user: {
                        ReferenciaID: user.ReferenciaID,
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
            // Se campo FotoPerfil nÃ£o existe, buscar sem ele mas com PerfilId
            try {
                const [rows] = await pool.query(
                    "SELECT ReferenciaID, Nome, Email, Telefone, DataRegisto, PerfilId FROM Utilizadores WHERE ReferenciaID = ?", [referenciaID]
                );

                if (rows.length > 0) {
                    const user = rows[0];
                    return res.json({
                        status: "ok",
                        user: {
                            ReferenciaID: user.ReferenciaID,
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
                console.error("Erro ao buscar dados do usuÃ¡rio:", dbErr2);
            }
        }

        // Fallback para dados do token
        res.json({
            status: "ok",
            user: req.user
        });
    } catch (err) {
        console.error("Erro ao buscar dados do usuÃ¡rio:", err);
        res.json({
            status: "ok",
            user: req.user
        });
    }
});

// Aplicar rate limiting para produtos
app.use("/api/produtos", productLimiter);
app.use("/api/produtos", produtosRoutes); // Produtos
app.use("/api/config", configRoutes); // ConfiguraÃ§Ãµes
app.use("/api/user", userRoutes); // UsuÃ¡rios
app.use("/api/user/accounts", contasRoutes); // Contas (deve vir depois de /api/user)
app.use("/api/user/preferences", preferencesRoutes); // PreferÃªncias (deve vir depois de /api/user)
app.use("/api/notificacoes", notificacoesRoutes); // NotificaÃ§Ãµes
app.use("/api/grace-period", gracePeriodRoutes); // PerÃ­odos de graÃ§a
app.use("/api/payment", paymentRoutes); // Pagamentos
app.use("/api/exportar", exportRoutes); // ExportaÃ§Ã£o
app.use("/api/relatorios", relatoriosRoutes); // Relatorios PDF
app.use("/api/historico", historicoRoutes); // Historico PDF (sem graficos)
app.use("/api/support", supportRoutes); // Suporte (GET/POST) - caminho especÃ­fico
app.use("/api/admin", adminRoutes); // Admin Panel - verificaÃ§Ã£o de admin dentro da rota
app.use("/api/corporation", corporationRoutes); // Painel CorporaÃ§Ã£o - apenas PerfilId 3
app.use("/api/discord/panel", discordPanelRoutes); // Discord OAuth painel + cupÃµes corporativos
app.use("/api/newsletter", newsletterRoutes); // Newsletter
app.use("/api/blog", blogRoutes); // Blog
app.use("/api/herald", heraldRoutes); // Herald API
app.use("/", githubRoutes); // GitHub API (releases)
app.use("/", statusRoutes); // Status
app.use("/", chartsRoutes); // Charts

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        version: process.env.npm_package_version || "1.0.0",
    });
});

// Servido em todos os ambientes; em produÃ§Ã£o o NGINX deve fazer proxy de /.well-known/ para o backend
app.get("/.well-known/discord", (req, res) => {
    res.type("text/plain").send("dh=2ff358f6828299158d812b46a60a3a8c7476cd8b");
});

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

// O bot escuta na porta 3001; o backend reencaminha para usar as mesmas notificaÃ§Ãµes
// que o bot jÃ¡ envia (embed com PreÃ§o alvo atingido / PreÃ§o diminuiu, etc.) conforme preferÃªncias.
app.post("/api/internal/send-price-dm", async(req, res) => {
    try {
        const botUrl = process.env.INTERNAL_BOT_URL || "http://127.0.0.1:3001";
        const f = await fetch(`${botUrl}/internal/send-price-dm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body || {}),
        });
        const text = await f.text();
        if (f.status === 503) {
            return res.status(503).json({
                error: "Bot Discord indisponÃ­vel",
                message: "O bot ainda nÃ£o estÃ¡ pronto ou nÃ£o estÃ¡ a correr. Certifica-te de que o processo Â«promoping-botÂ» estÃ¡ online e ligado na porta 3001.",
                detail: text || undefined,
            });
        }
        res.status(f.status).set("Content-Type", f.headers.get("content-type") || "application/json").send(text);
    } catch (err) {
        console.error("[BACKEND] Proxy send-price-dm:", err.message);
        res.status(503).json({
            error: "Bot Discord indisponÃ­vel",
            message: "NÃ£o foi possÃ­vel contactar o bot. Certifica-te de que o processo Â«promoping-botÂ» estÃ¡ online e ligado na porta 3001.",
            detail: err.message,
        });
    }
});

app.post("/notify", async(req, res) => {
    try {
        const {
            canal,
            email,
            telefone,
            mensagem
        } = req.body;

        if (!mensagem || !canal) {
            return res.status(400).json({
                error: "Campos obrigatÃ³rios: mensagem e canal (email ou sms)",
            });
        }

        await sendNotification({
            canal,
            email,
            telefone,
            mensagem
        });
        res.json({
            status: "ok",
            canal,
            mensagem
        });
    } catch (err) {
        console.error("Erro na notificaÃ§Ã£o:", err);
        res.status(500).json({
            error: err.message || "erro desconhecido"
        });
    }
});

// Verificar se a pasta build existe (usado em vÃ¡rias partes do cÃ³digo)
const buildPath = path.join(__dirname, "../frontend/pages/build");
const buildExists = fs.existsSync(buildPath);

// Servir includes especÃ­ficos ANTES dos arquivos estÃ¡ticos
app.get("/inc/header.html", (req, res) => {
    const filePath = buildExists ?
        path.join(buildPath, "inc/header.html") :
        path.join(__dirname, "../frontend/pages/inc/header.html");
    res.sendFile(filePath);
});

app.get("/inc/header-login.html", (req, res) => {
    const filePath = buildExists ?
        path.join(buildPath, "inc/header-login.html") :
        path.join(__dirname, "../frontend/pages/inc/header-login.html");
    res.sendFile(filePath);
});

app.get("/inc/header-register.html", (req, res) => {
    const filePath = buildExists ?
        path.join(buildPath, "inc/header-register.html") :
        path.join(__dirname, "../frontend/pages/inc/header-register.html");
    res.sendFile(filePath);
});

app.get("/inc/footer.html", (req, res) => {
    const filePath = buildExists ?
        path.join(buildPath, "inc/footer.html") :
        path.join(__dirname, "../frontend/pages/inc/footer.html");
    res.sendFile(filePath);
});

app.get("/inc/load-includes.js", (req, res) => {
    const filePath = buildExists ?
        path.join(buildPath, "inc/load-includes.js") :
        path.join(__dirname, "../frontend/pages/inc/load-includes.js");
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(filePath);
});

app.get("/inc/load-includes-index.js", (req, res) => {
    const filePath = buildExists ?
        path.join(buildPath, "inc/load-includes-index.js") :
        path.join(__dirname, "../frontend/pages/inc/load-includes-index.js");
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(filePath);
});

app.get("/inc/load-includes-login.js", (req, res) => {
    const filePath = buildExists ?
        path.join(buildPath, "inc/load-includes-login.js") :
        path.join(__dirname, "../frontend/pages/inc/load-includes-login.js");
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(filePath);
});

app.get("/inc/load-includes-register.js", (req, res) => {
    const filePath = buildExists ?
        path.join(buildPath, "inc/load-includes-register.js") :
        path.join(__dirname, "../frontend/pages/inc/load-includes-register.js");
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(filePath);
});

app.get("/openapi.yaml", (req, res) => {
    res.setHeader("Content-Type", "application/yaml");
    res.sendFile(path.join(__dirname, "../openapi.yaml"));
});

// Em produÃ§Ã£o, o NGINX serve o frontend estÃ¡tico
// Em desenvolvimento, o Express serve o frontend
const isProduction = process.env.NODE_ENV === 'production' && process.env.SERVE_FRONTEND !== 'true';

if (!isProduction) {
    // Servir arquivos estÃ¡ticos apenas em desenvolvimento
    // Usar a pasta build se existir, senÃ£o usar frontend direto
    // buildPath e buildExists jÃ¡ foram definidos acima
    const frontendPath = path.join(__dirname, "../frontend");

    if (buildExists) {
        // Servir da pasta build
        app.use(express.static(buildPath));
    } else {
        // Fallback para frontend direto
        app.use(express.static(frontendPath));
    }

    // Servir arquivos estÃ¡ticos do Painel Administrativo
    const painelPath = path.join(__dirname, "../Painel_Administrativo");
    app.use("/Painel_Administrativo", express.static(painelPath));

    // Servir arquivos estÃ¡ticos do Painel Suporte e CorporaÃ§Ã£o
    const adminPath = path.join(__dirname, "../painel-suporte-corporacao");
    app.use("/painel-suporte-corporacao", express.static(adminPath));

    // URLs limpas para o painel (atalhos)
    app.get("/suporte", (req, res) => {
        res.redirect("/painel-suporte-corporacao/pages/dashboard.html");
    });
    app.get("/corporativo", (req, res) => {
        res.redirect("/painel-suporte-corporacao/pages_corporation/dashboard.html");
    });

    // Anexos de bugs (uploads/bugs)
    const uploadsPath = path.join(__dirname, "uploads");
    app.use("/uploads", express.static(uploadsPath));

    // Rota para ignorar requests do Chrome DevTools
    app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
        res.status(404).json({
            error: "Not found"
        });
    });

    // Discord OAuth - redirecionar para API
    app.get("/auth/google", (req, res) => {
        const queryString = new URLSearchParams(req.query).toString();
        const target = queryString ? `/api/auth/google?${queryString}` : "/api/auth/google";
        res.redirect(target);
    });

    app.get("/auth/google/callback", (req, res) => {
        const queryString = new URLSearchParams(req.query).toString();
        const target = queryString ? `/api/auth/google/callback?${queryString}` : "/api/auth/google/callback";
        res.redirect(target);
    });

    app.get("/auth/github", (req, res) => {
        const queryString = new URLSearchParams(req.query).toString();
        const target = queryString ? `/api/auth/github?${queryString}` : "/api/auth/github";
        res.redirect(target);
    });

    app.get("/auth/github/callback", (req, res) => {
        const queryString = new URLSearchParams(req.query).toString();
        const target = queryString ? `/api/auth/github/callback?${queryString}` : "/api/auth/github/callback";
        res.redirect(target);
    });

    app.get("/auth/discord", (req, res) => {
        const queryString = new URLSearchParams(req.query).toString();
        const target = queryString ? `/api/auth/discord?${queryString}` : "/api/auth/discord";
        res.redirect(target);
    });

    app.get("/auth/discord/callback", (req, res) => {
        // Preservar os parÃ¢metros da query string
        const queryString = new URLSearchParams(req.query).toString();
        res.redirect(`/api/auth/discord/callback?${queryString}`);
    });

    // PÃ¡gina inicial
    app.get("/auth/discord/check/:discordId", (req, res) => {
        const queryString = new URLSearchParams(req.query).toString();
        const encodedDiscordId = encodeURIComponent(req.params.discordId);
        const target = queryString
            ? `/api/auth/discord/check/${encodedDiscordId}?${queryString}`
            : `/api/auth/discord/check/${encodedDiscordId}`;
        res.redirect(target);
    });

    app.get("/auth/discord/direct/:discordId", (req, res) => {
        const queryString = new URLSearchParams(req.query).toString();
        const encodedDiscordId = encodeURIComponent(req.params.discordId);
        const target = queryString
            ? `/api/auth/discord/direct/${encodedDiscordId}?${queryString}`
            : `/api/auth/discord/direct/${encodedDiscordId}`;
        res.redirect(target);
    });

    app.get("/", (req, res) => {
        const indexPath = buildExists ?
            path.join(buildPath, "index.html") :
            path.join(__dirname, "../frontend/pages/index.html");
        res.sendFile(indexPath);
    });

    // Caminhos de visualizaÃ§Ã£o do Google Ads â€” servem a homepage
    app.get(/^\/alertas-precos(\/email-discord)?\/?$/i, (req, res) => {
        const indexPath = buildExists ?
            path.join(buildPath, "index.html") :
            path.join(__dirname, "../frontend/pages/index.html");
        res.sendFile(indexPath);
    });

    // PÃ¡ginas principais
    app.get("/monitoramento", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/price-monitoring.html") :
            path.join(__dirname, "../frontend/pages/build/About/price-monitoring.html");
        res.sendFile(filePath);
    });

    app.get("/alertas", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/smart-alerts.html") :
            path.join(__dirname, "../frontend/pages/build/About/smart-alerts.html");
        res.sendFile(filePath);
    });

    app.get("/relatorios", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/reports-and-analytics.html") :
            path.join(__dirname, "../frontend/pages/build/About/reports-and-analytics.html");
        res.sendFile(filePath);
    });

    app.get("/casos-uso", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/use-cases.html") :
            path.join(__dirname, "../frontend/pages/build/About/use-cases.html");
        res.sendFile(filePath);
    });

    app.get("/blog", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/promoping-blog.html") :
            path.join(__dirname, "../frontend/pages/build/About/promoping-blog.html");
        res.sendFile(filePath);
    });

    app.get("/blog/article/:id", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/promoping-blog-article.html") :
            path.join(__dirname, "../frontend/pages/build/About/promoping-blog-article.html");
        res.sendFile(filePath);
    });

    // PÃ¡ginas de autenticaÃ§Ã£o
    app.get("/login", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "business/create/login-page.html") :
            path.join(__dirname, "../frontend/pages/build/business/create/login-page.html");
        res.sendFile(filePath);
    });

    app.get("/register", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "business/create/register-account.html") :
            path.join(__dirname, "../frontend/pages/build/business/create/register-account.html");
        res.sendFile(filePath);
    });

    // Rotas adicionais para compatibilidade com frontend
    app.get("/inc/login-redirect.html", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "inc/login-redirect.html") :
            path.join(__dirname, "../frontend/pages/build/inc/login-redirect.html");
        res.sendFile(filePath);
    });

    app.get("/inc/Login.html", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "inc/login-redirect.html") :
            path.join(__dirname, "../frontend/pages/build/inc/login-redirect.html");
        res.sendFile(filePath);
    });

    app.get("/inc/register.html", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "business/create/register-account.html") :
            path.join(__dirname, "../frontend/pages/build/business/create/register-account.html");
        res.sendFile(filePath);
    });

    // PÃ¡gina de recuperaÃ§Ã£o de senha
    app.get("/forgot-password", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "inc/forgot-password.html") :
            path.join(__dirname, "../frontend/pages/inc/forgot-password.html");
        res.sendFile(filePath);
    });

    app.get("/inc/forgot-password.html", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "inc/forgot-password.html") :
            path.join(__dirname, "../frontend/pages/inc/forgot-password.html");
        res.sendFile(filePath);
    });

    // PÃ¡ginas do dashboard
    app.get("/dashboard", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "dashboard/dashboard-home.html") :
            path.join(__dirname, "../frontend/pages/build/dashboard/dashboard-home.html");
        res.sendFile(filePath);
    });

    app.get("/dashboard/painel", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "dashboard/dashboard-home.html") :
            path.join(__dirname, "../frontend/pages/build/dashboard/dashboard-home.html");
        res.sendFile(filePath);
    });

    app.get("/dashboard/perfil", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "dashboard/account-profile.html") :
            path.join(__dirname, "../frontend/pages/build/dashboard/account-profile.html");
        res.sendFile(filePath);
    });

    app.get("/dashboard/planos", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "dashboard/subscription-plans.html") :
            path.join(__dirname, "../frontend/pages/build/dashboard/subscription-plans.html");
        res.sendFile(filePath);
    });

    app.get("/dashboard/produtos", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "dashboard/monitored-products.html") :
            path.join(__dirname, "../frontend/pages/build/dashboard/monitored-products.html");
        res.sendFile(filePath);
    });

    // Rotas adicionais para compatibilidade com frontend (com .html)
    app.get("/dashboard/dashboard-home.html", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "dashboard/dashboard-home.html") :
            path.join(__dirname, "../frontend/pages/build/dashboard/dashboard-home.html");
        res.sendFile(filePath);
    });

    app.get("/dashboard/Painel.html", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "dashboard/dashboard-home.html") :
            path.join(__dirname, "../frontend/pages/build/dashboard/dashboard-home.html");
        res.sendFile(filePath);
    });

    app.get("/dashboard/account-profile.html", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "dashboard/account-profile.html") :
            path.join(__dirname, "../frontend/pages/build/dashboard/account-profile.html");
        res.sendFile(filePath);
    });

    app.get("/dashboard/subscription-plans.html", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "dashboard/subscription-plans.html") :
            path.join(__dirname, "../frontend/pages/build/dashboard/subscription-plans.html");
        res.sendFile(filePath);
    });

    app.get("/dashboard/perfil.html", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "dashboard/account-profile.html") :
            path.join(__dirname, "../frontend/pages/build/dashboard/account-profile.html");
        res.sendFile(filePath);
    });

    app.get("/dashboard/monitored-products.html", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "dashboard/monitored-products.html") :
            path.join(__dirname, "../frontend/pages/build/dashboard/monitored-products.html");
        res.sendFile(filePath);
    });

    app.get("/dashboard/produtos.html", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "dashboard/monitored-products.html") :
            path.join(__dirname, "../frontend/pages/build/dashboard/monitored-products.html");
        res.sendFile(filePath);
    });

    // PÃ¡ginas de documentaÃ§Ã£o
    app.get("/docs", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/documentation-home.html") :
            path.join(__dirname, "../frontend/pages/build/docs/documentation-home.html");
        res.sendFile(filePath);
    });

    app.get("/docs/support", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/support.html") :
            path.join(__dirname, "../frontend/pages/docs/support.html");
        res.sendFile(filePath);
    });

    app.get("/docs/service-status", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/service-status.html") :
            path.join(__dirname, "../frontend/pages/docs/service-status.html");
        res.sendFile(filePath);
    });

    app.get("/docs/terms", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/terms-of-service.html") :
            path.join(__dirname, "../frontend/pages/build/docs/terms-of-service.html");
        res.sendFile(filePath);
    });

    app.get("/docs/usage-guide", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/usage-guide.html") :
            path.join(__dirname, "../frontend/pages/docs/usage-guide.html");
        res.sendFile(filePath);
    });

    app.get("/docs/api-reference", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/api-reference.html") :
            path.join(__dirname, "../frontend/pages/docs/api-reference.html");
        res.sendFile(filePath);
    });

    app.get("/docs/FirstLaunch", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/FirstLaunch.html") :
            path.join(__dirname, "../frontend/pages/docs/FirstLaunch.html");
        res.sendFile(filePath);
    });

    app.get("/docs/faq", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/faq.html") :
            path.join(__dirname, "../frontend/pages/docs/faq.html");
        res.sendFile(filePath);
    });

    app.get("/docs/changelog", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/changelog.html") :
            path.join(__dirname, "../frontend/pages/docs/changelog.html");
        res.sendFile(filePath);
    });

    app.get("/docs/privacy", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/privacy-policy.html") :
            path.join(__dirname, "../frontend/pages/build/docs/privacy-policy.html");
        res.sendFile(filePath);
    });

    app.get("/docs/ral", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/alternative-dispute-resolution.html") :
            path.join(__dirname, "../frontend/pages/build/docs/alternative-dispute-resolution.html");
        res.sendFile(filePath);
    });

    app.get("/docs/livro-reclamacoes", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/complaints-book.html") :
            path.join(__dirname, "../frontend/pages/build/docs/complaints-book.html");
        res.sendFile(filePath);
    });

    app.get("/docs/installation", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/installation.html") :
            path.join(__dirname, "../frontend/pages/docs/installation.html");
        res.sendFile(filePath);
    });

    app.get("/docs/incident-history", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/incident-history.html") :
            path.join(__dirname, "../frontend/pages/docs/incident-history.html");
        res.sendFile(filePath);
    });

    app.get("/docs/security-headers", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/security-headers.html") :
            path.join(__dirname, "../frontend/pages/docs/security-headers.html");
        res.sendFile(filePath);
    });

    // Compatibilidade para rotas de documentaÃ§Ã£o com nomes novos e extensÃ£o .html/.js
    const docsCompatRoutes = {
        "/docs/documentation-home": "docs/documentation-home.html",
        "/docs/documentation-home.html": "docs/documentation-home.html",
        "/docs/usage-guide.html": "docs/usage-guide.html",
        "/docs/api-reference.html": "docs/api-reference.html",
        "/docs/support.html": "docs/support.html",
        "/docs/faq.html": "docs/faq.html",
        "/docs/changelog.html": "docs/changelog.html",
        "/docs/service-status.html": "docs/service-status.html",
        "/docs/incident-history.html": "docs/incident-history.html",
        "/docs/security-headers.html": "docs/security-headers.html",
        "/docs/terms-of-service": "docs/terms-of-service.html",
        "/docs/terms-of-service.html": "docs/terms-of-service.html",
        "/docs/privacy-policy": "docs/privacy-policy.html",
        "/docs/privacy-policy.html": "docs/privacy-policy.html",
        "/docs/alternative-dispute-resolution": "docs/alternative-dispute-resolution.html",
        "/docs/alternative-dispute-resolution.html": "docs/alternative-dispute-resolution.html",
        "/docs/complaints-book": "docs/complaints-book.html",
        "/docs/complaints-book.html": "docs/complaints-book.html",
        "/docs/documentation-navigation.html": "docs/documentation-navigation.html",
        "/docs/documentation-navigation.js": "docs/documentation-navigation.js",
        "/docs/documentation-search.js": "docs/documentation-search.js"
    };

    Object.entries(docsCompatRoutes).forEach(([routePath, relativeFile]) => {
        app.get(routePath, (req, res) => {
            const filePath = buildExists ?
                path.join(buildPath, relativeFile) :
                path.join(__dirname, "../frontend/pages/build", relativeFile);

            if (relativeFile.endsWith(".js")) {
                res.type("application/javascript");
            }

            res.sendFile(filePath);
        });
    });

    // PÃ¡ginas About
    app.get("/about", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/about-promoping.html") :
            path.join(__dirname, "../frontend/pages/build/About/about-promoping.html");
        res.sendFile(filePath);
    });

    app.get("/about/alertas", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/smart-alerts.html") :
            path.join(__dirname, "../frontend/pages/build/About/smart-alerts.html");
        res.sendFile(filePath);
    });

    app.get("/about/blog", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/promoping-blog.html") :
            path.join(__dirname, "../frontend/pages/build/About/promoping-blog.html");
        res.sendFile(filePath);
    });

    app.get("/about/casos-uso", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/use-cases.html") :
            path.join(__dirname, "../frontend/pages/build/About/use-cases.html");
        res.sendFile(filePath);
    });

    app.get("/about/monitoramento", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/price-monitoring.html") :
            path.join(__dirname, "../frontend/pages/build/About/price-monitoring.html");
        res.sendFile(filePath);
    });

    app.get("/about/relatorios", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/reports-and-analytics.html") :
            path.join(__dirname, "../frontend/pages/build/About/reports-and-analytics.html");
        res.sendFile(filePath);
    });

    app.get("/about/privacy-cookies", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "About/cookie-policy.html") :
            path.join(__dirname, "../frontend/pages/build/About/cookie-policy.html");
        res.sendFile(filePath);
    });

    // Rotas adicionais para compatibilidade
    app.get("/business/create/login", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "business/create/login-page.html") :
            path.join(__dirname, "../frontend/pages/build/business/create/login-page.html");
        res.sendFile(filePath);
    });

    app.get("/business/create/registar", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "business/create/register-account.html") :
            path.join(__dirname, "../frontend/pages/build/business/create/register-account.html");
        res.sendFile(filePath);
    });

    // Redirecionamento baseado no .env
    app.get("/redirect", (req, res) => {
        const redirectUrl = process.env.REDIRECT_URL || `http://localhost:${process.env.PORT || 3000}`;
        res.redirect(redirectUrl);
    });

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

        console.error('Erro nÃ£o tratado:', err);
        res.status(err.status || 500).json({
            status: 'error',
            message: err.message || 'Erro interno do servidor',
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack
            })
        });
    });

    // Captura todas as rotas nÃ£o encontradas e redireciona para a pÃ¡gina 404 personalizada
    // IMPORTANTE: Este middleware deve vir DEPOIS de todas as rotas registradas
    app.use((req, res) => {
        // Se for uma rota de API, retornar JSON em vez de HTML
        if (req.path.startsWith('/api/')) {
            console.log(`[404] Rota nÃ£o encontrada: ${req.method} ${req.path}`);
            return res.status(404).json({
                status: 'error',
                error: 'Rota nÃ£o encontrada',
                path: req.path,
                method: req.method
            });
        }

        const filePath = buildExists ?
            path.join(buildPath, "404.html") :
            path.join(__dirname, "../frontend/pages/404.html");
        res.status(404).sendFile(filePath);
    });
} else {
    // Em produÃ§Ã£o, apenas retornar 404 para rotas nÃ£o-API
    app.use((req, res, next) => {
        // Se nÃ£o comeÃ§ar com /api/, retornar 404 (NGINX deve servir o frontend)
        if (!req.path.startsWith('/api/') && req.path !== '/openapi.yaml') {
            return res.status(404).json({
                error: 'Not found'
            });
        }
        next();
    });

    // Middleware de tratamento de erros em produÃ§Ã£o
    app.use((err, req, res, next) => {
        // Aplicar CORS mesmo em caso de erro
        const origin = req.headers.origin;
        if (origin && (allowedOrigins.includes(origin) ||
                origin.includes('promoping.pt'))) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }

        console.error('Erro nÃ£o tratado:', err);
        res.status(err.status || 500).json({
            status: 'error',
            message: err.message || 'Erro interno do servidor'
        });
    });
}
import {
    GracePeriodManager
} from './services/gracePeriodManager.js';
import {
    DeactivatedAccountsManager
} from './services/deactivatedAccountsManager.js';
import { startBirthdayNotifier } from './services/birthdayNotifier.js';
import {
    initializeAllTables
} from './database/tableManager.js';
import { cleanupOldQrTokens } from './services/qrLoginSession.js';

const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? "127.0.0.1" : "0.0.0.0");

const PORT = process.env.PORT || 3000;

app.listen(PORT, HOST, async() => {
    console.log(`\nPromoPing rodando em http://${HOST}:${PORT}`);

    // Inicializar todas as tabelas definidas
    try {
        await initializeAllTables();
    } catch (error) {
        console.error('[INIT] Erro ao inicializar tabelas (sistema continuarÃ¡):', error.message);
        // NÃ£o bloquear inicializaÃ§Ã£o do servidor se houver erro nas tabelas
    }

    // Limpeza periÃ³dica de qr_tokens (pending/expired e used antigos) a cada 10 min
    setInterval(() => {
        cleanupOldQrTokens().catch((err) => console.error('[QR-TOKENS] Erro na limpeza:', err.message));
    }, 10 * 60 * 1000);

    if (process.env.NODE_ENV === 'development') {
        // Mostrar tambÃ©m o IP local da rede para acesso via dispositivos mÃ³veis
        const os = await
        import ('os');
        const networkInterfaces = os.networkInterfaces();
        let localIP = '192.168.1.64'; // IP padrÃ£o

        // Tentar encontrar o IP da rede local automaticamente
        for (const interfaceName in networkInterfaces) {
            const addresses = networkInterfaces[interfaceName];
            if (addresses) {
                for (const addr of addresses) {
                    if (addr.family === 'IPv4' && !addr.internal && addr.address.startsWith('192.168.')) {
                        localIP = addr.address;
                        break;
                    }
                }
            }
        }

        console.log(`  Frontend local: http://localhost:${PORT}/ | API: http://localhost:${PORT}/api/`);
        console.log(`  Acesso via rede local: http://${localIP}:${PORT}/`);
        console.log(`  API via rede local: http://${localIP}:${PORT}/api/`);
    }

    const PUBLIC_URL = (process.env.BASE_URL || process.env.FRONTEND_URL || 'https://promoping.pt').replace(/\/$/, '');

    console.log(`  PÃ¡gina normal (local):      http://localhost:${PORT}/`);
    console.log(`  PÃ¡gina normal (pÃºblico):    ${PUBLIC_URL}/`);
    console.log(`  Suporte (local):            http://localhost:${PORT}/suporte`);
    console.log(`  Suporte (pÃºblico):          ${PUBLIC_URL}/suporte`);
    console.log(`  Corporativo (local):        http://localhost:${PORT}/corporativo`);
    console.log(`  Corporativo (pÃºblico):      ${PUBLIC_URL}/corporativo`);
    console.log(`  Login Painel (local):       http://localhost:${PORT}/painel-suporte-corporacao/pages/login.html`);
    console.log(`  Login Painel (pÃºblico):     ${PUBLIC_URL}/painel-suporte-corporacao/pages/login.html\n`);

    // Iniciar verificaÃ§Ã£o automÃ¡tica de perÃ­odos de graÃ§a
    try {
        await GracePeriodManager.startAutomaticCheck();
    } catch (error) {
        console.error('Erro ao iniciar verificaÃ§Ã£o automÃ¡tica de perÃ­odos de graÃ§a:', error);
    }

    // Iniciar verificaÃ§Ã£o automÃ¡tica de contas desativadas
    try {
        await DeactivatedAccountsManager.startAutomaticCheck();
    } catch (error) {
        console.error('Erro ao iniciar verificaÃ§Ã£o automÃ¡tica de contas desativadas:', error);
    }

    // Notificador de aniversÃ¡rio (parabÃ©ns por email e Discord no dia do aniversÃ¡rio)
    try {
        startBirthdayNotifier();
    } catch (error) {
        console.error('Erro ao iniciar notificador de aniversÃ¡rio:', error);
    }
});

