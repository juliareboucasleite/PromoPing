// @ts-nocheck
import express from "express";
import passport from "passport";
import {
    Strategy as GoogleStrategy
} from "passport-google-oauth20";
import {
    Strategy as DiscordStrategy
} from "passport-discord";
import {
    Strategy as GitHubStrategy
} from "passport-github2";
import {
    pool
} from "../database/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {
    verifyToken
} from "../middleware/auth.js";
import {
    atualizarMetricasAutomaticamente
} from "./status.js";
import dotenv from "dotenv";
import path from "path";
import {
    fileURLToPath
} from "url";
import {
    findDiscordUser,
    registerDiscordUser,
    linkDiscordUser
} from "../utils/discord-users.js";
import {
    getCachedDiscordUser,
    setCachedDiscordUser
} from "../utils/discord-cache.js";
import {
    gerarReferenciaID,
    validarReferenciaID
} from "../utils/referenciaId.js";
import {
    getOrCreateSession,
    confirmSession,
    getSessionStatus,
    cleanupOldQrTokens
} from "../services/qrLoginSession.js";
import {
    is2FAEnabled,
    verifyCode,
    sendEmailCode
} from "../services/twoFactorService.js";
import QRCode from "qrcode";

dotenv.config({
    path: path.resolve(process.cwd(), '.env')
}); // Garante que .env está sendo lido da raiz

const router = express.Router();

// Expiração: access 30 dias, refresh 60 dias (renovação automática)
const JWT_ACCESS_EXPIRY = "30d";
const JWT_REFRESH_EXPIRY = "60d";

/**
 * Gera par access + refresh token para um utilizador.
 * @param {string} ReferenciaID
 * @param {string} email
 * @returns {{ token: string, refreshToken: string }}
 */
function gerarParesToken(ReferenciaID, email) {
    const secret = process.env.JWT_SECRET;
    const token = jwt.sign(
        { ReferenciaID, email },
        secret,
        { expiresIn: JWT_ACCESS_EXPIRY }
    );
    const refreshToken = jwt.sign(
        { ReferenciaID, email, type: "refresh" },
        secret,
        { expiresIn: JWT_REFRESH_EXPIRY }
    );
    return { token, refreshToken };
}

/** Token de curta duração (5 min) usado apenas para completar 2FA no login. */
function gerarToken2FAPending(ReferenciaID, email) {
    const secret = process.env.JWT_SECRET;
    return jwt.sign(
        { ReferenciaID, email, type: "2fa_pending" },
        secret,
        { expiresIn: "5m" }
    );
}

