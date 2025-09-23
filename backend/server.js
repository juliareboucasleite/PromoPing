// @ts-nocheck
import 'dotenv/config';
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { sendNotification } from "./services/notify.js";
import { initDiscordBot } from "./services/discord.js";

// importa rotas
import authRoutes from "./routes/auth.js";
import produtosRoutes from "./routes/produtos.js";
import configRoutes from "./routes/config.js";
import userRoutes from "./routes/user.js";

// inicializa o express
const app = express();

// necessário porque estás a usar ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// middlewares
app.use(cors({
    origin: [
        "http://localhost:8080",
        "http://localhost:3000",
        "http://localhost:5500"
    ],
    credentials: true
}));
app.use(express.json());

// ================== HEALTH CHECK ==================
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
    });
});

// ================== ROTAS API ==================
app.use("/api/auth", authRoutes);
app.use("/api/produtos", produtosRoutes);
app.use("/api/config", configRoutes);
app.use("/api/user", userRoutes);

// ================== NOTIFICAÇÕES ==================
app.post("/notify", async (req, res) => {
    try {
        const { numero, mensagem, canal } = req.body;

        if (!mensagem || !canal) {
            return res.status(400).json({
                error: "Campos obrigatórios: mensagem e canal (numero para sms/whatsapp)"
            });
        }

        const result = await sendNotification({ numero, mensagem, canal });
        const sid = result?.sid ?? null;

        res.json({ status: "ok", canal, mensagem, sid });
    } catch (err) {
        console.error("Erro na notificação:", err);
        const message = err?.message ?? "erro desconhecido";
        res.status(500).json({ error: message });
    }
});

// ================== FRONTEND ESTÁTICO ==================
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "../frontend/pages/index.html"));
});

// ================== INICIAR SERVIDOR ==================
const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3000;

app.listen(PORT, HOST, () => {
    console.log(`🚀 Servidor PromoPing rodando em http://${HOST}:${PORT}`);
    console.log(`📁 Frontend: http://${HOST}:${PORT}/`);
    console.log(`🔧 API: http://${HOST}:${PORT}/api/`);
});

// Inicia o bot do Discord (não bloqueante)
initDiscordBot()
    .then(() => {
        console.log(`🤖 Bot Discord iniciado`);
    })
    .catch((error) => {
        console.log(`❌ Erro ao iniciar bot Discord:`, error.message);
    });
