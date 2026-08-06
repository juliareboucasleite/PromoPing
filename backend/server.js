process.env.DOTENV_CONFIG_SILENT = 'true';
process.env.DOTENV_CONFIG_DEBUG = 'false';

// Interceptar console.log para filtrar mensagens do dotenv e logs desnecessários
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
    // Filtrar mensagens de verificação de Twitch repetitivas
    if (message.includes('[DISCORD] Verificando lives da Twitch...') ||
        message.includes('[DISCORD] Verificando') && message.includes('canal(is) da Twitch')) {
        return;
    }
    originalConsoleLog(...args);
};

import "./bootstrap-env.js";
import express from "express";
import {
    fileURLToPath
} from "url";
import {
    dirname,
    join
} from "path";
import cors from "cors";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = dirname(__filename);

import authRoutes from "./routes/auth.js"; // Login/Registro + Google OAuth
import produtosRoutes from "./routes/produtos.js"; // Produtos
import configRoutes from "./routes/config.js"; // Configurações
import userRoutes from "./routes/user.js"; // Usuários
import notificacoesRoutes from "./routes/notificacoes.js"; // Notificações
import contasRoutes from "./routes/contas.js"; // Contas
import preferencesRoutes from "./routes/preferences.js"; // Preferências
import authEmailVerifyRoutes from "./routes/auth-email-verify.js"; // Verificação email
import paymentRoutes, { stripeWebhookHandler } from "./routes/payment.js"; // Pagamentos
import statusRoutes from "./routes/status.js"; // Status
import chartsRoutes from "./routes/charts.js"; // Gráficos/series
import exportRoutes from "./routes/exportRoutes.js"; // Exportação
import gracePeriodRoutes from "./routes/grace-period.js"; // Períodos de graça
import supportRoutes from "./routes/support.js"; // Suporte
import githubRoutes from "./routes/github.js"; // GitHub API
import adminRoutes from "./routes/admin.js"; // Admin Panel
import corporationRoutes from "./routes/corporation.js"; // Painel Corporação (PerfilId 3)
import businessRoutes from "./routes/business.js"; // Business onboarding/organizations (PerfilId 4)
import newsletterRoutes from "./routes/newsletter.js"; // Newsletter
import blogRoutes from "./routes/blog.js"; // Blog
import heraldRoutes from "./routes/herald.js"; // Herald API
import relatoriosRoutes from "./routes/relatorios.js"; // Relatorios PDF
import historicoRoutes from "./routes/historico.js"; // Historico PDF (sem graficos)
import discordPanelRoutes from "./routes/discord-panel.js"; // Discord OAuth + cupões corporativos
import { handleDiscordInteractionsAfterVerify, handleDiscordVerifyUser, getDiscordVerifyMiddleware } from "./routes/discord-endpoints.js";
import { verifyToken } from "./middleware/auth.js"; // JWT
import { resolveAccessContext } from "./services/accessControl.js";

import { pool } from "./database/db.js"; // Pool de conexão
import { sendNotification } from "./services/notify.js"; // Notificações

const app = express();