function gerarCodigo() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Função para enviar email
async function enviarEmail(to, subject, text) {
    try {
        const {
            sendEmail
        } = await import("../services/notify.js");
        await sendEmail(to, subject, text);
        console.log(` Email enviado para ${to}`);
        return {
            success: true
        };
    } catch (error) {
        console.error(" Erro ao enviar email:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // Construir callback URL dinamicamente
    const baseUrl = process.env.BASE_URL || process.env.API_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}`;
    const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || `${baseUrl}/api/auth/google/callback`;
    
    console.log(`[AUTH] Google OAuth Callback URL: ${googleCallbackUrl}`);
    
    passport.use(
        new GoogleStrategy({
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: googleCallbackUrl,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    console.log("[GOOGLE STRATEGY] Profile recebido:", {
                        id: profile.id,
                        displayName: profile.displayName,
                        emails: profile.emails ? profile.emails.map(e => e.value) : [],
                        photos: profile.photos ? profile.photos.length : 0
                    });
                    console.log("[GOOGLE STRATEGY] Tokens recebidos:", {
                        hasAccessToken: !!accessToken,
                        hasRefreshToken: !!refreshToken
                    });

                    // Verificar se profile tem emails
                    if (!profile.emails || profile.emails.length === 0) {
                        const error = new Error("Email não fornecido pelo Google. Certifique-se de que seu email está visível no Google.");
                        console.error("[GOOGLE STRATEGY] Erro: Email não fornecido pelo Google");
                        return done(error, null);
                    }

                    const email = profile.emails[0].value;
                    const googleId = profile.id;
                    const fotoPerfil = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
                    const nome = profile.displayName || profile.name ?.givenName || 'Usuário Google';

                    console.log("[GOOGLE STRATEGY] Processando usuário:", { email, nome, googleId });

                    const [rows] = await pool.query(
                        "SELECT * FROM Utilizadores WHERE Email = ?",
                        [email]
                    );

                    let referenciaID;
                    if (rows.length > 0) {
                        referenciaID = rows[0].ReferenciaID;
                        // Atualizar foto de perfil e google_id se fornecidos
                        if (fotoPerfil || googleId) {
                            try {
                                // Tentar atualizar com google_id e FotoPerfil
                                if (fotoPerfil && googleId) {
                                    await pool.query(
                                        "UPDATE Utilizadores SET FotoPerfil = ?, google_id = ? WHERE ReferenciaID = ?",
                                        [fotoPerfil, googleId, referenciaID]
                                    );
                                } else if (fotoPerfil) {
                                    await pool.query(
                                        "UPDATE Utilizadores SET FotoPerfil = ? WHERE ReferenciaID = ?",
                                        [fotoPerfil, referenciaID]
                                    );
                                } else if (googleId) {
                                    await pool.query(
                                        "UPDATE Utilizadores SET google_id = ? WHERE ReferenciaID = ?",
                                        [googleId, referenciaID]
                                    );
                                }
                            } catch (updateErr) {
                                // Se campo não existe, tentar atualizar apenas o que existe
                                console.log("[GOOGLE STRATEGY] Erro ao atualizar (campo pode não existir):", updateErr.message);
                                try {
                                    if (fotoPerfil) {
                                        await pool.query(
                                            "UPDATE Utilizadores SET FotoPerfil = ? WHERE ReferenciaID = ?",
                                            [fotoPerfil, referenciaID]
                                        );
                                    }
                                } catch (fotoErr) {
                                    console.log("[GOOGLE STRATEGY] FotoPerfil não existe, ignorando");
                                }
                                try {
                                    if (googleId) {
                                        await pool.query(
                                            "UPDATE Utilizadores SET google_id = ? WHERE ReferenciaID = ?",
                                            [googleId, referenciaID]
                                        );
                                    }
                                } catch (googleIdErr) {
                                    console.log("[GOOGLE STRATEGY] google_id não existe, ignorando");
                                }
                            }
                        }
                        console.log("[GOOGLE STRATEGY] Usuário Google já existe:", email);
                    } else {
                        // Determinar PerfilId: se não existe admin (PerfilId=1), o primeiro registro vira admin; caso contrário, padrão user (2)
                        const [adminCountRows] = await pool.query(
                            "SELECT COUNT(*) as total FROM Utilizadores WHERE PerfilId = 1"
                        );
                        const perfilId = (adminCountRows[0]?.total || 0) === 0 ? 1 : 2;
                        
                        // Gerar ReferenciaID para novo usuário
                        const novaReferenciaID = gerarReferenciaID();
                        
                        // Inserir novo usuário com foto de perfil, google_id e campos necessários
                        try {
                            // Tentar inserir com google_id, FotoPerfil, Ativo e PerfilId
                            const [result] = await pool.query(
                                "INSERT INTO Utilizadores (ReferenciaID, Nome, Email, Telefone, FotoPerfil, google_id, Ativo, PerfilId, DataRegisto, EmailVerificado) VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW(), 1)",
                                [novaReferenciaID, nome, email, null, fotoPerfil, googleId, perfilId]
                            );
                            referenciaID = novaReferenciaID;
                            console.log("[GOOGLE STRATEGY] Novo usuário criado com ReferenciaID:", referenciaID);
                            
                            // Atualizar métricas automaticamente
                            try {
                                await atualizarMetricasAutomaticamente();
                                console.log("[GOOGLE STRATEGY] Métricas atualizadas após criação de novo utilizador via Google");
                            } catch (metricError) {
                                console.error("[GOOGLE STRATEGY] Erro ao atualizar métricas:", metricError);
                            }
                        } catch (insertErr) {
                            // Se campos não existem, tentar inserir sem eles
                            try {
                                const [result] = await pool.query(
                                    "INSERT INTO Utilizadores (ReferenciaID, Nome, Email, Telefone, FotoPerfil, Ativo, PerfilId, DataRegisto, EmailVerificado) VALUES (?, ?, ?, ?, ?, 1, ?, NOW(), 1)",
                                    [novaReferenciaID, nome, email, null, fotoPerfil, perfilId]
                                );
                                referenciaID = novaReferenciaID;
                                
                                // Tentar atualizar google_id separadamente se possível
                                if (googleId) {
                                    try {
                                        await pool.query(
                                            "UPDATE Utilizadores SET google_id = ? WHERE ReferenciaID = ?",
                                            [googleId, referenciaID]
                                        );
                                    } catch (googleIdErr) {
                                        console.log("[GOOGLE STRATEGY] Campo google_id não existe, ignorando");
                                    }
                                }
                                
                                // Atualizar métricas automaticamente
                                try {
                                    await atualizarMetricasAutomaticamente();
                                    console.log("[GOOGLE STRATEGY] Métricas atualizadas após criação de novo utilizador via Google");
                                } catch (metricError) {
                                    console.error("[GOOGLE STRATEGY] Erro ao atualizar métricas:", metricError);
                                }
                            } catch (insertErr2) {
                                // Se FotoPerfil não existe, inserir sem ele mas com campos essenciais
                                const [result] = await pool.query(
                                    "INSERT INTO Utilizadores (ReferenciaID, Nome, Email, Telefone, Ativo, PerfilId, DataRegisto, EmailVerificado) VALUES (?, ?, ?, ?, 1, ?, NOW(), 1)",
                                    [novaReferenciaID, nome, email, null, perfilId]
                                );
                                referenciaID = novaReferenciaID;
                                
                                // Tentar atualizar google_id separadamente se possível
                                if (googleId) {
                                    try {
                                        await pool.query(
                                            "UPDATE Utilizadores SET google_id = ? WHERE ReferenciaID = ?",
                                            [googleId, referenciaID]
                                        );
                                    } catch (googleIdErr) {
                                        console.log("[GOOGLE STRATEGY] Campo google_id não existe, ignorando");
                                    }
                                }
                                
                                // Tentar atualizar FotoPerfil separadamente se possível
                                if (fotoPerfil) {
                                    try {
                                        await pool.query(
                                            "UPDATE Utilizadores SET FotoPerfil = ? WHERE ReferenciaID = ?",
                                            [fotoPerfil, referenciaID]
                                        );
                                    } catch (fotoErr) {
                                        console.log("[GOOGLE STRATEGY] Campo FotoPerfil não existe, ignorando");
                                    }
                                }
                                
                                // Atualizar métricas automaticamente
                                try {
                                    await atualizarMetricasAutomaticamente();
                                    console.log("[GOOGLE STRATEGY] Métricas atualizadas após criação de novo utilizador via Google");
                                } catch (metricError) {
                                    console.error("[GOOGLE STRATEGY] Erro ao atualizar métricas:", metricError);
                                }
                            }
                        }
                    }

                    await pool.query(
                        `INSERT INTO configutilizador (ReferenciaID, CanalPreferido) 
             VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE CanalPreferido = VALUES(CanalPreferido)`,
                        [referenciaID, "email"]
                    );

                    // Salvar tokens OAuth para sincronização de calendário
                    if (accessToken) {
                        try {
                            // Garantir que a tabela existe
                            await pool.query(`
                                CREATE TABLE IF NOT EXISTS google_oauth_tokens (
                                    id INT AUTO_INCREMENT PRIMARY KEY,
                                    ReferenciaID VARCHAR(13) NOT NULL,
                                    access_token TEXT NOT NULL,
                                    refresh_token TEXT,
                                    token_type VARCHAR(50) DEFAULT 'Bearer',
                                    expires_at TIMESTAMP NULL,
                                    scope TEXT,
                                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                                    INDEX idx_ReferenciaID (ReferenciaID),
                                    INDEX idx_expires_at (expires_at),
                                    FOREIGN KEY (ReferenciaID) REFERENCES Utilizadores(ReferenciaID) ON DELETE CASCADE,
                                    UNIQUE KEY unique_user_token (ReferenciaID)
                                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                            `);

                            // Calcular data de expiração (tokens do Google geralmente expiram em 1 hora)
                            const expiresAt = new Date();
                            expiresAt.setHours(expiresAt.getHours() + 1);

                            await pool.query(
                                `INSERT INTO google_oauth_tokens (ReferenciaID, access_token, refresh_token, expires_at, scope)
                                 VALUES (?, ?, ?, ?, ?)
                                 ON DUPLICATE KEY UPDATE 
                                     access_token = VALUES(access_token),
                                     refresh_token = VALUES(refresh_token),
                                     expires_at = VALUES(expires_at),
                                     scope = VALUES(scope),
                                     updated_at = NOW()`,
                                [referenciaID, accessToken, refreshToken || null, expiresAt, 'calendar.readonly']
                            );
                            console.log("[GOOGLE STRATEGY] Tokens OAuth salvos para sincronização de calendário");
                        } catch (tokenErr) {
                            console.error("[GOOGLE STRATEGY] Erro ao salvar tokens OAuth:", tokenErr);
                            // Não falhar o login se não conseguir salvar tokens
                        }
                    }

                    return done(null, {
                        ReferenciaID: referenciaID,
                        email,
                        nome,
                        fotoPerfil,
                        googleId: googleId, // Incluir googleId para uso no callback
                        accessToken: accessToken, // Incluir para uso no callback
                        refreshToken: refreshToken
                    });
                } catch (err) {
                    return done(err, null);
                }
            }
        )
    );
} else {
    // Google OAuth não configurado - silencioso
}

// estrategia do github
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    // Construir callback URL dinamicamente
    const baseUrl = process.env.BASE_URL || process.env.API_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}`;
    const githubCallbackUrl = process.env.GITHUB_CALLBACK_URL || `${baseUrl}/api/auth/github/callback`;
    
    console.log(`[AUTH] GitHub OAuth Callback URL: ${githubCallbackUrl}`);
    
    passport.use(
        new GitHubStrategy({
                clientID: process.env.GITHUB_CLIENT_ID,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
                callbackURL: githubCallbackUrl,
                scope: ['user:email']
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // GitHub pode não ter email público, então precisamos buscar da API
                    let email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

                    // Se não houver email no perfil, tentar buscar da API do GitHub
                    if (!email) {
                        try {
                            const response = await fetch('https://api.github.com/user/emails', {
                                headers: {
                                    'Authorization': `token ${accessToken}`,
                                    'User-Agent': 'PromoPing'
                                }
                            });
                            const emails = await response.json();
                            if (Array.isArray(emails) && emails.length > 0) {
                                const primaryEmail = emails.find(e => e.primary) || emails[0];
                                email = primaryEmail.email;
                            }
                        } catch (emailErr) {
                            console.log("Erro ao buscar email do GitHub:", emailErr.message);
                        }
                    }

                    // Usar email do GitHub ou criar um email baseado no username
                    if (!email) {
                        email = `${profile.username}@github.local`;
                    }

                    const fotoPerfil = profile.photos && profile.photos[0] ? profile.photos[0].value :
                        profile._json ?.avatar_url || null;
                    const nome = profile.displayName || profile.username || 'Usuário GitHub';

                    const [rows] = await pool.query(
                        "SELECT * FROM Utilizadores WHERE Email = ?",
                        [email]
                    );

                    let referenciaID;
                    if (rows.length > 0) {
                        referenciaID = rows[0].ReferenciaID;
                        // Atualizar foto de perfil se fornecida
                        if (fotoPerfil) {
                            try {
                                await pool.query(
                                    "UPDATE Utilizadores SET FotoPerfil = ? WHERE ReferenciaID = ?",
                                    [fotoPerfil, referenciaID]
                                );
                            } catch (updateErr) {
                                console.log("Erro ao atualizar foto de perfil (campo pode não existir):", updateErr.message);
                            }
                        }
                        console.log("Usuário GitHub já existe:", email);
                    } else {
                        // Gerar ReferenciaID para novo usuário
                        const novaReferenciaID = gerarReferenciaID();
                        
                        // Inserir novo usuário com foto de perfil se disponível
                        try {
                            const [result] = await pool.query(
                                "INSERT INTO Utilizadores (ReferenciaID, Nome, Email, Telefone, FotoPerfil) VALUES (?, ?, ?, ?, ?)",
                                [novaReferenciaID, nome, email, null, fotoPerfil]
                            );
                            referenciaID = novaReferenciaID;

                            // Atualizar métricas automaticamente quando novo utilizador é criado via GitHub
                            try {
                                await atualizarMetricasAutomaticamente();
                                console.log(" Métricas atualizadas após criação de novo utilizador via GitHub");
                            } catch (metricError) {
                                console.error(" Erro ao atualizar métricas após criação de utilizador:", metricError);
                                // Não bloquear resposta em caso de erro nas métricas
                            }
                        } catch (insertErr) {
                            // Se campo FotoPerfil não existe, inserir sem ele
                            const [result] = await pool.query(
                                "INSERT INTO Utilizadores (ReferenciaID, Nome, Email, Telefone) VALUES (?, ?, ?, ?)",
                                [novaReferenciaID, nome, email, null]
                            );
                            referenciaID = novaReferenciaID;

                            // Atualizar métricas automaticamente quando novo utilizador é criado via GitHub
                            try {
                                await atualizarMetricasAutomaticamente();
                                console.log(" Métricas atualizadas após criação de novo utilizador via GitHub");
                            } catch (metricError) {
                                console.error(" Erro ao atualizar métricas após criação de utilizador:", metricError);
                                // Não bloquear resposta em caso de erro nas métricas
                            }
                        }
                    }

                    await pool.query(
                        `INSERT INTO configutilizador (ReferenciaID, CanalPreferido) 
             VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE CanalPreferido = VALUES(CanalPreferido)`,
                        [referenciaID, "email"]
                    );

                    return done(null, {
                        ReferenciaID: referenciaID,
                        email,
                        nome,
                        fotoPerfil
                    });
                } catch (err) {
                    return done(err, null);
                }
            }
        )
    );
} else {
    // GitHub OAuth não configurado - silencioso
}

// uma estrategia que eu peguei de um bot q usei em 2020 usando js
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    // Construir callback URL dinamicamente
    const baseUrl = process.env.BASE_URL || process.env.API_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}`;
    const discordCallbackUrl = process.env.DISCORD_CALLBACK_URL || `${baseUrl}/api/auth/discord/callback`;
    
    console.log(`[AUTH] Discord OAuth Callback URL: ${discordCallbackUrl}`);
    
    passport.use(
        new DiscordStrategy({
                clientID: process.env.DISCORD_CLIENT_ID,
                clientSecret: process.env.DISCORD_CLIENT_SECRET,
                callbackURL: discordCallbackUrl,
                scope: ['identify', 'email']
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    console.log(" [DISCORD STRATEGY] ========== INÍCIO DA ESTRATÉGIA ==========");
                    console.log(" [DISCORD STRATEGY] Profile recebido:", {
                        id: profile.id,
                        username: profile.username,
                        email: profile.email,
                        avatar: profile.avatar,
                        verified: profile.verified
                    });

                    // Verificar se o email está disponível e verificado
                    if (!profile.email) {
                        const error = new Error("Email não fornecido pelo Discord. Certifique-se de que seu email está verificado no Discord.");
                        console.error(" Erro: Email não fornecido pelo Discord");
                        return done(error, null);
                    }

                    const email = profile.email;
                    const discordId = profile.id;
                    const username = profile.username;
                    const avatar = profile.avatar;

                    // Verificar se usuário Discord já existe no JSON
                    let discordUser = findDiscordUser(discordId);

                    if (discordUser && discordUser.ReferenciaID) {
                        // Usuário Discord já existe e está associado - LOGIN DIRETO
                        console.log(" Usuário Discord já registrado - Login direto:", discordUser.username);

                        // Garantir que discord_id está salvo no banco (caso não esteja)
                        try {
                            await pool.query(
                                "UPDATE utilizadores SET discord_id = ? WHERE ReferenciaID = ? AND (discord_id IS NULL OR discord_id = '')",
                                [discordId, discordUser.ReferenciaID]
                            );
                        } catch (dbError) {
                            console.log(" [DISCORD STRATEGY] Erro ao atualizar discord_id (coluna pode não existir):", dbError.message);
                            // Continuar mesmo se falhar
                        }

                        // Garantir que está na tabela contasconectadas
                        try {
                            await pool.query(
                                "INSERT INTO contasconectadas (ReferenciaID, Tipo, Conectado, DataConexao) VALUES (?, 'discord', 1, NOW()) ON DUPLICATE KEY UPDATE Conectado = 1, DataConexao = NOW()",
                                [discordUser.ReferenciaID]
                            );
                        } catch (contasError) {
                            console.log(" [DISCORD STRATEGY] Erro ao inserir em contasconectadas:", contasError.message);
                        }

                        const { token, refreshToken } = gerarParesToken(discordUser.ReferenciaID, discordUser.email);

                        console.log(" [DISCORD STRATEGY] Login direto realizado para usuário:", discordUser.ReferenciaID);
                        const userObject = {
                            ReferenciaID: discordUser.ReferenciaID,
                            email: discordUser.email,
                            token,
                            refreshToken,
                            discordId: discordId
                        };
                        console.log(" [DISCORD STRATEGY] Chamando done() com user (login direto):", JSON.stringify(userObject, null, 2));
                        return done(null, userObject);
                    }

                    // Usuário Discord não existe ou não está associado
                    if (!discordUser) {
                        // Registrar novo usuário Discord no JSON
                        discordUser = registerDiscordUser({
                            id: discordId,
                            username: username,
                            email: email,
                            avatar: avatar
                        });
                    }

                    // Verificar se usuário existe no banco de dados
                    const [rows] = await pool.query(
                        "SELECT * FROM Utilizadores WHERE Email = ?",
                        [email]
                    );

                    let referenciaID;
                    if (rows.length > 0) {
                        // Usuário já existe no banco - ASSOCIAR DISCORD
                        console.log(" Usuário existente encontrado - Associando Discord:", rows[0].Nome);
                        referenciaID = rows[0].ReferenciaID;

                        // Associar Discord com usuário do banco
                        linkDiscordUser(discordId, referenciaID);
                        
                        // Atualizar discord_id no banco de dados (se a coluna existir)
                        try {
                            await pool.query(
                                "UPDATE utilizadores SET discord_id = ? WHERE ReferenciaID = ?",
                                [discordId, referenciaID]
                            );
                            console.log(` [DISCORD STRATEGY] discord_id ${discordId} salvo no banco para usuário ${referenciaID}`);
                        } catch (dbError) {
                            console.error(" [DISCORD STRATEGY] Erro ao salvar discord_id (coluna pode não existir):", dbError.message);
                            // Continuar mesmo se falhar - o linkDiscordUser já foi feito
                        }

                        // Inserir ou atualizar na tabela contasconectadas
                        try {
                            await pool.query(
                                "INSERT INTO contasconectadas (ReferenciaID, Tipo, Conectado, DataConexao) VALUES (?, 'discord', 1, NOW()) ON DUPLICATE KEY UPDATE Conectado = 1, DataConexao = NOW()",
                                [referenciaID]
                            );
                            console.log(` [DISCORD STRATEGY] Discord inserido/atualizado em contasconectadas para usuário ${referenciaID}`);
                        } catch (contasError) {
                            console.error(" [DISCORD STRATEGY] Erro ao inserir em contasconectadas:", contasError.message);
                        }
                    } else {
                        // Gerar ReferenciaID para novo usuário
                        const novaReferenciaID = gerarReferenciaID();
                        
                        // Criar novo usuário no banco (tentar com discord_id, se falhar, criar sem)
                        console.log("🆕 Criando novo usuário no banco:", username);
                        let result;
                        try {
                            // Tentar criar com discord_id
                            [result] = await pool.query(
                                "INSERT INTO utilizadores (ReferenciaID, Nome, Email, Ativo, discord_id) VALUES (?, ?, ?, 1, ?)",
                                [novaReferenciaID, username, email, discordId]
                            );
                            console.log(` [DISCORD STRATEGY] Novo usuário criado com ReferenciaID ${novaReferenciaID} e discord_id ${discordId}`);
                        } catch (dbError) {
                            // Se falhar (coluna não existe), criar sem discord_id
                            console.log(" [DISCORD STRATEGY] Coluna discord_id não encontrada, criando usuário sem ela");
                            [result] = await pool.query(
                                "INSERT INTO utilizadores (ReferenciaID, Nome, Email, Ativo) VALUES (?, ?, ?, 1)",
                                [novaReferenciaID, username, email]
                            );
                        }
                        referenciaID = novaReferenciaID;

                        // Inserir Discord na tabela contasconectadas para novo usuário
                        try {
                            await pool.query(
                                "INSERT INTO contasconectadas (ReferenciaID, Tipo, Conectado, DataConexao) VALUES (?, 'discord', 1, NOW())",
                                [referenciaID]
                            );
                            console.log(` [DISCORD STRATEGY] Discord inserido em contasconectadas para novo usuário ${referenciaID}`);
                        } catch (contasError) {
                            console.error(" [DISCORD STRATEGY] Erro ao inserir em contasconectadas:", contasError.message);
                        }

                        // Buscar ID do plano FREE
                        const [planoFree] = await pool.query(
                            "SELECT Id FROM planos WHERE Nome = 'Free' LIMIT 1"
                        );

                        const planoFreeId = planoFree.length > 0 ? planoFree[0].Id : 1; // Fallback para ID 1

                        // Criar configuração do usuário com plano FREE
                        await pool.query(
                            "INSERT INTO configutilizador (ReferenciaID, CanalPreferido, PlanoAtualId) VALUES (?, ?, ?)",
                            [referenciaID, "discord", planoFreeId]
                        );

                        console.log(` Usuário Discord ${username} registrado com plano FREE (ID: ${planoFreeId})`);

                        // Associar Discord com novo usuário
                        linkDiscordUser(discordId, referenciaID);

                        // Atualizar métricas automaticamente quando novo utilizador é criado via Discord
                        try {
                            await atualizarMetricasAutomaticamente();
                            console.log(" Métricas atualizadas após criação de novo utilizador via Discord");
                        } catch (metricError) {
                            console.error(" Erro ao atualizar métricas após criação de utilizador:", metricError);
                            // Não bloquear resposta em caso de erro nas métricas
                        }
                    }

                    const { token, refreshToken } = gerarParesToken(referenciaID, email);

                    console.log(" [DISCORD STRATEGY] Token JWT gerado para usuário:", referenciaID);
                    const userObject = {
                        ReferenciaID: referenciaID,
                        email,
                        token,
                        refreshToken,
                        discordId: discordId
                    };
                    console.log(" [DISCORD STRATEGY] Chamando done() com user:", JSON.stringify(userObject, null, 2));
                    return done(null, userObject);
                } catch (error) {
                    console.error(" [DISCORD STRATEGY] ERRO na autenticação Discord:", error);
                    console.error(" [DISCORD STRATEGY] Stack trace:", error.stack);
                    return done(error, null);
                }
            }
        )
    );
} else {
    // Discord OAuth não configurado - silencioso
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ================== ROTAS DISCORD ==================

// Verificar se usuário Discord já existe
router.get('/discord/check/:discordId', async (req, res) => {
    try {
        const {
            discordId
        } = req.params;
        const discordUser = findDiscordUser(discordId);

        if (discordUser && discordUser.ReferenciaID) {
            // Usuário já existe - pode fazer login direto
            res.json({
                exists: true,
                message: "Usuário Discord já registrado - pode fazer login direto",
                user: {
                    username: discordUser.username,
                    email: discordUser.email
                }
            });
        } else {
            // Usuário não existe - precisa registrar
            res.json({
                exists: false,
                message: "Usuário Discord não encontrado - precisa registrar primeiro"
            });
        }
    } catch (error) {
        console.error(" Erro ao verificar usuário Discord:", error);
        res.status(500).json({
            error: "Erro interno do servidor"
        });
    }
});

// Rota alternativa para Discord sem rate limiting
router.get('/discord/direct/:discordId', async (req, res) => {
    try {
        const {
            discordId
        } = req.params;
        const discordUser = findDiscordUser(discordId);

        if (discordUser && discordUser.ReferenciaID) {
            const { token, refreshToken } = gerarParesToken(discordUser.ReferenciaID, discordUser.email);

            console.log(" Login direto via rota alternativa para usuário:", discordUser.ReferenciaID);

            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Discord Login - PromoPing</title>
        </head>
        <body>
          <script>
            localStorage.setItem('PROMOPING_TOKEN', '${token}');
            localStorage.setItem('PROMOPING_REFRESH_TOKEN', '${refreshToken}');
            localStorage.setItem('user', JSON.stringify({
              ReferenciaID: '${discordUser.ReferenciaID}',
              email: '${discordUser.email}',
              token: '${token}',
              loginMethod: 'discord'
            }));
            
            // Salvar token separadamente para compatibilidade com auth.js
            localStorage.setItem('token', '${token}');
            
            // Redirecionar para o painel
            window.location.href = '/dashboard';
          </script>
          <p>Redirecionando para o painel...</p>
        </body>
        </html>
      `;

            res.send(html);
        } else {
            res.status(404).json({
                error: "Usuário Discord não encontrado"
            });
        }
    } catch (error) {
        console.error(" Erro no login direto Discord:", error);
        res.status(500).json({
            error: "Erro interno do servidor"
        });
    }
});

// ================== ROTAS SMS/WHATSAPP REMOVIDAS ==================
// Serviços SMS e WhatsApp foram removidos - apenas Email e Discord disponíveis

// ================== ROTAS EMAIL/SENHA ==================

// ================== RESET DE SENHA (ESTILO PINTEREST) ==================

// Buscar contas por nome/email/username (estilo Pinterest)
router.get("/search-accounts", async (req, res) => {
    try {
        const {
            query
        } = req.query;

        if (!query || query.trim().length < 2) {
            return res.json({
                status: "ok",
                accounts: []
            });
        }

        const searchTerm = `%${query.trim()}%`;

        // Buscar usuários por nome, email ou username (usando nome como username)
        const [userRows] = await pool.query(
            `SELECT Id, Nome, Email, FotoPerfil 
       FROM Utilizadores 
       WHERE (Nome LIKE ? OR Email LIKE ?) 
       AND Ativo = 1 
       AND EmailVerificado = 1
       LIMIT 10`,
            [searchTerm, searchTerm]
        );

        // Mascarar emails para privacidade
        const accounts = userRows.map(user => {
            const email = user.Email || '';
            const [localPart, domain] = email.split('@');

            let maskedEmail = '';
            if (localPart && localPart.length > 0) {
                const visibleChars = Math.min(2, localPart.length);
                const maskedChars = localPart.length - visibleChars;
                maskedEmail = localPart.substring(0, visibleChars) + '_'.repeat(Math.min(maskedChars, 4));
            }

            if (domain) {
                const [domainName, domainExt] = domain.split('.');
                const visibleDomainChars = Math.min(1, domainName.length);
                const maskedDomain = domainName.substring(0, visibleDomainChars) + '_'.repeat(Math.min(domainName.length - visibleDomainChars, 3));
                maskedEmail += `@${maskedDomain}.${domainExt ? domainExt.substring(0, 1) + '_'.repeat(Math.min(domainExt.length - 1, 2)) : ''}`;
            }

            return {
                ReferenciaID: user.ReferenciaID,
                nome: user.Nome,
                email: email, // Email real para envio
                maskedEmail: maskedEmail, // Email mascarado para exibição
                fotoPerfil: user.FotoPerfil || null
            };
        });

        res.json({
            status: "ok",
            accounts: accounts
        });
    } catch (err) {
        console.error("[SEARCH-ACCOUNTS] Erro ao buscar contas:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao buscar contas",
        });
    }
});