// Trust proxy para funcionar corretamente com NGINX/proxy reverso
// Em produção, confiar apenas no primeiro proxy (NGINX)
// Em desenvolvimento, confiar apenas em localhost (usando IPs válidos)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1); // Confiar apenas no primeiro proxy
} else {
    app.set('trust proxy', ['127.0.0.1', '::1']);
}
app.use(cookieParser()); // Cookies
app.post("/api/payment/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);
// Discord exige corpo raw para verificação Ed25519 da assinatura
const discordRawBody = express.raw({ type: "application/json" });
const discordRequestLog = (req, res, next) => {
    if (req.headers["x-signature-ed25519"]) {
        console.log("[DISCORD-HTTP] Pedido assinado recebido:", req.method, req.path);
    }
    next();
};
app.post("/api/interactions", discordRawBody, discordRequestLog, getDiscordVerifyMiddleware(), handleDiscordInteractionsAfterVerify);
app.get("/api/interactions", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Discord Interactions Endpoint — apenas POST (validação automática pelo Discord)",
    });
});
app.get("/verify-user", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Discord Linked Roles Verification — apenas POST",
    });
});
app.post("/verify-user", discordRawBody, discordRequestLog, getDiscordVerifyMiddleware(), handleDiscordVerifyUser);
// aliases legados
app.post("/api/discord/interactions", discordRawBody, discordRequestLog, getDiscordVerifyMiddleware(), handleDiscordInteractionsAfterVerify);
app.post("/api/discord/verify-user", discordRawBody, discordRequestLog, getDiscordVerifyMiddleware(), handleDiscordVerifyUser);
app.use(express.json({ limit: '10mb' })); // JSON parsing com limite aumentado para upload de imagens

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
    // QR login faz polling a cada 2s; não contar esses pedidos no limite de login
    skip: (req) => /\/api\/auth\/qr-session/.test(req.originalUrl || req.path || ""),
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
    origin: function(origin, callback) {
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

// Aplicar rate limiting específico para cada tipo de autenticação
app.use("/api/auth/google", oauthLimiter); // Google OAuth - mais permissivo
app.use("/api/auth/discord", oauthLimiter); // Discord OAuth - mais permissivo
app.use("/api/auth/apple", oauthLimiter); // Apple OAuth - mais permissivo
app.use("/api/auth", authLimiter); // Login/Registro tradicional - mais restritivo
app.use("/api/auth", authRoutes); // Login/Registro + Google OAuth
app.use("/api/auth", authEmailVerifyRoutes); // Verificação email

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

app.get("/auth/apple", (req, res) => {
    const queryString = new URLSearchParams(req.query).toString();
    const target = queryString ? `/api/auth/apple?${queryString}` : "/api/auth/apple";
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

        // Buscar dados completos do usuário incluindo foto de perfil e PerfilId
        try {
            const [rows] = await pool.query(
                "SELECT ReferenciaID, Nome, Email, Telefone, FotoPerfil, DataRegisto, cidade, location, PerfilId FROM Utilizadores WHERE ReferenciaID = ?", [referenciaID]
            );

            if (rows.length > 0) {
                const user = rows[0];
                const perfilId = user.PerfilId || user.perfilId || null;
                const access = await resolveAccessContext(user.ReferenciaID, perfilId);
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
                        perfilId,
                        PerfilId: perfilId,
                        access
                    }
                });
            }
        } catch (dbErr) {
            // Se campo FotoPerfil não existe, buscar sem ele mas com PerfilId
            try {
                const [rows] = await pool.query(
                    "SELECT ReferenciaID, Nome, Email, Telefone, DataRegisto, PerfilId FROM Utilizadores WHERE ReferenciaID = ?", [referenciaID]
                );

                if (rows.length > 0) {
                    const user = rows[0];
                    const perfilId = user.PerfilId || user.perfilId || null;
                    const access = await resolveAccessContext(user.ReferenciaID, perfilId);
                    return res.json({
                        status: "ok",
                        user: {
                            ReferenciaID: user.ReferenciaID,
                            nome: user.Nome || user.name,
                            name: user.Nome || user.name,
                            email: user.Email || user.email,
                            telefone: user.Telefone || user.phone,
                            phone: user.Telefone || user.phone,
                            perfilId,
                            PerfilId: perfilId,
                            access
                        }
                    });
                }
            } catch (dbErr2) {
                console.error("Erro ao buscar dados do usuário:", dbErr2);
            }
        }

        // Fallback para dados do token
        res.json({
            status: "ok",
            user: {
                ...req.user,
                access: await resolveAccessContext(
                    req.user.ReferenciaID,
                    req.user.perfilId || req.user.PerfilId || null
                )
            }
        });
    } catch (err) {
        console.error("Erro ao buscar dados do usuário:", err);
        res.json({
            status: "ok",
            user: req.user
        });
    }
});

// Aplicar rate limiting para produtos
app.use("/api/produtos", productLimiter);
app.use("/api/produtos", produtosRoutes); // Produtos
app.use("/api/config", configRoutes); // Configurações
app.use("/api/user", userRoutes); // Usuários
app.use("/api/user/accounts", contasRoutes); // Contas (deve vir depois de /api/user)
app.use("/api/user/preferences", preferencesRoutes); // Preferências (deve vir depois de /api/user)
app.use("/api/notificacoes", notificacoesRoutes); // Notificações
app.use("/api/grace-period", gracePeriodRoutes); // Períodos de graça
app.use("/api/payment", paymentRoutes); // Pagamentos
app.use("/api/exportar", exportRoutes); // Exportação
app.use("/api/relatorios", relatoriosRoutes); // Relatorios PDF
app.use("/api/historico", historicoRoutes); // Historico PDF (sem graficos)
app.use("/api/support", supportRoutes); // Suporte (GET/POST) - caminho específico
app.use("/api/admin", adminRoutes); // Admin Panel - verificação de admin dentro da rota
app.use("/api/corporation", corporationRoutes); // Painel Corporação - apenas PerfilId 3
app.use("/api/business", businessRoutes); // Business account / organizations - apenas PerfilId 4
app.use("/api/discord/panel", discordPanelRoutes); // Discord OAuth painel + cupões corporativos
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

// Servido em todos os ambientes; em produção o NGINX deve fazer proxy de /.well-known/ para o backend
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