// Solicitar reset de senha (estilo Pinterest)
router.post("/forgot-password", async (req, res) => {
    try {
        const {
            email
        } = req.body;

        if (!email) {
            return res.status(400).json({
                status: "error",
                error: "Email é obrigatório",
            });
        }

        // Buscar usuário
        const [userRows] = await pool.query(
            "SELECT ReferenciaID, Nome, Email FROM Utilizadores WHERE Email = ?",
            [email]
        );

        // SEMPRE retornar sucesso (por segurança, não revelar se email existe)
        if (userRows.length === 0) {
            return res.json({
                status: "ok",
                message: "Se este email estiver cadastrado, você receberá um link para redefinir sua senha.",
            });
        }

        const user = userRows[0];

        // Gerar token único
        const crypto = await import("crypto");
        const token = crypto.default.randomBytes(32).toString("hex");

        // Token expira em 24 horas
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Criar tabela se não existir
        await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        ReferenciaID VARCHAR(13) NOT NULL,
        Token VARCHAR(255) NOT NULL UNIQUE,
        Email VARCHAR(255) NOT NULL,
        ExpiresAt TIMESTAMP NOT NULL,
        Used BOOLEAN DEFAULT FALSE,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (Token),
        INDEX idx_ReferenciaID (ReferenciaID),
        INDEX idx_email (Email),
        INDEX idx_expires_at (ExpiresAt),
        FOREIGN KEY (ReferenciaID) REFERENCES Utilizadores(ReferenciaID) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

        // Invalidar tokens anteriores do usuário
        await pool.query(
            "UPDATE password_reset_tokens SET Used = TRUE WHERE ReferenciaID = ? AND Used = FALSE",
            [user.ReferenciaID]
        );

        // Salvar novo token
        await pool.query(
            "INSERT INTO password_reset_tokens (ReferenciaID, Token, Email, ExpiresAt) VALUES (?, ?, ?, ?)",
            [user.ReferenciaID, token, user.Email, expiresAt]
        );

        // URL de reset (ajustar conforme ambiente)
        const baseUrl = process.env.FRONTEND_URL || "http://127.0.0.1:3000";
        const resetUrl = `${baseUrl}/inc/forgot-password.html?token=${token}`;

        // Template de email estilo Pinterest
        const emailHtml = `
      <!DOCTYPE html>
      <html lang="pt-PT">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redefinir senha - PromoPing</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; max-width: 600px;">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center;">
                    <div style="width: 60px; height: 60px; background-color: #ff6b35; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: #ffffff; font-size: 32px; font-weight: bold;">P</span>
                    </div>
                    <h1 style="margin: 0; color: #000000; font-size: 24px; font-weight: 600;">Recebemos o teu pedido</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 0 40px 20px;">
                    <p style="margin: 0 0 30px; color: #000000; font-size: 16px; line-height: 24px;">Já podes repor a tua palavra-passe!</p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${resetUrl}" style="display: inline-block; background-color: #e60023; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 24px; font-size: 16px; font-weight: 600; text-align: center;">Redefinir senha</a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 30px 0 0; color: #666666; font-size: 14px; line-height: 20px;">Informamos que tens 24 horas para escolher uma palavra-passe. Depois disso, terás de solicitar uma nova.</p>
                    
                    <p style="margin: 20px 0 0; color: #666666; font-size: 14px; line-height: 20px;">Não solicitaste uma nova palavra-passe? Podes ignorar este e-mail.</p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 40px; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0 0 10px; color: #666666; font-size: 12px; line-height: 18px;">Este e-mail foi enviado para <strong>${user.Email}</strong></p>
                    <p style="margin: 10px 0; color: #999999; font-size: 12px;">
                      <a href="${baseUrl}" style="color: #666666; text-decoration: none;">Central de Ajuda</a> · 
                      <a href="${baseUrl}/pages/privacidade.html" style="color: #666666; text-decoration: none;">Política de Privacidade</a> · 
                      <a href="${baseUrl}/pages/termos.html" style="color: #666666; text-decoration: none;">Termos e condições</a>
                    </p>
                    <p style="margin: 20px 0 0; color: #999999; font-size: 11px; line-height: 16px;">PromoPing. Todos os direitos reservados.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

        // Enviar email
        const emailResult = await enviarEmail(
            user.Email,
            "Repõe a palavra-passe - PromoPing",
            emailHtml
        );

        if (emailResult.success) {
            console.log(`[FORGOT-PASSWORD] Email de reset enviado para ${user.Email}`);
        }

        res.json({
            status: "ok",
            message: "Se este email estiver cadastrado, você receberá um link para redefinir sua senha.",
        });
    } catch (err) {
        console.error("[FORGOT-PASSWORD] Erro ao processar solicitação:", err);
        // Sempre retornar sucesso por segurança
        res.json({
            status: "ok",
            message: "Se este email estiver cadastrado, você receberá um link para redefinir sua senha.",
        });
    }
});

// Validar token de reset
router.get("/reset-password/:token", async (req, res) => {
    try {
        const {
            token
        } = req.params;

        if (!token) {
            return res.status(400).json({
                status: "error",
                error: "Token é obrigatório",
            });
        }

        // Buscar token válido
        const [tokenRows] = await pool.query(
            `SELECT prt.*, u.Email 
       FROM password_reset_tokens prt
       INNER JOIN Utilizadores u ON prt.ReferenciaID = u.ReferenciaID
       WHERE prt.Token = ? AND prt.Used = FALSE AND prt.ExpiresAt > NOW()`,
            [token]
        );

        if (tokenRows.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "Token inválido ou expirado",
            });
        }

        res.json({
            status: "ok",
            valid: true,
            email: tokenRows[0].Email,
        });
    } catch (err) {
        console.error("[RESET-PASSWORD] Erro ao validar token:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao validar token",
        });
    }
});

// Resetar senha com token
router.post("/reset-password", async (req, res) => {
    try {
        const {
            token,
            newPassword
        } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                status: "error",
                error: "Token e nova senha são obrigatórios",
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                status: "error",
                error: "A senha deve ter pelo menos 6 caracteres",
            });
        }

        // Buscar token válido
        const [tokenRows] = await pool.query(
            `SELECT prt.*, u.ReferenciaID
       FROM password_reset_tokens prt
       INNER JOIN Utilizadores u ON prt.ReferenciaID = u.ReferenciaID
       WHERE prt.Token = ? AND prt.Used = FALSE AND prt.ExpiresAt > NOW()`,
            [token]
        );

        if (tokenRows.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "Token inválido ou expirado",
            });
        }

        const tokenData = tokenRows[0];

        // Hash da nova senha
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Atualizar senha
        await pool.query(
            "UPDATE Utilizadores SET SenhaHash = ? WHERE ReferenciaID = ?",
            [hashedPassword, tokenData.ReferenciaID]
        );

        // Marcar token como usado
        await pool.query(
            "UPDATE password_reset_tokens SET Used = TRUE WHERE Token = ?",
            [token]
        );

        console.log(`[RESET-PASSWORD] Senha redefinida com sucesso para usuário ${tokenData.ReferenciaID}`);

        res.json({
            status: "ok",
            message: "Senha redefinida com sucesso!",
        });
    } catch (err) {
        console.error("[RESET-PASSWORD] Erro ao resetar senha:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao redefinir senha",
        });
    }
});

// ================== FIM RESET DE SENHA (ESTILO PINTEREST) ==================

// LOGIN com email e senha
router.post("/login", async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;
        console.log(" Login tentativa:", email);

        if (!email || !password) {
            return res.status(400).json({
                status: "error",
                error: "Email e senha são obrigatórios",
            });
        }

        // Busca utilizador
        const [rows] = await pool.query(
            "SELECT * FROM Utilizadores WHERE Email = ?",
            [email]
        );
        console.log(" Resultado SELECT:", rows);

        if (rows.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "Email ou senha incorretos",
            });
        }

        const user = rows[0];
        console.log(" Usuário retornado:", user);

        if (!user.SenhaHash) {
            return res.status(400).json({
                status: "error",
                error: "Conta não tem senha configurada. Use Google ou configure uma senha no perfil.",
            });
        }

        // Verifica senha usando bcrypt
        // ESSA PARTE AQUI É CRÍTICA: valida se a senha está correta
        // Se tu mudar a lógica, pode deixar qualquer um fazer login
        // Ou bloquear quem tem a senha certa
        // NÃO MEXA NESSA MERDA
        const validPassword = await bcrypt.compare(password, user.SenhaHash);
        console.log(" Senha válida?:", validPassword);

        if (!validPassword) {
            return res.status(400).json({
                status: "error",
                error: "Email ou senha incorretos",
            });
        }

        // Verificar se conta está desativada e permitir reativação se ainda não expirou
        if (user.Ativo === 0) {
            // Verificar se ainda está dentro do período de 20 dias
            let canReactivate = false;
            let expirationDate = null;

            try {
                // Verificar se DataDesativacao existe e não expirou
                const [deactivatedInfo] = await pool.query(
                    "SELECT DataDesativacao FROM Utilizadores WHERE ReferenciaID = ?",
                    [user.ReferenciaID]
                );

                if (deactivatedInfo.length > 0 && deactivatedInfo[0].DataDesativacao) {
                    expirationDate = new Date(deactivatedInfo[0].DataDesativacao);
                    const now = new Date();
                    canReactivate = expirationDate > now;
                } else {
                    // Se não tem DataDesativacao, usar DataRegisto como fallback (20 dias)
                    const registerDate = new Date(user.DataRegisto);
                    const expirationDateFallback = new Date(registerDate);
                    expirationDateFallback.setDate(expirationDateFallback.getDate() + 20);
                    canReactivate = expirationDateFallback > new Date();
                    expirationDate = expirationDateFallback;
                }
            } catch (error) {
                console.error("[AUTH] Erro ao verificar data de desativação:", error);
                // Em caso de erro, permitir tentativa de reativação
                canReactivate = true;
            }

            if (canReactivate) {
                // Reativar conta automaticamente ao fazer login
                await pool.query(
                    "UPDATE Utilizadores SET Ativo = 1, DataDesativacao = NULL WHERE ReferenciaID = ?",
                    [user.ReferenciaID]
                );
                console.log(`[AUTH] Conta ${user.ReferenciaID} reativada automaticamente via login`);

                // Marcar que a conta foi reativada para mostrar modal no frontend
                user.accountReactivated = true;
            } else {
                return res.status(403).json({
                    status: "error",
                    error: "Sua conta foi desativada há mais de 20 dias e foi permanentemente excluída. Entre em contato com o suporte.",
                    accountExpired: true
                });
            }
        }

        // Verificar se email está verificado
        if (!user.EmailVerificado) {
            return res.status(403).json({
                status: "error",
                error: "Email não verificado. Verifique seu email antes de fazer login.",
                needsVerification: true,
                email: user.Email
            });
        }

        // Se 2FA ativo, não devolver token; devolver tempToken para completar verificação
        const twoFA = await is2FAEnabled(user.ReferenciaID);
        if (twoFA) {
            const tempToken = gerarToken2FAPending(user.ReferenciaID, user.Email);
            return res.json({
                status: "ok",
                requires2FA: true,
                tempToken,
                user: {
                    ReferenciaID: user.ReferenciaID,
                    email: user.Email,
                    nome: user.Nome,
                    perfilId: user.PerfilId || user.perfilId
                }
            });
        }

        // IMPORTANTE: Verificar se o usuário é admin (PerfilId = 1) para acesso ao Painel Administrativo
        // Se a requisição vier do Painel Administrativo ou Admin PromoPing, apenas administradores podem fazer login
        // CARALHO, NÃO MEXA NESSA PARTE
        // Se tu fuder isso, qualquer zé ruela pode acessar o painel admin
        // E aí pode foder tudo: deletar usuários, mudar planos, ver dados sensíveis
        // PerfilId = 1 é ADMIN, qualquer outro número NÃO É ADMIN
        // NÃO MUDE ESSA LÓGICA SEM ENTENDER AS CONSEQUÊNCIAS
        const referer = req.headers['referer'] || '';
        const origin = req.headers['origin'] || '';
        const adminPanelHeader = req.headers['x-admin-panel'] || req.headers['X-Admin-Panel'] || '';

        const isAdminPanel = referer.includes('Painel_Administrativo') ||
            referer.includes('admin.promoping') ||
            origin.includes('Painel_Administrativo') ||
            origin.includes('admin.promoping') ||
            adminPanelHeader === 'true';

        if (isAdminPanel) {
            const perfilId = user.PerfilId || user.perfilId;
            // ESSA VERIFICAÇÃO AQUI É O QUE IMPEDE NÃO-ADMINS DE ACESSAR O PAINEL
            // Se tu mudar !== 1 pra outra coisa, pode dar acesso ou bloquear admins
            if (perfilId !== 1) {
                console.log(`[AUTH] Tentativa de login no Painel Administrativo negada: Usuário ${user.Email} não é admin (PerfilId=${perfilId})`);
                return res.status(403).json({
                    status: "error",
                    error: "Acesso negado. Apenas administradores podem acessar o painel administrativo.",
                    accessDenied: true
                });
            }
        }

        const { token, refreshToken } = gerarParesToken(user.ReferenciaID, user.Email);

        res.json({
            status: "ok",
            token,
            refreshToken,
            user: {
                ReferenciaID: user.ReferenciaID,
                email: user.Email,
                nome: user.Nome,
                perfilId: user.PerfilId || user.perfilId
            },
            accountReactivated: user.accountReactivated || false
        });
    } catch (err) {
        console.error(" Erro no login:", err);
        res.status(500).json({
            status: "error",
            error: err.message || "Erro interno no servidor",
        });
    }
});

// Completar login com código 2FA (após resposta requires2FA do login)
router.post("/2fa/verify", async (req, res) => {
    try {
        const { tempToken, code } = req.body;
        if (!tempToken || !code) {
            return res.status(400).json({ status: "error", error: "tempToken e code sao obrigatorios" });
        }
        const secret = process.env.JWT_SECRET;
        let decoded;
        try {
            decoded = jwt.verify(tempToken, secret);
        } catch (e) {
            return res.status(401).json({ status: "error", error: "Sessao expirada. Faca login novamente." });
        }
        if (decoded.type !== "2fa_pending") {
            return res.status(403).json({ status: "error", error: "Token invalido" });
        }
        const referenciaID = decoded.ReferenciaID;
        const email = decoded.email;
        await verifyCode(referenciaID, code);
        const [rows] = await pool.query(
            "SELECT ReferenciaID, Nome, Email, PerfilId FROM Utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );
        if (rows.length === 0) {
            return res.status(404).json({ status: "error", error: "Utilizador nao encontrado" });
        }
        const user = rows[0];
        const { token, refreshToken } = gerarParesToken(user.ReferenciaID, user.Email);
        res.json({
            status: "ok",
            token,
            refreshToken,
            user: {
                ReferenciaID: user.ReferenciaID,
                email: user.Email,
                nome: user.Nome,
                perfilId: user.PerfilId || user.perfilId
            }
        });
    } catch (err) {
        console.error("[AUTH] Erro 2FA verify:", err);
        res.status(400).json({ status: "error", error: err.message || "Codigo invalido" });
    }
});

// Enviar código 2FA por email (durante login, quando utilizador escolhe "enviar por email")
router.post("/2fa/send-email-code", async (req, res) => {
    try {
        const { tempToken } = req.body;
        if (!tempToken) {
            return res.status(400).json({ status: "error", error: "tempToken obrigatorio" });
        }
        const secret = process.env.JWT_SECRET;
        let decoded;
        try {
            decoded = jwt.verify(tempToken, secret);
        } catch (e) {
            return res.status(401).json({ status: "error", error: "Sessao expirada. Faca login novamente." });
        }
        if (decoded.type !== "2fa_pending") {
            return res.status(403).json({ status: "error", error: "Token invalido" });
        }
        await sendEmailCode(decoded.ReferenciaID);
        res.json({ status: "ok", sent: true });
    } catch (err) {
        console.error("[AUTH] Erro ao enviar codigo 2FA:", err);
        res.status(500).json({ status: "error", error: err.message });
    }
});

// Renovar token (refresh): troca sozinho quando o access token expira
router.post("/refresh", async (req, res) => {
    try {
        const { refreshToken: refToken } = req.body;
        if (!refToken) {
            return res.status(401).json({ error: "Refresh token não fornecido" });
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ error: "Configuração inválida" });
        }
        const decoded = jwt.verify(refToken, secret);
        if (decoded.type !== "refresh" || !decoded.ReferenciaID || !decoded.email) {
            return res.status(403).json({ error: "Refresh token inválido" });
        }
        const { token, refreshToken: newRefreshToken } = gerarParesToken(decoded.ReferenciaID, decoded.email);
        return res.json({ status: "ok", token, refreshToken: newRefreshToken });
    } catch (err) {
        if (err.name === "TokenExpiredError" || err.message === "jwt expired") {
            return res.status(401).json({ error: "Refresh token expirado", code: "REFRESH_EXPIRED" });
        }
        return res.status(403).json({ error: "Refresh token inválido" });
    }
});

// Código no QR muda a cada 30s; o telemóvel escaneia e confirma com o token do utilizador.

// POST /api/auth/qr-init — gera código QR (alternativa ao GET qr-session; devolve code + expiresAt)
router.post("/qr-init", async (req, res) => {
    try {
        const sessionId = req.body?.sessionId || null;
        const data = await getOrCreateSession(sessionId || undefined);
        if (data.confirmed) {
            return res.json({ sessionId: data.sessionId, status: "confirmed" });
        }
        const expiresAt = new Date(Date.now() + data.expiresIn * 1000).toISOString();
        return res.json({
            sessionId: data.sessionId,
            code: data.code,
            expiresAt,
        });
    } catch (err) {
        console.error("[QR-INIT] Erro:", err);
        return res.status(500).json({ error: "Erro ao gerar sessão QR" });
    }
});

// GET /api/auth/qr-session — obtém sessionId + código atual (e imagem QR em data URL)
router.get("/qr-session", async (req, res) => {
    try {
        const sessionId = req.query.sessionId || null;
        const data = await getOrCreateSession(sessionId || undefined);
        if (data.confirmed) {
            return res.json({ sessionId: data.sessionId, status: "confirmed" });
        }
        const qrDataUrl = await QRCode.toDataURL(data.code, {
            width: 280,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
        });
        return res.json({
            sessionId: data.sessionId,
            code: data.code,
            expiresIn: data.expiresIn,
            qrImageDataUrl: qrDataUrl,
        });
    } catch (err) {
        console.error("[QR-SESSION] Erro:", err);
        return res.status(500).json({ error: "Erro ao gerar sessão QR" });
    }
});

// GET /api/auth/qr-session/poll — polling para ver se o telemóvel confirmou
router.get("/qr-session/poll", async (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        return res.status(400).json({ error: "sessionId obrigatório" });
    }
    const status = await getSessionStatus(sessionId);
    return res.json(status);
});

// POST /api/auth/qr-confirm — telemóvel envia o código escaneado + Bearer token do utilizador
router.post("/qr-confirm", verifyToken, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code || typeof code !== "string") {
            return res.status(400).json({ error: "Código é obrigatório" });
        }
        const user = { ReferenciaID: req.user.ReferenciaID, email: req.user.email };
        const tokens = gerarParesToken(user.ReferenciaID, user.email);
        const result = await confirmSession(code.trim(), user, tokens);
        if (!result.ok) {
            if (result.code === "already_used") {
                return res.status(409).json({ error: result.error });
            }
            return res.status(400).json({ error: result.error });
        }
        return res.json({
            status: "ok",
            message: "Login no browser será concluído em instantes.",
            token: tokens.token,
            refreshToken: tokens.refreshToken,
        });
    } catch (err) {
        console.error("[QR-CONFIRM] Erro:", err);
        return res.status(500).json({ error: "Erro ao confirmar código" });
    }
});

// REGISTO com email e senha
router.post("/register", async (req, res) => {
    try {
        const {
            nome,
            email,
            password,
            telefone,
            data_nascimento,
            oauthProvider,
            oauthId,
            fotoPerfil
        } = req.body;
        console.log("[REGISTRO] Tentativa de registro:", {
            nome,
            email,
            telefone: telefone ? "fornecido" : "não fornecido",
            data_nascimento: data_nascimento ? "fornecido" : "não fornecido"
        });

        if (!nome || !email || !password || !data_nascimento) {
            console.log("[REGISTRO] Campos obrigatórios faltando");
            return res.status(400).json({
                status: "error",
                error: "Nome, email, senha e data de nascimento são obrigatórios",
            });
        }

        if (password.length < 6) {
            console.log("[REGISTRO] Senha muito curta");
            return res.status(400).json({
                status: "error",
                error: "A senha deve ter pelo menos 6 caracteres",
            });
        }

        // Validar idade mínima (13 anos) - obrigatório
        const birthDate = new Date(data_nascimento);

        // Verificar se a data é válida
        if (isNaN(birthDate.getTime())) {
            console.log("[REGISTRO] Data de nascimento inválida");
            return res.status(400).json({
                status: "error",
                error: "Data de nascimento inválida",
            });
        }

        // Verificar se a data não é no futuro
        const today = new Date();
        if (birthDate > today) {
            console.log("[REGISTRO] Data de nascimento no futuro");
            return res.status(400).json({
                status: "error",
                error: "Data de nascimento não pode ser no futuro",
            });
        }

        // Calcular idade
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        // Validar idade mínima de 13 anos
        if (age < 13) {
            console.log(`[REGISTRO] Usuário menor de 13 anos tentou se registrar (idade: ${age})`);
            return res.status(403).json({
                status: "error",
                error: "É necessário ter pelo menos 13 anos para criar uma conta no PromoPing",
            });
        }

        console.log(`[REGISTRO] Idade validada: ${age} anos`);

        console.log("[REGISTRO] Verificando se email já existe...");
        const [existing] = await pool.query(
            "SELECT ReferenciaID FROM Utilizadores WHERE Email = ?",
            [email]
        );

        if (existing.length > 0) {
            console.log("[REGISTRO] Email já em uso");
            return res.status(400).json({
                status: "error",
                error: "Email já está em uso",
            });
        }

        console.log("[REGISTRO] Gerando hash da senha...");
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Determinar PerfilId: se não existe admin (PerfilId=1), o primeiro registro vira admin; caso contrário, padrão user (2)
        console.log("[REGISTRO] Verificando perfil do usuário...");
        const [adminCountRows] = await pool.query(
            "SELECT COUNT(*) as total FROM Utilizadores WHERE PerfilId = 1"
        );
        const perfilId = (adminCountRows[0] ?.total || 0) === 0 ? 1 : 2;
        console.log(`[REGISTRO] PerfilId determinado: ${perfilId}`);

        console.log("[REGISTRO] Gerando ReferenciaID...");
        const referenciaID = gerarReferenciaID();
        console.log(`[REGISTRO] ReferenciaID gerado: ${referenciaID}`);

        console.log("[REGISTRO] Inserindo usuário na tabela Utilizadores...");

        // Tentar inserir com data_nascimento e/ou google_id se fornecidos
        let result;
        try {
            // Construir query dinamicamente baseado nos campos disponíveis
            const fields = ['ReferenciaID', 'Nome', 'Email', 'SenhaHash', 'EmailVerificado', 'Telefone', 'PerfilId', 'Ativo', 'DataRegisto'];
            const values = [referenciaID, nome, email, hashedPassword, 0, telefone || null, perfilId, 1];
            const placeholders = ['?', '?', '?', '?', '?', '?', '?', '?', 'NOW()'];
            
            // Adicionar campos opcionais
            if (data_nascimento) {
                fields.push('DataNascimento');
                values.push(data_nascimento);
                placeholders.push('?');
            }
            
            if (oauthProvider === 'google' && oauthId) {
                fields.push('google_id');
                values.push(oauthId);
                placeholders.push('?');
                console.log("[REGISTRO] Incluindo google_id no registro:", oauthId);
            }
            
            if (fotoPerfil) {
                fields.push('FotoPerfil');
                values.push(fotoPerfil);
                placeholders.push('?');
            }
            
            const query = `INSERT INTO Utilizadores (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
            const [insertResult] = await pool.query(query, values);
            result = insertResult;
            console.log(`[REGISTRO] Usuário criado com campos: ${fields.join(', ')}`);
        } catch (insertError) {
            // Se algum campo não existir, tentar inserir sem ele
            console.log("[REGISTRO] Erro ao inserir, tentando sem campos opcionais:", insertError.message);
            
            // Tentar inserir apenas com campos básicos
            try {
                const [insertResult] = await pool.query(
                    "INSERT INTO Utilizadores (ReferenciaID, Nome, Email, SenhaHash, EmailVerificado, Telefone, PerfilId, Ativo, DataRegisto) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())",
                    [referenciaID, nome, email, hashedPassword, 0, telefone || null, perfilId]
                );
                result = insertResult;
                
                // Tentar atualizar google_id separadamente se disponível
                if (oauthProvider === 'google' && oauthId) {
                    try {
                        await pool.query(
                            "UPDATE Utilizadores SET google_id = ? WHERE ReferenciaID = ?",
                            [oauthId, referenciaID]
                        );
                        console.log("[REGISTRO] google_id atualizado após criação:", oauthId);
                    } catch (googleIdErr) {
                        console.log("[REGISTRO] Campo google_id não existe, ignorando");
                    }
                }
                
                // Tentar atualizar FotoPerfil separadamente se disponível
                if (fotoPerfil) {
                    try {
                        await pool.query(
                            "UPDATE Utilizadores SET FotoPerfil = ? WHERE ReferenciaID = ?",
                            [fotoPerfil, referenciaID]
                        );
                        console.log("[REGISTRO] FotoPerfil atualizado após criação");
                    } catch (fotoErr) {
                        console.log("[REGISTRO] Campo FotoPerfil não existe, ignorando");
                    }
                }
            } catch (retryError) {
                throw retryError;
            }
        }

        console.log(`[REGISTRO] Usuário criado com ReferenciaID: ${referenciaID}`);

        // Buscar ID do plano FREE
        console.log("[REGISTRO] Buscando plano FREE...");
        const [planoFree] = await pool.query(
            "SELECT Id FROM planos WHERE Nome = 'Free' LIMIT 1"
        );

        const planoFreeId = planoFree.length > 0 ? planoFree[0].Id : 1; // Fallback para ID 1
        console.log(`[REGISTRO] Plano FREE ID: ${planoFreeId}`);

        // Criar configuração do usuário
        console.log("[REGISTRO] Criando configuração do usuário...");
        try {
            // Verificar se já existe configuração para este usuário
            const [existingConfig] = await pool.query(
                "SELECT Id FROM configutilizador WHERE ReferenciaID = ?",
                [referenciaID]
            );

            if (existingConfig.length > 0) {
                // Atualizar configuração existente
                console.log("[REGISTRO] Configuração já existe, atualizando...");
                await pool.query(
                    "UPDATE configutilizador SET CanalPreferido = ?, PlanoAtualId = ? WHERE ReferenciaID = ?",
                    ["email", planoFreeId, referenciaID]
                );
                console.log("[REGISTRO] Configuração do usuário atualizada");
            } else {
                // Inserir nova configuração
                console.log("[REGISTRO] Inserindo nova configuração...");
                await pool.query(
                    "INSERT INTO configutilizador (ReferenciaID, CanalPreferido, PlanoAtualId) VALUES (?, ?, ?)",
                    [referenciaID, "email", planoFreeId]
                );
                console.log("[REGISTRO] Configuração do usuário criada");
            }
        } catch (configError) {
            console.error("[REGISTRO] Erro ao criar configuração do usuário:", configError.message);
            console.error("[REGISTRO] Código SQL:", configError.code);
            console.error("[REGISTRO] SQL State:", configError.sqlState);
            console.error("[REGISTRO] Stack trace:", configError.stack);
            // Não falhar o registro se a configuração falhar - pode ser criada depois
        }

        console.log(`[REGISTRO] Usuário ${nome} registrado com plano FREE (ID: ${planoFreeId})`);

        console.log("[REGISTRO] Gerando código de verificação...");
        const codigo = gerarCodigo();
        console.log(`[REGISTRO] Código gerado: ${codigo}`);

        console.log("[REGISTRO] Salvando código no banco de dados...");
        await pool.query("UPDATE Utilizadores SET CodigoEmail=? WHERE ReferenciaID=?", [
            codigo,
            referenciaID,
        ]);
        console.log("[REGISTRO] Código salvo no banco de dados");

        // Responder IMEDIATAMENTE ao cliente (antes de enviar email)
        console.log("[REGISTRO] Enviando resposta ao cliente IMEDIATAMENTE...");
        res.json({
            status: "ok",
            message: "Conta criada com sucesso! Verifique seu email para ativar a conta.",
            codigo: codigo // Para desenvolvimento - remover em produção
        });
        console.log(" [REGISTRO] Resposta enviada ao cliente");

        // Enviar código por email EM BACKGROUND (não bloqueia a resposta)
        console.log("[REGISTRO] Agendando envio de email em background...");
        (async () => {
            try {
                console.log(`[REGISTRO] Destinatário: ${email}`);
                console.log(`[REGISTRO] EMAIL_USER configurado: ${process.env.EMAIL_USER ? `Sim (${process.env.EMAIL_USER})` : 'NAO'}`);
                console.log(`[REGISTRO] EMAIL_PASS configurado: ${process.env.EMAIL_PASS ? 'Sim (***)' : 'NAO'}`);
                console.log(`[REGISTRO] EMAIL_HOST configurado: ${process.env.EMAIL_HOST || 'Não configurado'}`);
                console.log(`[REGISTRO] EMAIL_PORT configurado: ${process.env.EMAIL_PORT || 'Não configurado'}`);

                const {
                    sendEmail
                } = await import("../services/notify.js");
                console.log("[REGISTRO] Função sendEmail importada com sucesso");

                const messageHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
          <h2 style="color: #ff6b35; text-align: center;">Verificação de Conta</h2>
          <p>Olá <b>${nome}</b>,</p>
          <p>Obrigado por se registrar no <b>PromoPing</b>!</p>
          <p>Use o código abaixo para verificar sua conta:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px solid #ff6b35;">
            <h1 style="color: #ff6b35; font-size: 2.5em; margin: 0; letter-spacing: 5px;">${codigo}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">Este código expira em 10 minutos.</p>
          <p style="color: #666; font-size: 14px;">Se não foi você, ignore este e-mail.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} PromoPing - Todos os direitos reservados</p>
        </div>
      `;

                console.log(`[REGISTRO] Tentando enviar email para: ${email}`);
                console.log(`[REGISTRO] Código a ser enviado: ${codigo}`);

                await sendEmail(email, "PromoPing - Verificação de conta", messageHtml);

                console.log(`[REGISTRO] Email enviado com SUCESSO para ${email}`);
                console.log(`[REGISTRO] Código de verificação: ${codigo}`);
            } catch (emailError) {
                console.error("[REGISTRO] ========== ERRO AO ENVIAR EMAIL ==========");
                console.error("[REGISTRO] Tipo do erro:", emailError.name);
                console.error("[REGISTRO] Mensagem:", emailError.message);
                console.error("[REGISTRO] Código:", emailError.code);
                if (emailError.response) {
                    console.error("[REGISTRO] Resposta do servidor:", emailError.response);
                }
                if (emailError.command) {
                    console.error("[REGISTRO] Comando:", emailError.command);
                }
                console.error("[REGISTRO] Stack trace completo:");
                console.error(emailError.stack);
                console.error("[REGISTRO] ==========================================");

                // Não falhar o registro se o email falhar, mas logar o erro detalhadamente
                console.log("[REGISTRO] Conta criada com sucesso, mas email não foi enviado.");
                console.log("[REGISTRO] Para desenvolvimento, use o código exibido no console ou configure EMAIL_USER e EMAIL_PASS no .env");
                console.log(`[REGISTRO] Código de verificação para ${email}: ${codigo}`);
            }
        })();

        // Atualizar métricas em background
        console.log("[REGISTRO] Agendando atualização de métricas em background...");
        atualizarMetricasAutomaticamente().catch(metricError => {
            console.error("[REGISTRO] Erro ao atualizar métricas após criação de utilizador:", metricError.message);
            console.error("[REGISTRO] Stack trace das métricas:", metricError.stack);
        });

        console.log("[REGISTRO] Registro concluído com sucesso!");
    } catch (err) {
        console.error(" [REGISTRO] ERRO CRÍTICO no registro:", err);
        console.error(" [REGISTRO] Mensagem de erro:", err.message);
        console.error(" [REGISTRO] Stack trace completo:", err.stack);

        res.status(500).json({
            status: "error",
            error: err.message || "Erro interno no servidor",
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// rotas do google
router.get("/google", (req, res) => {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        console.log(" Google OAuth configurado:");
        console.log("   Client ID:", process.env.GOOGLE_CLIENT_ID.substring(0, 20) + "...");
        console.log("   Client Secret:", process.env.GOOGLE_CLIENT_SECRET.substring(0, 10) + "...");
        passport.authenticate("google", {
            scope: ["profile", "email", "https://www.googleapis.com/auth/calendar.readonly"]
        })(req, res);
    } else {
        console.error(" Google OAuth não configurado:");
        console.log("   GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "Presente" : "Ausente");
        console.log("   GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "Presente" : "Ausente");
        res.status(400).json({
            error: "Google OAuth não configurado. Configure as credenciais no ficheiro .env",
        });
    }
});

router.get("/google/callback", (req, res) => {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        const loginUrl = process.env.LOGIN_URL || "/inc/Login.html";
        console.log("[GOOGLE CALLBACK] Iniciando callback do Google OAuth");
        console.log("[GOOGLE CALLBACK] Query params:", JSON.stringify(req.query));
        
        passport.authenticate("google", {
            session: false, // Não usar sessões para OAuth
            failureRedirect: loginUrl
        })(req, res, async (err, googleUser) => {
            // Função auxiliar para salvar dados OAuth em cookie quando houver erro
            const saveOAuthData = (oauthData) => {
                const dataString = JSON.stringify(oauthData);
                res.cookie('oauth_temp_data', dataString, {
                    httpOnly: false, // Precisa ser acessível via JavaScript
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 15 * 60 * 1000 // 15 minutos
                });
                console.log("[GOOGLE CALLBACK] Dados OAuth salvos temporariamente:", oauthData);
            };

            if (err) {
                console.error("[GOOGLE CALLBACK] Erro na autenticação Google:", err);
                console.error("[GOOGLE CALLBACK] Stack trace:", err.stack);
                const errorDetails = err.message || 'Erro desconhecido';
                
                // Tentar obter dados do profile mesmo com erro (se disponível)
                // Isso pode não funcionar se o erro ocorrer antes do profile ser retornado
                return res.redirect(`${loginUrl}?error=auth_failed&details=${encodeURIComponent(errorDetails)}`);
            }

            // Tentar obter o usuário de várias fontes (sem sessões)
            let user = googleUser || req.user;
            
            console.log("[GOOGLE CALLBACK] googleUser:", googleUser ? JSON.stringify(googleUser, null, 2) : "undefined");
            console.log("[GOOGLE CALLBACK] req.user:", req.user ? JSON.stringify(req.user, null, 2) : "undefined");
            
            if (!user) {
                console.error("[GOOGLE CALLBACK] Usuário está undefined após autenticação");
                return res.redirect(`${loginUrl}?error=user_undefined`);
            }

            // Verificar se user tem os campos necessários
            if (!user.ReferenciaID || !user.email) {
                console.error("[GOOGLE CALLBACK] user não tem campos necessários:", {
                    hasReferenciaID: !!user.ReferenciaID,
                    hasEmail: !!user.email,
                    user: user
                });
                
                // Salvar dados OAuth disponíveis para permitir completar registro/login
                const oauthData = {
                    provider: 'google',
                    email: user.email || null,
                    nome: user.nome || user.name || null,
                    fotoPerfil: user.fotoPerfil || null,
                    googleId: user.googleId || null,
                    timestamp: Date.now()
                };
                
                if (oauthData.email) {
                    saveOAuthData(oauthData);
                    return res.redirect(`/index.html?oauth_data=google&action=complete`);
                }
                
                return res.redirect(`${loginUrl}?error=user_incomplete&details=${encodeURIComponent('Dados do usuário incompletos')}`);
            }

            try {
                // Garantir que google_id está salvo no banco
                if (user.googleId) {
                    try {
                        await pool.query(
                            "UPDATE Utilizadores SET google_id = ? WHERE ReferenciaID = ?",
                            [user.googleId, user.ReferenciaID]
                        );
                        console.log("[GOOGLE CALLBACK] google_id salvo no banco:", user.googleId);
                    } catch (dbError) {
                        console.log("[GOOGLE CALLBACK] Erro ao salvar google_id (coluna pode não existir):", dbError.message);
                        // Continuar mesmo se falhar - não é crítico
                    }
                }

                // Salvar tokens OAuth se disponíveis
                if (user.accessToken) {
                    try {
                        await pool.query(`
                            CREATE TABLE IF NOT EXISTS google_oauth_tokens (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                ReferenciaID VARCHAR(13) NOT NULL,
                                access_token TEXT NOT NULL,
                                refresh_token TEXT,
                                token_type VARCHAR(50) DEFAULT 'Bearer',
                                expires_at TIMESTAMP NULL,
                                scope TEXT,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                                INDEX idx_ReferenciaID (ReferenciaID),
                                INDEX idx_expires_at (expires_at),
                                FOREIGN KEY (ReferenciaID) REFERENCES Utilizadores(ReferenciaID) ON DELETE CASCADE,
                                UNIQUE KEY unique_user_token (ReferenciaID)
                            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                        `);

                        const expiresAt = new Date();
                        expiresAt.setHours(expiresAt.getHours() + 1);

                        await pool.query(
                            `INSERT INTO google_oauth_tokens (ReferenciaID, access_token, refresh_token, expires_at, scope)
                             VALUES (?, ?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE 
                                 access_token = VALUES(access_token),
                                 refresh_token = VALUES(refresh_token),
                                 expires_at = VALUES(expires_at),
                                 scope = VALUES(scope),
                                 updated_at = NOW()`,
                            [user.ReferenciaID, user.accessToken, user.refreshToken || null, expiresAt, 'calendar.readonly']
                        );
                        console.log("[GOOGLE CALLBACK] Tokens OAuth salvos para sincronização");
                    } catch (tokenErr) {
                        console.error("[GOOGLE CALLBACK] Erro ao salvar tokens OAuth:", tokenErr);
                        // Não falhar o login se não conseguir salvar tokens
                    }
                }

                const { token, refreshToken } = gerarParesToken(user.ReferenciaID, user.email);

                console.log("[GOOGLE CALLBACK] Token JWT gerado com sucesso para usuário:", user.ReferenciaID);

                const escapedEmail = (user.email || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
                const escapedNome = (user.nome || user.name || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
                
                const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Login - PromoPing</title>
        </head>
        <body>
          <script>
            localStorage.setItem('PROMOPING_TOKEN', '${token}');
            localStorage.setItem('PROMOPING_REFRESH_TOKEN', '${refreshToken}');
            localStorage.setItem('token', '${token}');
            localStorage.setItem('user', JSON.stringify({
              ReferenciaID: '${user.ReferenciaID}',
              email: '${escapedEmail}',
              nome: '${escapedNome}',
              loginMethod: 'google'
            }));
            window.location.href = '/dashboard';
          </script>
          <p>Redirecionando para o painel...</p>
        </body>
        </html>
      `;
                
                console.log("Redirecionando para dashboard via HTML");
                res.send(html);
            } catch (tokenError) {
                console.error("Erro ao gerar token:", tokenError);
                console.error("Stack trace:", tokenError.stack);
                
                // Salvar dados OAuth antes de redirecionar com erro
                const oauthData = {
                    provider: 'google',
                    email: user.email || null,
                    nome: user.nome || user.name || null,
                    fotoPerfil: user.fotoPerfil || null,
                    googleId: user.googleId || null,
                    timestamp: Date.now()
                };
                
                if (oauthData.email) {
                    saveOAuthData(oauthData);
                    const errorDetails = tokenError.message || 'Erro ao gerar token';
                    return res.redirect(`/index.html?oauth_data=google&action=complete&error=token_error&details=${encodeURIComponent(errorDetails)}`);
                }
                
                const errorDetails = tokenError.message || 'Erro ao gerar token';
                res.redirect(`${loginUrl}?error=token_error&details=${encodeURIComponent(errorDetails)}`);
            }
        });
    } else {
        console.error("Google OAuth não configurado");
        res.status(400).json({
            error: "Google OAuth não configurado. Configure as credenciais no ficheiro .env",
        });
    }
});

//rotas onde é usado o github
router.get("/github", (req, res) => {
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
        console.log(" GitHub OAuth configurado:");
        console.log("   Client ID:", process.env.GITHUB_CLIENT_ID.substring(0, 20) + "...");
        console.log("   Client Secret:", process.env.GITHUB_CLIENT_SECRET.substring(0, 10) + "...");
        passport.authenticate("github", {
            scope: ["user:email"]
        })(req, res);
    } else {
        console.error(" GitHub OAuth não configurado:");
        console.log("   GITHUB_CLIENT_ID:", process.env.GITHUB_CLIENT_ID ? "Presente" : "Ausente");
        console.log("   GITHUB_CLIENT_SECRET:", process.env.GITHUB_CLIENT_SECRET ? "Presente" : "Ausente");
        res.status(400).json({
            error: "GitHub OAuth não configurado. Configure as credenciais no ficheiro .env",
        });
    }
});

router.get("/github/callback", (req, res) => {
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
        const loginUrl = process.env.LOGIN_URL || "/login";
        passport.authenticate("github", {
            failureRedirect: loginUrl
        })(req, res, (err) => {
            if (err) {
                console.error("Erro na autenticação GitHub:", err);
                return res.redirect(`${loginUrl}?error=auth_failed`);
            }

            if (!req.user) {
                console.error("req.user está undefined");
                return res.redirect(`${loginUrl}?error=user_undefined`);
            }

            try {
                const { token, refreshToken } = gerarParesToken(req.user.ReferenciaID, req.user.email);

                const panelUrl = process.env.AFTER_LOGIN_REDIRECT || "/dashboard";
                const signUpUrl = process.env.AFTER_SIGNUP_REDIRECT || "/dashboard";
                const fromSignUp = req.query.from === 'signup';
                const redirectUrl = fromSignUp ? signUpUrl : panelUrl;

                res.redirect(`${redirectUrl}?token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}`);
            } catch (tokenError) {
                console.error("Erro ao gerar token:", tokenError);
                res.redirect(`${loginUrl}?error=token_error`);
            }
        });
    } else {
        res.status(400).json({
            error: "GitHub OAuth não configurado. Configure as credenciais no ficheiro .env",
        });
    }
});