// O bot escuta na porta 3001; o backend reencaminha para usar as mesmas notificações
// que o bot já envia (embed com Preço alvo atingido / Preço diminuiu, etc.) conforme preferências.
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
                error: "Bot Discord indisponível",
                message: "O bot ainda não está pronto ou não está a correr. Certifica-te de que o processo «promoping-bot» está online e ligado na porta 3001.",
                detail: text || undefined,
            });
        }
        res.status(f.status).set("Content-Type", f.headers.get("content-type") || "application/json").send(text);
    } catch (err) {
        console.error("[BACKEND] Proxy send-price-dm:", err.message);
        res.status(503).json({
            error: "Bot Discord indisponível",
            message: "Não foi possível contactar o bot. Certifica-te de que o processo «promoping-bot» está online e ligado na porta 3001.",
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
                error: "Campos obrigatórios: mensagem e canal (email ou sms)",
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
        console.error("Erro na notificação:", err);
        res.status(500).json({
            error: err.message || "erro desconhecido"
        });
    }
});

// Verificar se a pasta build existe (usado em várias partes do código)
const buildPath = path.join(__dirname, "../frontend/pages/build");
const buildExists = fs.existsSync(buildPath);

// Servir includes específicos ANTES dos arquivos estáticos
app.get("/inc/header.html", (req, res) => {
    const filePath = buildExists ?
        path.join(buildPath, "inc/header.html") :
        path.join(__dirname, "../frontend/pages/inc/header.html");
    res.sendFile(filePath);
});