router.get("/discord", (req, res) => {
    if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
        // Armazenar parâmetros na sessão (se disponível) ou usar cookies como fallback
        if (req.query.from === 'profile' && req.query.token) {
            // Armazenar token temporariamente em cookie seguro
            res.cookie('discord_connect_token', req.query.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 5 * 60 * 1000 // 5 minutos
            });
            res.cookie('discord_connect_from', 'profile', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 5 * 60 * 1000 // 5 minutos
            });
        }
        
        passport.authenticate("discord", {
            session: false,
            scope: ['identify', 'email']
        })(req, res);
    } else {
        res.status(400).json({
            error: "Discord OAuth não configurado. Configure as credenciais no ficheiro .env",
        });
    }
});

router.get("/discord/callback", async (req, res) => {
    console.log(" Discord callback recebido:", JSON.stringify(req.query));
    
    // Verificar se há erro do Discord
    if (req.query.error) {
        console.error(" Erro retornado pelo Discord:", req.query.error);
        console.error(" Descrição do erro:", req.query.error_description);
        const fromProfile = req.query.state && req.query.state.includes('from=profile');
        const redirectUrl = fromProfile ? '/dashboard/perfil?error=discord_connection_failed' : `/login?error=discord_${req.query.error}&description=${encodeURIComponent(req.query.error_description || '')}`;
        return res.redirect(redirectUrl);
    }

    if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
        // Usar uma abordagem diferente: fazer authenticate primeiro, depois processar
        passport.authenticate("discord", {
            session: false
        })(req, res, async (err, discordUser) => {
            console.log(" [DISCORD CALLBACK] ========== INÍCIO DO CALLBACK ==========");
            console.log(" [DISCORD CALLBACK] Erro recebido:", err ? err.message : "Nenhum erro");
            console.log(" [DISCORD CALLBACK] DiscordUser recebido do passport:", discordUser ? JSON.stringify(discordUser, null, 2) : "null/undefined");
            console.log(" [DISCORD CALLBACK] Query params:", JSON.stringify(req.query));
            console.log(" [DISCORD CALLBACK] State:", req.query.state);
            console.log(" [DISCORD CALLBACK] req.user:", req.user ? JSON.stringify(req.user, null, 2) : "null/undefined");
            console.log(" [DISCORD CALLBACK] req.isAuthenticated:", req.isAuthenticated ? req.isAuthenticated() : "método não disponível");
            
            if (err) {
                console.error(" [DISCORD CALLBACK] ERRO na autenticação Discord:", err);
                console.error(" [DISCORD CALLBACK] Stack trace:", err.stack);
                
                // Determinar tipo de erro específico
                let errorType = "discord_auth_failed";
                if (err.message && err.message.includes("email")) {
                    errorType = "discord_email_required";
                } else if (err.message && err.message.includes("redirect")) {
                    errorType = "discord_redirect_invalid";
                }
                
                const fromProfile = req.query.state && req.query.state.includes('from=profile');
                const redirectUrl = fromProfile ? `/dashboard/perfil?error=${errorType}` : `/login?error=${errorType}&details=${encodeURIComponent(err.message || 'Erro desconhecido')}`;
                return res.redirect(redirectUrl);
            }

            // Tentar obter o usuário de várias fontes
            if (!discordUser) {
                console.log(" [DISCORD CALLBACK] discordUser é null, tentando req.user...");
                discordUser = req.user;
            }
            
            if (!discordUser) {
                console.error(" [DISCORD CALLBACK] ERRO CRÍTICO: discordUser é null/undefined após todas as tentativas");
                console.error(" [DISCORD CALLBACK] Query params completos:", JSON.stringify(req.query));
                console.error(" [DISCORD CALLBACK] req.user:", req.user);
                console.error(" [DISCORD CALLBACK] req.session:", req.session);
                console.error(" [DISCORD CALLBACK] Verificando se a estratégia foi executada...");
                
                // Se chegou aqui, a estratégia pode não ter sido executada ou não chamou done()
                const fromProfile = req.query.state && req.query.state.includes('from=profile');
                const redirectUrl = fromProfile ? '/dashboard/perfil?error=discord_user_not_found' : '/login?error=discord_user_not_found';
                return res.redirect(redirectUrl);
            }

            console.log(" [DISCORD CALLBACK] Usuário Discord autenticado com sucesso!");
            console.log(" [DISCORD CALLBACK] Email:", discordUser.email);
            console.log(" [DISCORD CALLBACK] ReferenciaID:", discordUser.ReferenciaID);
            console.log(" [DISCORD CALLBACK] DiscordId:", discordUser.discordId);

            // Verificar se veio do perfil (usuário já logado querendo conectar)
            // Tentar obter dos cookies primeiro, depois do state
            const tokenFromCookie = req.cookies?.discord_connect_token;
            const fromProfileCookie = req.cookies?.discord_connect_from === 'profile';
            const fromProfileState = req.query.state && req.query.state.includes('from=profile');
            const tokenFromState = req.query.state ? new URLSearchParams(req.query.state).get('token') : null;
            
            const fromProfile = fromProfileCookie || fromProfileState;
            const tokenFromProfile = tokenFromCookie || tokenFromState;
            
            console.log(" [DISCORD CALLBACK] From profile (cookie):", fromProfileCookie);
            console.log(" [DISCORD CALLBACK] From profile (state):", fromProfileState);
            console.log(" [DISCORD CALLBACK] Token from cookie:", tokenFromCookie ? "Presente" : "Ausente");
            console.log(" [DISCORD CALLBACK] Token from state:", tokenFromState ? "Presente" : "Ausente");

            if (fromProfile && tokenFromProfile) {
                try {
                    // Limpar cookies após uso
                    res.clearCookie('discord_connect_token');
                    res.clearCookie('discord_connect_from');
                    
                    // Verificar token JWT do usuário logado
                    const decoded = jwt.verify(tokenFromProfile, process.env.JWT_SECRET);
                    const loggedInReferenciaID = decoded.ReferenciaID;
                    
                    console.log(` Associando Discord ao usuário logado: ${loggedInReferenciaID}`);

                    // Obter discordId do objeto retornado pela estratégia (agora incluído)
                    const discordIdToLink = discordUser.discordId;
                    
                    if (!discordIdToLink) {
                        console.error(" Discord ID não encontrado no objeto de autenticação");
                        throw new Error("Não foi possível obter o ID do Discord");
                    }

                    // Verificar se o Discord já está associado a outro usuário
                    const existingDiscordUser = findDiscordUser(discordIdToLink);
                    
                    if (existingDiscordUser && existingDiscordUser.ReferenciaID && existingDiscordUser.ReferenciaID !== loggedInReferenciaID) {
                        // Discord já está associado a outro usuário
                        const html = `
                            <!DOCTYPE html>
                            <html>
                            <head>
                              <title>Discord Conectado - PromoPing</title>
                            </head>
                            <body>
                              <script>
                                alert('Esta conta Discord já está associada a outra conta.');
                                window.location.href = '/dashboard/perfil';
                              </script>
                              <p>Redirecionando...</p>
                            </body>
                            </html>
                          `;
                        return res.send(html);
                    }

                    // Associar Discord ao usuário logado
                    linkDiscordUser(discordIdToLink, loggedInReferenciaID);
                    
                    // Atualizar discord_id no banco: desvincular de outras contas (trocar conta) e vincular a esta
                    try {
                        await pool.query(
                            "UPDATE utilizadores SET discord_id = NULL WHERE discord_id = ? AND ReferenciaID != ?",
                            [discordIdToLink, loggedInReferenciaID]
                        );
                        await pool.query(
                            "UPDATE utilizadores SET discord_id = ? WHERE ReferenciaID = ?",
                            [discordIdToLink, loggedInReferenciaID]
                        );
                    } catch (dbError) {
                        console.error(" [DISCORD CALLBACK] Erro ao atualizar discord_id (coluna pode não existir):", dbError.message);
                        // Continuar mesmo se falhar - o linkDiscordUser já foi feito
                    }

                    // Inserir ou atualizar na tabela contasconectadas
                    try {
                        await pool.query(
                            "INSERT INTO contasconectadas (ReferenciaID, Tipo, Conectado, DataConexao) VALUES (?, 'discord', 1, NOW()) ON DUPLICATE KEY UPDATE Conectado = 1, DataConexao = NOW()",
                            [loggedInReferenciaID]
                        );
                        console.log(" [DISCORD CALLBACK] Discord inserido/atualizado em contasconectadas");
                    } catch (contasError) {
                        console.error(" [DISCORD CALLBACK] Erro ao inserir em contasconectadas:", contasError.message);
                        // Continuar mesmo se falhar
                    }

                    console.log(` Discord ${discordIdToLink} associado ao usuário ${loggedInReferenciaID}`);

                    // Redirecionar de volta ao perfil
                    const html = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <title>Discord Conectado - PromoPing</title>
                        </head>
                        <body>
                          <script>
                            // Manter o token existente
                            localStorage.setItem('token', '${tokenFromProfile}');
                            
                            // Redirecionar para o perfil
                            window.location.href = '/dashboard/perfil?discord_connected=true';
                          </script>
                          <p>Conectando Discord ao seu perfil...</p>
                        </body>
                        </html>
                      `;
                    return res.send(html);
                } catch (tokenError) {
                    console.error(" Erro ao verificar token ou associar Discord:", tokenError);
                    // Se falhar, fazer login normal
                }
            }

            // Login normal (não veio do perfil ou token inválido)
            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Discord Login - PromoPing</title>
        </head>
        <body>
          <script>
            // Salvar dados do usuário no localStorage
            localStorage.setItem('user', JSON.stringify({
              ReferenciaID: '${discordUser.ReferenciaID}',
              email: '${discordUser.email}',
              token: '${discordUser.token}',
              loginMethod: 'discord'
            }));
            
            // Salvar token separadamente para compatibilidade com auth.js
            localStorage.setItem('token', '${discordUser.token}');
            
            // Redirecionar para o painel
            window.location.href = '/dashboard';
          </script>
          <p>Redirecionando para o painel...</p>
        </body>
        </html>
      `;

            res.send(html);
        });
    } else {
        console.error(" Discord OAuth não configurado");
        res.status(400).json({
            error: "Discord OAuth não configurado. Configure as credenciais no ficheiro .env",
        });
    }
});


// ===== ROTA DE VERIFICAÇÃO DE TELEFONE REMOVIDA =====
// WhatsApp foi removido do sistema - apenas Email e Discord disponíveis
// Se precisar verificar telefone, use a rota de verificação de email

// Verificar email - enviar código por email
router.post("/verificar/email", verifyToken, async (req, res) => {
    try {
        const referenciaID = req.user.ReferenciaID;
        const codigo = gerarCodigo();

        // Buscar email do usuário
        const [userRows] = await pool.query(
            "SELECT Email, Nome FROM Utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                status: "error",
                error: "Usuário não encontrado",
            });
        }

        const user = userRows[0];

        // Salvar código no banco
        await pool.query(
            "UPDATE Utilizadores SET CodigoEmail = ? WHERE ReferenciaID = ?",
            [codigo, referenciaID]
        );

        // Enviar email
        try {
            const {
                sendEmail
            } = await import("../services/notify.js");
            const messageHtml = `
        <h2> Verificação de Conta</h2>
        <p>Olá <b>${user.Nome}</b> ,</p>
        <p>Use o código abaixo para verificar sua conta:</p>
        <h1 style="color: #ff6b35; font-size: 2em; text-align: center; margin: 20px 0;">${codigo}</h1>
        <p>Este código expira em 10 minutos.</p>
        <p>Se não foi você, ignore este e-mail.</p>
        <hr>
        <p style="color: #666; font-size: 0.9em;">&copy; ${new Date().getFullYear()} PromoPing</p>
      `;

            await sendEmail(user.Email, "PromoPing - Verificação de conta", messageHtml);
            console.log(` Código de verificação enviado para ${user.Email}: ${codigo}`);
        } catch (emailError) {
            console.log(" Email não configurado, mas código salvo:", codigo);
        }

        res.json({
            status: "ok",
            message: "Código enviado por email!",
        });
    } catch (err) {
        console.error(" Erro ao enviar código por email:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao enviar código de verificação",
        });
    }
});