app.get("/inc/header-login.html", (req, res) => {
    res.redirect(302, "/?login=1");
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

// Raiz do painel de suporte — evita 404 em /painel-suporte-corporacao/
app.get(["/painel-suporte-corporacao", "/painel-suporte-corporacao/"], (req, res) => {
    res.redirect(302, "/painel-suporte-corporacao/pages/login.html");
});

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

    // Servir arquivos estáticos do Painel Administrativo
    const painelPath = path.join(__dirname, "../Painel_Administrativo");
    app.use("/Painel_Administrativo", express.static(painelPath));

    // Servir arquivos estáticos do Painel Suporte e Corporação
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
        // Preservar os parâmetros da query string
        const queryString = new URLSearchParams(req.query).toString();
        res.redirect(`/api/auth/discord/callback?${queryString}`);
    });

    app.get("/auth/apple", (req, res) => {
        const queryString = new URLSearchParams(req.query).toString();
        const target = queryString ? `/api/auth/apple?${queryString}` : "/api/auth/apple";
        res.redirect(target);
    });

    // Página inicial
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

    // Caminhos de visualização do Google Ads — servem a homepage
    app.get(/^\/alertas-precos(\/email-discord)?\/?$/i, (req, res) => {
        const indexPath = buildExists ?
            path.join(buildPath, "index.html") :
            path.join(__dirname, "../frontend/pages/index.html");
        res.sendFile(indexPath);
    });

    // Páginas principais
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

    // Páginas de autenticação
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

    // Página de recuperação de senha
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

    // Páginas do dashboard
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

    // Páginas de documentação
    app.get("/docs", (req, res) => {
        sendDocsFile(res, "docs/documentation-home.html");
    });

    const docsBuildCandidates = [
        buildPath,
        path.join(__dirname, "../frontend/pages/build"),
        path.join("/var/www/promoping/frontend/pages/build"),
        path.join("/var/www")
    ];

    function sendDocsFile(res, relativeFile) {
        const filePath = docsBuildCandidates
            .map(basePath => path.join(basePath, relativeFile))
            .find(candidate => fs.existsSync(candidate));

        if (!filePath) {
            return res.status(500).json({
                status: "error",
                message: `Documentation file not found: ${relativeFile}`,
                checkedPaths: docsBuildCandidates.map(basePath => path.join(basePath, relativeFile))
            });
        }

        if (relativeFile.endsWith(".js")) {
            res.type("application/javascript");
        }

        return res.sendFile(filePath);
    }

    app.get("/docs/support", (req, res) => {
        sendDocsFile(res, "docs/support.html");
    });

    app.get("/docs/service-status", (req, res) => {
        sendDocsFile(res, "docs/service-status.html");
    });

    app.get("/docs/terms", (req, res) => {
        sendDocsFile(res, "docs/terms-of-service.html");
    });

    app.get("/docs/usage-guide", (req, res) => {
        sendDocsFile(res, "docs/usage-guide.html");
    });

    app.get("/docs/api-reference", (req, res) => {
        sendDocsFile(res, "docs/api-reference.html");
    });

    app.get("/docs/FirstLaunch", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/FirstLaunch.html") :
            path.join(__dirname, "../frontend/pages/docs/FirstLaunch.html");
        res.sendFile(filePath);
    });

    app.get("/docs/faq", (req, res) => {
        sendDocsFile(res, "docs/faq.html");
    });

    app.get("/docs/changelog", (req, res) => {
        sendDocsFile(res, "docs/changelog.html");
    });

    app.get("/docs/privacy", (req, res) => {
        sendDocsFile(res, "docs/privacy-policy.html");
    });

    app.get("/docs/ral", (req, res) => {
        sendDocsFile(res, "docs/alternative-dispute-resolution.html");
    });

    app.get("/docs/livro-reclamacoes", (req, res) => {
        sendDocsFile(res, "docs/complaints-book.html");
    });

    app.get("/docs/installation", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "docs/installation.html") :
            path.join(__dirname, "../frontend/pages/docs/installation.html");
        res.sendFile(filePath);
    });

    app.get("/docs/incident-history", (req, res) => {
        sendDocsFile(res, "docs/incident-history.html");
    });

    app.get("/docs/security-headers", (req, res) => {
        sendDocsFile(res, "docs/security-headers.html");
    });

    // Compatibilidade para rotas de documentação com nomes novos e extensão .html/.js
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
            sendDocsFile(res, relativeFile);
        });
    });

    // Páginas About
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

    app.get("/business/dashboard", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "business/dashboard/index.html") :
            path.join(__dirname, "../frontend/pages/build/business/dashboard/index.html");
        res.sendFile(filePath);
    });

    app.get("/business/produtos", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "business/dashboard/produtos.html") :
            path.join(__dirname, "../frontend/pages/build/business/dashboard/produtos.html");
        res.sendFile(filePath);
    });

    app.get("/business/perfil", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "business/perfil/index.html") :
            path.join(__dirname, "../frontend/pages/build/business/perfil/index.html");
        res.sendFile(filePath);
    });

    app.get("/business/history", (req, res) => {
        const filePath = buildExists ?
            path.join(buildPath, "business/history/index.html") :
            path.join(__dirname, "../frontend/pages/build/business/history/index.html");
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

        console.error('Erro não tratado:', err);
        res.status(err.status || 500).json({
            status: 'error',
            message: err.message || 'Erro interno do servidor',
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack
            })
        });
    });

    // Captura todas as rotas não encontradas e redireciona para a página 404 personalizada
    // IMPORTANTE: Este middleware deve vir DEPOIS de todas as rotas registradas
    app.use((req, res) => {
        // Se for uma rota de API, retornar JSON em vez de HTML
        if (req.path.startsWith('/api/')) {
            console.log(`[404] Rota não encontrada: ${req.method} ${req.path}`);
            return res.status(404).json({
                status: 'error',
                error: 'Rota não encontrada',
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
    // Em produção, apenas retornar 404 para rotas não-API
    app.use((req, res, next) => {
        // Se não começar com /api/, retornar 404 (NGINX deve servir o frontend)
        if (!req.path.startsWith('/api/') && req.path !== '/openapi.yaml') {
            return res.status(404).json({
                error: 'Not found'
            });
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
        console.error('[INIT] Erro ao inicializar tabelas (sistema continuará):', error.message);
        // Não bloquear inicialização do servidor se houver erro nas tabelas
    }

    // Limpeza periódica de qr_tokens (pending/expired e used antigos) a cada 10 min
    setInterval(() => {
        cleanupOldQrTokens().catch((err) => console.error('[QR-TOKENS] Erro na limpeza:', err.message));
    }, 10 * 60 * 1000);

    if (process.env.NODE_ENV === 'development') {
        // Mostrar também o IP local da rede para acesso via dispositivos móveis
        const os = await
        import ('os');
        const networkInterfaces = os.networkInterfaces();
        let localIP = '192.168.1.64'; // IP padrão

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

    console.log(`  Página normal (local):      http://localhost:${PORT}/`);
    console.log(`  Página normal (público):    ${PUBLIC_URL}/`);
    console.log(`  Suporte (local):            http://localhost:${PORT}/suporte`);
    console.log(`  Suporte (público):          ${PUBLIC_URL}/suporte`);
    console.log(`  Corporativo (local):        http://localhost:${PORT}/corporativo`);
    console.log(`  Corporativo (público):      ${PUBLIC_URL}/corporativo`);
    console.log(`  Login Painel (local):       http://localhost:${PORT}/painel-suporte-corporacao/pages/login.html`);
    console.log(`  Login Painel (público):     ${PUBLIC_URL}/painel-suporte-corporacao/pages/login.html\n`);

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

    // Notificador de aniversário (parabéns por email e Discord no dia do aniversário)
    try {
        startBirthdayNotifier();
    } catch (error) {
        console.error('Erro ao iniciar notificador de aniversário:', error);
    }
});