// Validar código de verificação
router.post("/verificar/validar", verifyToken, async (req, res) => {
    try {
        const {
            codigo,
            tipo
        } = req.body; // tipo: 'email' ou 'telefone'
        const referenciaID = req.user.ReferenciaID;

        if (!codigo || !tipo) {
            return res.status(400).json({
                status: "error",
                error: "Código e tipo são obrigatórios",
            });
        }

        if (!['email', 'telefone'].includes(tipo)) {
            return res.status(400).json({
                status: "error",
                error: "Tipo deve ser 'email' ou 'telefone'",
            });
        }

        // Buscar usuário e verificar código
        const campoCodigo = tipo === 'email' ? 'CodigoEmail' : 'CodigoTelefone';
        const [userRows] = await pool.query(
            `SELECT * FROM Utilizadores WHERE ReferenciaID = ? AND ${campoCodigo} = ?`,
            [referenciaID, codigo]
        );

        if (userRows.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "Código inválido ou expirado",
            });
        }

        // Marcar como verificado
        if (tipo === 'email') {
            await pool.query(
                "UPDATE Utilizadores SET EmailVerificado = 1, CodigoEmail = NULL WHERE ReferenciaID = ?",
                [referenciaID]
            );
        } else {
            // Para telefone, podemos adicionar um campo TelefoneVerificado se necessário
            await pool.query(
                "UPDATE Utilizadores SET CodigoTelefone = NULL WHERE ReferenciaID = ?",
                [referenciaID]
            );
        }

        console.log(` ${tipo} verificado com sucesso para usuário ${referenciaID}`);

        res.json({
            status: "ok",
            message: `${tipo === 'email' ? 'Email' : 'Telefone'} verificado com sucesso!`,
        });
    } catch (err) {
        console.error(" Erro ao validar código:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao validar código",
        });
    }
});

// ================== ROTAS DE RECUPERAÇÃO DE SENHA ==================

// Esqueci a senha - enviar código
router.post("/esqueci-senha", async (req, res) => {
    try {
        const {
            emailOuTelefone
        } = req.body;

        if (!emailOuTelefone) {
            return res.status(400).json({
                status: "error",
                error: "Email ou telefone é obrigatório",
            });
        }

        // ===== ATENÇÃO: APENAS EMAIL SUPORTADO =====
        // WhatsApp foi removido - apenas email disponível para recuperação de senha
        // Verificar se é email válido
        if (!emailOuTelefone.includes('@')) {
            return res.status(400).json({
                status: "error",
                error: "Apenas email é suportado para recuperação de senha. WhatsApp foi removido.",
            });
        }

        // Buscar por email
        const [userRows] = await pool.query(
            "SELECT * FROM Utilizadores WHERE Email = ?",
            [emailOuTelefone]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                status: "error",
                error: "Usuário não encontrado",
            });
        }

        const user = userRows[0];
        const codigo = gerarCodigo();

        // Salvar código no banco
        await pool.query(
            "UPDATE Utilizadores SET CodigoEmail = ? WHERE ReferenciaID = ?",
            [codigo, user.ReferenciaID]
        );

        // Enviar por email
        const emailResult = await enviarEmail(
            user.Email,
            "PromoPing - Recuperação de senha",
            `Olá ${user.Nome}!\n\nVocê solicitou a recuperação de senha.\n\nSeu código é: ${codigo}\n\nEste código expira em 10 minutos.\n\nSe não foi você, ignore este e-mail.\n\nPromoPing`
        );

        if (emailResult.success) {
            console.log(` Código de recuperação enviado para ${user.Email}: ${codigo}`);
        } else {
            console.log(" Email não configurado, mas código salvo:", codigo);
        }

        res.json({
            status: "ok",
            message: "Código enviado por email!",
            canal: 'email'
        });
    } catch (err) {
        console.error(" Erro na recuperação de senha:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao processar recuperação de senha",
        });
    }
});

// Resetar senha com código
router.post("/resetar-senha", async (req, res) => {
    try {
        const {
            emailOuTelefone,
            codigo,
            novaSenha
        } = req.body;

        if (!emailOuTelefone || !codigo || !novaSenha) {
            return res.status(400).json({
                status: "error",
                error: "Email/telefone, código e nova senha são obrigatórios",
            });
        }

        if (novaSenha.length < 6) {
            return res.status(400).json({
                status: "error",
                error: "A nova senha deve ter pelo menos 6 caracteres",
            });
        }

        // ===== ATENÇÃO: APENAS EMAIL SUPORTADO =====
        // WhatsApp foi removido - apenas email disponível para reset de senha
        // Verificar se é email válido
        if (!emailOuTelefone.includes('@')) {
            return res.status(400).json({
                status: "error",
                error: "Apenas email é suportado para reset de senha. WhatsApp foi removido.",
            });
        }

        // Buscar por email e verificar código de email
        const [userRows] = await pool.query(
            "SELECT * FROM Utilizadores WHERE Email = ? AND CodigoEmail = ?",
            [emailOuTelefone, codigo]
        );

        if (userRows.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "Código inválido ou expirado",
            });
        }

        const user = userRows[0];

        // Hash da nova senha
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(novaSenha, saltRounds);

        // Atualizar senha e limpar códigos
        await pool.query(
            "UPDATE Utilizadores SET SenhaHash = ?, CodigoEmail = NULL, CodigoTelefone = NULL WHERE ReferenciaID = ?",
            [hashedPassword, user.ReferenciaID]
        );

        console.log(` Senha redefinida com sucesso para usuário ${user.ReferenciaID} via email`);

        res.json({
            status: "ok",
            message: "Senha redefinida com sucesso!",
        });
    } catch (err) {
        console.error(" Erro ao resetar senha:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao redefinir senha",
        });
    }
});


// Reenviar código de verificação (para usuários não logados)
router.post("/reenviar-codigo", async (req, res) => {
    try {
        const {
            email
        } = req.body;

        if (!email) {
            return res.status(400).json({
                status: "error",
                error: "Email é obrigatório",
            });
        }

        // Buscar usuário
        const [userRows] = await pool.query(
            "SELECT * FROM Utilizadores WHERE Email = ?",
            [email]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                status: "error",
                error: "Usuário não encontrado",
            });
        }

        const user = userRows[0];

        // Se já está verificado, não precisa reenviar
        if (user.EmailVerificado) {
            return res.status(400).json({
                status: "error",
                error: "Email já está verificado",
            });
        }

        const codigo = gerarCodigo();
        await pool.query(
            "UPDATE Utilizadores SET CodigoEmail = ? WHERE ReferenciaID = ?",
            [codigo, user.ReferenciaID]
        );

        // Enviar por email
        try {
            const {
                sendEmail
            } = await import("../services/notify.js");
            const messageHtml = `
        <h2> Código de Verificação</h2>
        <p>Olá <b>${user.Nome}</b> ,</p>
        <p>Você solicitou um novo código de verificação:</p>
        <h1 style="color: #ff6b35; font-size: 2em; text-align: center; margin: 20px 0;">${codigo}</h1>
        <p>Este código expira em 10 minutos.</p>
        <p>Se não foi você, ignore este e-mail.</p>
        <hr>
        <p style="color: #666; font-size: 0.9em;">&copy; ${new Date().getFullYear()} PromoPing</p>
      `;

            await sendEmail(user.Email, "PromoPing - Novo código de verificação", messageHtml);
            console.log(` Novo código de verificação enviado para ${user.Email}: ${codigo}`);
        } catch (emailError) {
            console.log(" Email não configurado, mas código salvo:", codigo);
        }

        // ===== WHATSAPP REMOVIDO =====
        // WhatsApp foi removido do sistema - apenas email disponível

        res.json({
            status: "ok",
            message: "Código reenviado com sucesso!",
        });
    } catch (err) {
        console.error(" Erro ao reenviar código:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao reenviar código",
        });
    }
});

// Verificar código sem login (para usuários não logados)
router.post("/verificar-codigo", async (req, res) => {
    try {
        const {
            email,
            codigo
        } = req.body;

        if (!email || !codigo) {
            return res.status(400).json({
                status: "error",
                error: "Email e código são obrigatórios",
            });
        }

        // Buscar usuário e verificar código
        const [userRows] = await pool.query(
            "SELECT * FROM Utilizadores WHERE Email = ? AND CodigoEmail = ?",
            [email, codigo]
        );

        if (userRows.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "Código inválido ou expirado",
            });
        }

        const user = userRows[0];

        // Marcar como verificado
        await pool.query(
            "UPDATE Utilizadores SET EmailVerificado = 1, CodigoEmail = NULL WHERE ReferenciaID = ?",
            [user.ReferenciaID]
        );

        const { token, refreshToken } = gerarParesToken(user.ReferenciaID, user.Email);

        console.log(` Email verificado com sucesso para usuário ${user.ReferenciaID}`);

        res.json({
            status: "ok",
            message: "Email verificado com sucesso!",
            token,
            refreshToken,
            user: {
                ReferenciaID: user.ReferenciaID,
                email: user.Email,
                nome: user.Nome
            },
        });
    } catch (err) {
        console.error(" Erro ao verificar código:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao verificar código",
        });
    }
});


// Atualizar telefone do usuário
router.put("/telefone", verifyToken, async (req, res) => {
    try {
        const {
            telefone
        } = req.body;
        const referenciaID = req.user.ReferenciaID;

        if (!telefone) {
            return res.status(400).json({
                status: "error",
                error: "Telefone é obrigatório",
            });
        }

        // Validar formato do telefone (básico)
        const telefoneRegex = /^[0-9+\-\s()]{9,15}$/;
        if (!telefoneRegex.test(telefone)) {
            return res.status(400).json({
                status: "error",
                error: "Formato de telefone inválido",
            });
        }

        await pool.query(
            "UPDATE Utilizadores SET Telefone = ? WHERE ReferenciaID = ?",
            [telefone, referenciaID]
        );

        res.json({
            status: "ok",
            message: "Telefone atualizado com sucesso",
        });
    } catch (err) {
        console.error(" Erro ao atualizar telefone:", err);
        res.status(500).json({
            status: "error",
            error: "Erro interno no servidor",
        });
    }
});

// Buscar dados do usuário
router.get("/profile", verifyToken, async (req, res) => {
    try {
        const referenciaID = req.user.ReferenciaID;

        const [rows] = await pool.query(
            "SELECT ReferenciaID, Nome, Email, Telefone, EmailVerificado FROM Utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                status: "error",
                error: "Usuário não encontrado",
            });
        }

        const user = rows[0];
        res.json({
            status: "ok",
            user: {
                ReferenciaID: user.ReferenciaID,
                nome: user.Nome,
                email: user.Email,
                telefone: user.Telefone,
                emailVerificado: user.EmailVerificado,
            },
        });
    } catch (err) {
        console.error(" Erro ao buscar perfil:", err);
        res.status(500).json({
            status: "error",
            error: "Erro interno no servidor",
        });
    }
});

// ================== ROTA PARA RECUPERAR DADOS OAuth TEMPORÁRIOS ==================
// Rota para recuperar dados OAuth salvos temporariamente (via cookie)
router.get("/oauth-temp-data", (req, res) => {
    try {
        const oauthDataCookie = req.cookies?.oauth_temp_data;
        
        if (!oauthDataCookie) {
            return res.json({
                status: "ok",
                hasData: false,
                data: null
            });
        }

        try {
            const oauthData = JSON.parse(oauthDataCookie);
            
            // Verificar se os dados não expiraram (15 minutos)
            const dataAge = Date.now() - (oauthData.timestamp || 0);
            const maxAge = 15 * 60 * 1000; // 15 minutos
            
            if (dataAge > maxAge) {
                // Dados expirados, limpar cookie
                res.clearCookie('oauth_temp_data');
                return res.json({
                    status: "ok",
                    hasData: false,
                    data: null,
                    expired: true
                });
            }

            return res.json({
                status: "ok",
                hasData: true,
                data: oauthData
            });
        } catch (parseError) {
            console.error("[OAUTH TEMP DATA] Erro ao fazer parse dos dados:", parseError);
            res.clearCookie('oauth_temp_data');
            return res.json({
                status: "ok",
                hasData: false,
                data: null
            });
        }
    } catch (err) {
        console.error("[OAUTH TEMP DATA] Erro ao recuperar dados OAuth:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao recuperar dados OAuth"
        });
    }
});

// Rota para limpar dados OAuth temporários
router.post("/oauth-temp-data/clear", (req, res) => {
    res.clearCookie('oauth_temp_data');
    res.json({
        status: "ok",
        message: "Dados OAuth temporários limpos"
    });
});

export default router;