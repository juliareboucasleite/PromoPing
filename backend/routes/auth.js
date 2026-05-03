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
}); // Garante que .env estÃ¡ sendo lido da raiz

const router = express.Router();

const USER_SELECT_FIELDS = `
    referenciaid,
    nome,
    email,
    senhahash,
    telefone,
    codigotelefone,
    ativo,
    datadesativacao,
    dataregisto,
    ultimologin,
    perfilid,
    emailverificado,
    codigoemail,
    datanascimento,
    fotoperfil,
    createdat,
    updatedat,
    discord_id,
    google_id,
    ultimo_login,
    ultimaalteracaosenha,
    ultimaalteracaonome,
    dinheiro_poupado
`;

// ExpiraÃ§Ã£o: access 30 dias, refresh 60 dias (renovaÃ§Ã£o automÃ¡tica)
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

/** Token de curta duraÃ§Ã£o (5 min) usado apenas para completar 2FA no login. */
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

// FunÃ§Ã£o para enviar email
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
                        const error = new Error("Email nÃ£o fornecido pelo Google. Certifique-se de que seu email estÃ¡ visÃ­vel no Google.");
                        console.error("[GOOGLE STRATEGY] Erro: Email nÃ£o fornecido pelo Google");
                        return done(error, null);
                    }

                    const email = profile.emails[0].value;
                    const googleId = profile.id;
                    const fotoPerfil = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
                    const nome = profile.displayName || profile.name?.givenName || 'UsuÃ¡rio Google';

                    console.log("[GOOGLE STRATEGY] Processando usuÃ¡rio:", { email, nome, googleId });

                    const [rows] = await pool.query(
                        `SELECT ${USER_SELECT_FIELDS}
                         FROM Utilizadores
                         WHERE Email = ?`,
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
                                // Se campo nÃ£o existe, tentar atualizar apenas o que existe
                                console.log("[GOOGLE STRATEGY] Erro ao atualizar (campo pode nÃ£o existir):", updateErr.message);
                                try {
                                    if (fotoPerfil) {
                                        await pool.query(
                                            "UPDATE Utilizadores SET FotoPerfil = ? WHERE ReferenciaID = ?",
                                            [fotoPerfil, referenciaID]
                                        );
                                    }
                                } catch (fotoErr) {
                                    console.log("[GOOGLE STRATEGY] FotoPerfil nÃ£o existe, ignorando");
                                }
                                try {
                                    if (googleId) {
                                        await pool.query(
                                            "UPDATE Utilizadores SET google_id = ? WHERE ReferenciaID = ?",
                                            [googleId, referenciaID]
                                        );
                                    }
                                } catch (googleIdErr) {
                                    console.log("[GOOGLE STRATEGY] google_id nÃ£o existe, ignorando");
                                }
                            }
                        }
                        console.log("[GOOGLE STRATEGY] UsuÃ¡rio Google jÃ¡ existe:", email);
                    } else {
                        // Determinar PerfilId: se nÃ£o existe admin (PerfilId=1), o primeiro registro vira admin; caso contrÃ¡rio, padrÃ£o user (2)
                        const [adminCountRows] = await pool.query(
                            "SELECT COUNT(*) as total FROM Utilizadores WHERE PerfilId = 1"
                        );
                        const perfilId = (adminCountRows[0]?.total || 0) === 0 ? 1 : 2;
                        
                        // Gerar ReferenciaID para novo usuÃ¡rio
                        const novaReferenciaID = gerarReferenciaID();
                        
                        // Inserir novo usuÃ¡rio com foto de perfil, google_id e campos necessÃ¡rios
                        try {
                            // Tentar inserir com google_id, FotoPerfil, SenhaHash, Ativo e PerfilId
                            const [result] = await pool.query(
                                "INSERT INTO Utilizadores (ReferenciaID, Nome, Email, Telefone, FotoPerfil, google_id, SenhaHash, Ativo, PerfilId, DataRegisto, EmailVerificado) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), 1)",
                                [novaReferenciaID, nome, email, null, fotoPerfil, googleId, '', perfilId]
                            );
                            referenciaID = novaReferenciaID;
                            console.log("[GOOGLE STRATEGY] Novo usuÃ¡rio criado com ReferenciaID:", referenciaID);
                            
                            // Atualizar mÃ©tricas automaticamente
                            try {
                                await atualizarMetricasAutomaticamente();
                                console.log("[GOOGLE STRATEGY] MÃ©tricas atualizadas apÃ³s criaÃ§Ã£o de novo utilizador via Google");
                            } catch (metricError) {
                                console.error("[GOOGLE STRATEGY] Erro ao atualizar mÃ©tricas:", metricError);
                            }
                        } catch (insertErr) {
                            console.error('[GOOGLE STRATEGY] Erro ao inserir utilizador (primeira tentativa):', insertErr.stack || insertErr.message || insertErr);
                            // Se campos nÃ£o existem, tentar inserir sem eles
                            try {
                                const [result] = await pool.query(
                                    "INSERT INTO Utilizadores (ReferenciaID, Nome, Email, Telefone, FotoPerfil, SenhaHash, Ativo, PerfilId, DataRegisto, EmailVerificado) VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW(), 1)",
                                    [novaReferenciaID, nome, email, null, fotoPerfil, '', perfilId]
                                );
                                referenciaID = novaReferenciaID;
                                
                                // Tentar atualizar google_id separadamente se possÃ­vel
                                if (googleId) {
                                    try {
                                        await pool.query(
                                            "UPDATE Utilizadores SET google_id = ? WHERE ReferenciaID = ?",
                                            [googleId, referenciaID]
                                        );
                                    } catch (googleIdErr) {
                                        console.log("[GOOGLE STRATEGY] Campo google_id nÃ£o existe, ignorando");
                                    }
                                }
                                
                                // Atualizar mÃ©tricas automaticamente
                                try {
                                    await atualizarMetricasAutomaticamente();
                                    console.log("[GOOGLE STRATEGY] MÃ©tricas atualizadas apÃ³s criaÃ§Ã£o de novo utilizador via Google");
                                } catch (metricError) {
                                    console.error("[GOOGLE STRATEGY] Erro ao atualizar mÃ©tricas:", metricError);
                                }
                            } catch (insertErr2) {
                                console.error('[GOOGLE STRATEGY] Erro ao inserir utilizador (segunda tentativa):', insertErr2.stack || insertErr2.message || insertErr2);
                                // Se FotoPerfil nÃ£o existe, inserir sem ele mas com campos essenciais
                                const [result] = await pool.query(
                                    "INSERT INTO Utilizadores (ReferenciaID, Nome, Email, Telefone, SenhaHash, Ativo, PerfilId, DataRegisto, EmailVerificado) VALUES (?, ?, ?, ?, ?, 1, ?, NOW(), 1)",
                                    [novaReferenciaID, nome, email, null, '', perfilId]
                                );
                                referenciaID = novaReferenciaID;
                                
                                // Tentar atualizar google_id separadamente se possÃ­vel
                                if (googleId) {
                                    try {
                                        await pool.query(
                                            "UPDATE Utilizadores SET google_id = ? WHERE ReferenciaID = ?",
                                            [googleId, referenciaID]
                                        );
                                    } catch (googleIdErr) {
                                        console.log("[GOOGLE STRATEGY] Campo google_id nÃ£o existe, ignorando");
                                    }
                                }
                                
                                // Tentar atualizar FotoPerfil separadamente se possÃ­vel
                                if (fotoPerfil) {
                                    try {
                                        await pool.query(
                                            "UPDATE Utilizadores SET FotoPerfil = ? WHERE ReferenciaID = ?",
                                            [fotoPerfil, referenciaID]
                                        );
                                    } catch (fotoErr) {
                                        console.log("[GOOGLE STRATEGY] Campo FotoPerfil nÃ£o existe, ignorando");
                                    }
                                }
                                
                                // Atualizar mÃ©tricas automaticamente
                                try {
                                    await atualizarMetricasAutomaticamente();
                                    console.log("[GOOGLE STRATEGY] MÃ©tricas atualizadas apÃ³s criaÃ§Ã£o de novo utilizador via Google");
                                } catch (metricError) {
                                    console.error("[GOOGLE STRATEGY] Erro ao atualizar mÃ©tricas:", metricError);
                                }
                            }
                        }
                    }

                    await pool.query(
                        `INSERT INTO configutilizador (ReferenciaID, CanalPreferido)
             VALUES (?, ?)
             ON CONFLICT (ReferenciaID) DO UPDATE SET CanalPreferido = EXCLUDED.CanalPreferido`,
                        [referenciaID, "email"]
                    );

                    // Salvar tokens OAuth para sincronizaÃ§Ã£o de calendÃ¡rio
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

                            // Garantir Ã­ndice/constraint Ãºnico em ReferenciaID para ON CONFLICT funcionar no Postgres
                            try {
                                await pool.query(
                                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_google_oauth_tokens_referenciaid ON google_oauth_tokens (ReferenciaID)"
                                );
                            } catch (idxErr) {
                                // Alguns ambientes (compat shim) podem nÃ£o suportar IF NOT EXISTS na criaÃ§Ã£o de index; ignorar erros
                                console.log("[GOOGLE STRATEGY] Aviso ao criar Ã­ndice Ãºnico google_oauth_tokens.ReferenciaID:", idxErr.message || idxErr);
                            }

                            // Calcular data de expiraÃ§Ã£o (tokens do Google geralmente expiram em 1 hora)
                            const expiresAt = new Date();
                            expiresAt.setHours(expiresAt.getHours() + 1);

                            await pool.query(
                                `INSERT INTO google_oauth_tokens (ReferenciaID, access_token, refresh_token, expires_at, scope)
                                 VALUES (?, ?, ?, ?, ?)
                                 ON CONFLICT (ReferenciaID) DO UPDATE SET
                                     access_token = EXCLUDED.access_token,
                                     refresh_token = EXCLUDED.refresh_token,
                                     expires_at = EXCLUDED.expires_at,
                                     scope = EXCLUDED.scope,
                                     updated_at = NOW()`,
                                [referenciaID, accessToken, refreshToken || null, expiresAt, 'calendar.readonly']
                            );
                            console.log("[GOOGLE STRATEGY] Tokens OAuth salvos para sincronizaÃ§Ã£o de calendÃ¡rio");
                        } catch (tokenErr) {
                            console.error("[GOOGLE STRATEGY] Erro ao salvar tokens OAuth:", tokenErr);
                            // NÃ£o falhar o login se nÃ£o conseguir salvar tokens
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
    // Google OAuth nÃ£o configurado - silencioso
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
                    // GitHub pode nÃ£o ter email pÃºblico, entÃ£o precisamos buscar da API
                    let email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

                    // Se nÃ£o houver email no perfil, tentar buscar da API do GitHub
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
                    const nome = profile.displayName || profile.username || 'UsuÃ¡rio GitHub';

                    const [rows] = await pool.query(
                        `SELECT ${USER_SELECT_FIELDS}
                         FROM Utilizadores
                         WHERE Email = ?`,
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
                                console.log("Erro ao atualizar foto de perfil (campo pode nÃ£o existir):", updateErr.message);
                            }
                        }
                        console.log("UsuÃ¡rio GitHub jÃ¡ existe:", email);
                    } else {
                        // Gerar ReferenciaID para novo usuÃ¡rio
                        const novaReferenciaID = gerarReferenciaID();
                        
                        // Inserir novo usuÃ¡rio com foto de perfil se disponÃ­vel
                        try {
                            const [result] = await pool.query(
                                "INSERT INTO Utilizadores (ReferenciaID, Nome, Email, Telefone, FotoPerfil, SenhaHash) VALUES (?, ?, ?, ?, ?, ?)",
                                [novaReferenciaID, nome, email, null, fotoPerfil, '']
                            );
                            referenciaID = novaReferenciaID;

                            // Atualizar mÃ©tricas automaticamente quando novo utilizador Ã© criado via GitHub
                            try {
                                await atualizarMetricasAutomaticamente();
                                console.log(" MÃ©tricas atualizadas apÃ³s criaÃ§Ã£o de novo utilizador via GitHub");
                            } catch (metricError) {
                                console.error(" Erro ao atualizar mÃ©tricas apÃ³s criaÃ§Ã£o de utilizador:", metricError);
                                // NÃ£o bloquear resposta em caso de erro nas mÃ©tricas
                            }
                        } catch (insertErr) {
                            console.error('[GITHUB STRATEGY] Erro ao inserir utilizador com FotoPerfil:', insertErr.stack || insertErr.message || insertErr);
                            // Se campo FotoPerfil nÃ£o existe, inserir sem ele
                            const [result] = await pool.query(
                                "INSERT INTO Utilizadores (ReferenciaID, Nome, Email, Telefone, SenhaHash) VALUES (?, ?, ?, ?, ?)",
                                [novaReferenciaID, nome, email, null, '']
                            );
                            referenciaID = novaReferenciaID;

                            // Atualizar mÃ©tricas automaticamente quando novo utilizador Ã© criado via GitHub
                            try {
                                await atualizarMetricasAutomaticamente();
                                console.log(" MÃ©tricas atualizadas apÃ³s criaÃ§Ã£o de novo utilizador via GitHub");
                            } catch (metricError) {
                                console.error(" Erro ao atualizar mÃ©tricas apÃ³s criaÃ§Ã£o de utilizador:", metricError);
                                // NÃ£o bloquear resposta em caso de erro nas mÃ©tricas
                            }
                        }
                    }

                    await pool.query(
                        `INSERT INTO configutilizador (ReferenciaID, CanalPreferido)
             VALUES (?, ?)
             ON CONFLICT (ReferenciaID) DO UPDATE SET CanalPreferido = EXCLUDED.CanalPreferido`,
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
    // GitHub OAuth nÃ£o configurado - silencioso
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
                    console.log(" [DISCORD STRATEGY] ========== INÃCIO DA ESTRATÃ‰GIA ==========");
                    console.log(" [DISCORD STRATEGY] Profile recebido:", {
                        id: profile.id,
                        username: profile.username,
                        email: profile.email,
                        avatar: profile.avatar,
                        verified: profile.verified
                    });

                    // Verificar se o email estÃ¡ disponÃ­vel e verificado
                    if (!profile.email) {
                        const error = new Error("Email nÃ£o fornecido pelo Discord. Certifique-se de que seu email estÃ¡ verificado no Discord.");
                        console.error(" Erro: Email nÃ£o fornecido pelo Discord");
                        return done(error, null);
                    }

                    const email = profile.email;
                    const discordId = profile.id;
                    const username = profile.username;
                    const avatar = profile.avatar;

                    // Verificar se usuÃ¡rio Discord jÃ¡ existe no JSON
                    let discordUser = findDiscordUser(discordId);

                    if (discordUser && discordUser.ReferenciaID) {
                        // UsuÃ¡rio Discord jÃ¡ existe e estÃ¡ associado - LOGIN DIRETO
                        console.log(" UsuÃ¡rio Discord jÃ¡ registrado - Login direto:", discordUser.username);

                        // Garantir que discord_id estÃ¡ salvo no banco (caso nÃ£o esteja)
                        try {
                            await pool.query(
                                "UPDATE utilizadores SET discord_id = ? WHERE ReferenciaID = ? AND (discord_id IS NULL OR discord_id = '')",
                                [discordId, discordUser.ReferenciaID]
                            );
                        } catch (dbError) {
                            console.log(" [DISCORD STRATEGY] Erro ao atualizar discord_id (coluna pode nÃ£o existir):", dbError.message);
                            // Continuar mesmo se falhar
                        }

                        // Garantir que estÃ¡ na tabela contasconectadas
                        try {
                            await pool.query(
                                "INSERT INTO contasconectadas (ReferenciaID, Tipo, Conectado, DataConexao) VALUES (?, 'discord', 1, NOW()) ON CONFLICT (ReferenciaID, Tipo) DO UPDATE SET Conectado = 1, DataConexao = NOW()",
                                [discordUser.ReferenciaID]
                            );
                        } catch (contasError) {
                            console.log(" [DISCORD STRATEGY] Erro ao inserir em contasconectadas:", contasError.message);
                        }

                        const { token, refreshToken } = gerarParesToken(discordUser.ReferenciaID, discordUser.email);

                        console.log(" [DISCORD STRATEGY] Login direto realizado para usuÃ¡rio:", discordUser.ReferenciaID);
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

                    // UsuÃ¡rio Discord nÃ£o existe ou nÃ£o estÃ¡ associado
                    if (!discordUser) {
                        // Registrar novo usuÃ¡rio Discord no JSON
                        discordUser = registerDiscordUser({
                            id: discordId,
                            username: username,
                            email: email,
                            avatar: avatar
                        });
                    }

                    // Verificar se usuÃ¡rio existe no banco de dados
                    const [rows] = await pool.query(
                        `SELECT ${USER_SELECT_FIELDS}
                         FROM Utilizadores
                         WHERE Email = ?`,
                        [email]
                    );

                    let referenciaID;
                    if (rows.length > 0) {
                        const existingUser = rows[0] || {};
                        const existingNome = existingUser.Nome ?? existingUser.nome;
                        const existingReferenciaID = existingUser.ReferenciaID ?? existingUser.referenciaid;
                        // UsuÃ¡rio jÃ¡ existe no banco - ASSOCIAR DISCORD
                        console.log(" UsuÃ¡rio existente encontrado - Associando Discord:", existingNome);
                        referenciaID = existingReferenciaID;

                        // Associar Discord com usuÃ¡rio do banco
                        linkDiscordUser(discordId, referenciaID);
                        
                        // Atualizar discord_id no banco de dados (se a coluna existir)
                        try {
                            await pool.query(
                                "UPDATE utilizadores SET discord_id = ? WHERE ReferenciaID = ?",
                                [discordId, referenciaID]
                            );
                            console.log(` [DISCORD STRATEGY] discord_id ${discordId} salvo no banco para usuÃ¡rio ${referenciaID}`);
                        } catch (dbError) {
                            console.error(" [DISCORD STRATEGY] Erro ao salvar discord_id (coluna pode nÃ£o existir):", dbError.message);
                            // Continuar mesmo se falhar - o linkDiscordUser jÃ¡ foi feito
                        }

                        // Inserir ou atualizar na tabela contasconectadas
                        try {
                            await pool.query(
                                "INSERT INTO contasconectadas (ReferenciaID, Tipo, Conectado, DataConexao) VALUES (?, 'discord', 1, NOW()) ON CONFLICT (ReferenciaID, Tipo) DO UPDATE SET Conectado = 1, DataConexao = NOW()",
                                [referenciaID]
                            );
                            console.log(` [DISCORD STRATEGY] Discord inserido/atualizado em contasconectadas para usuÃ¡rio ${referenciaID}`);
                        } catch (contasError) {
                            console.error(" [DISCORD STRATEGY] Erro ao inserir em contasconectadas:", contasError.message);
                        }
                    } else {
                        // Gerar ReferenciaID para novo usuÃ¡rio
                        const novaReferenciaID = gerarReferenciaID();
                        
                        // Criar novo usuÃ¡rio no banco (tentar com discord_id, se falhar, criar sem)
                        console.log("ðŸ†• Criando novo usuÃ¡rio no banco:", username);
                        let result;
                        try {
                            // Tentar criar com discord_id
                            [result] = await pool.query(
                                "INSERT INTO utilizadores (ReferenciaID, Nome, Email, Ativo, discord_id, SenhaHash) VALUES (?, ?, ?, 1, ?, ?)",
                                [novaReferenciaID, username, email, discordId, '']
                            );
                            console.log(` [DISCORD STRATEGY] Novo usuÃ¡rio criado com ReferenciaID ${novaReferenciaID} e discord_id ${discordId}`);
                        } catch (dbError) {
                            console.error(' [DISCORD STRATEGY] Erro ao criar usuÃ¡rio com discord_id:', dbError.stack || dbError.message || dbError);
                            // Se falhar (coluna nÃ£o existe), criar sem discord_id
                            console.log(" [DISCORD STRATEGY] Coluna discord_id nÃ£o encontrada, criando usuÃ¡rio sem ela");
                            [result] = await pool.query(
                                "INSERT INTO utilizadores (ReferenciaID, Nome, Email, Ativo, SenhaHash) VALUES (?, ?, ?, 1, ?)",
                                [novaReferenciaID, username, email, '']
                            );
                        }
                        referenciaID = novaReferenciaID;

                        // Inserir Discord na tabela contasconectadas para novo usuÃ¡rio
                        try {
                            await pool.query(
                                "INSERT INTO contasconectadas (ReferenciaID, Tipo, Conectado, DataConexao) VALUES (?, 'discord', 1, NOW())",
                                [referenciaID]
                            );
                            console.log(` [DISCORD STRATEGY] Discord inserido em contasconectadas para novo usuÃ¡rio ${referenciaID}`);
                        } catch (contasError) {
                            console.error(" [DISCORD STRATEGY] Erro ao inserir em contasconectadas:", contasError.message);
                        }

                        // Buscar ID do plano FREE
                        const [planoFree] = await pool.query(
                            "SELECT Id FROM planos WHERE Nome = 'Free' LIMIT 1"
                        );

                        const planoFreeId = planoFree.length > 0 ? (planoFree[0].Id ?? planoFree[0].id ?? 1) : 1; // Fallback para ID 1

                        // Criar configuraÃ§Ã£o do usuÃ¡rio com plano FREE
                        await pool.query(
                            "INSERT INTO configutilizador (ReferenciaID, CanalPreferido, PlanoAtualId) VALUES (?, ?, ?)",
                            [referenciaID, "discord", planoFreeId]
                        );

                        console.log(` UsuÃ¡rio Discord ${username} registrado com plano FREE (ID: ${planoFreeId})`);

                        // Associar Discord com novo usuÃ¡rio
                        linkDiscordUser(discordId, referenciaID);

                        // Atualizar mÃ©tricas automaticamente quando novo utilizador Ã© criado via Discord
                        try {
                            await atualizarMetricasAutomaticamente();
                            console.log(" MÃ©tricas atualizadas apÃ³s criaÃ§Ã£o de novo utilizador via Discord");
                        } catch (metricError) {
                            console.error(" Erro ao atualizar mÃ©tricas apÃ³s criaÃ§Ã£o de utilizador:", metricError);
                            // NÃ£o bloquear resposta em caso de erro nas mÃ©tricas
                        }
                    }

                    const { token, refreshToken } = gerarParesToken(referenciaID, email);

                    console.log(" [DISCORD STRATEGY] Token JWT gerado para usuÃ¡rio:", referenciaID);
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
                    console.error(" [DISCORD STRATEGY] ERRO na autenticaÃ§Ã£o Discord:", error);
                    console.error(" [DISCORD STRATEGY] Stack trace:", error.stack);
                    return done(error, null);
                }
            }
        )
    );
} else {
    // Discord OAuth nÃ£o configurado - silencioso
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Verificar se usuÃ¡rio Discord jÃ¡ existe
router.get('/discord/check/:discordId', async (req, res) => {
    try {
        const {
            discordId
        } = req.params;
        const discordUser = findDiscordUser(discordId);

        if (discordUser && discordUser.ReferenciaID) {
            // UsuÃ¡rio jÃ¡ existe - pode fazer login direto
            res.json({
                exists: true,
                message: "UsuÃ¡rio Discord jÃ¡ registrado - pode fazer login direto",
                user: {
                    username: discordUser.username,
                    email: discordUser.email
                }
            });
        } else {
            // UsuÃ¡rio nÃ£o existe - precisa registrar
            res.json({
                exists: false,
                message: "UsuÃ¡rio Discord nÃ£o encontrado - precisa registrar primeiro"
            });
        }
    } catch (error) {
        console.error(" Erro ao verificar usuÃ¡rio Discord:", error);
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

            console.log(" Login direto via rota alternativa para usuÃ¡rio:", discordUser.ReferenciaID);

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
                error: "UsuÃ¡rio Discord nÃ£o encontrado"
            });
        }
    } catch (error) {
        console.error(" Erro no login direto Discord:", error);
        res.status(500).json({
            error: "Erro interno do servidor"
        });
    }
});

// ServiÃ§os SMS e WhatsApp foram removidos - apenas Email e Discord disponÃ­veis

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

        // Buscar usuÃ¡rios por nome, email ou username (usando nome como username)
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
                maskedEmail: maskedEmail, // Email mascarado para exibiÃ§Ã£o
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
                error: "Email Ã© obrigatÃ³rio",
            });
        }

        // Buscar usuÃ¡rio
        const [userRows] = await pool.query(
            "SELECT ReferenciaID, Nome, Email FROM Utilizadores WHERE Email = ?",
            [email]
        );

        // SEMPRE retornar sucesso (por seguranÃ§a, nÃ£o revelar se email existe)
        if (userRows.length === 0) {
            return res.json({
                status: "ok",
                message: "Se este email estiver cadastrado, vocÃª receberÃ¡ um link para redefinir sua senha.",
            });
        }

        const user = userRows[0];

        // Gerar token Ãºnico
        const crypto = await import("crypto");
        const token = crypto.default.randomBytes(32).toString("hex");

        // Token expira em 24 horas
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Criar tabela se nÃ£o existir
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

        // Invalidar tokens anteriores do usuÃ¡rio
        await pool.query(
            "UPDATE password_reset_tokens SET Used = 1 WHERE ReferenciaID = ? AND Used = 0",
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
                    <p style="margin: 0 0 30px; color: #000000; font-size: 16px; line-height: 24px;">JÃ¡ podes repor a tua palavra-passe!</p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${resetUrl}" style="display: inline-block; background-color: #e60023; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 24px; font-size: 16px; font-weight: 600; text-align: center;">Redefinir senha</a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 30px 0 0; color: #666666; font-size: 14px; line-height: 20px;">Informamos que tens 24 horas para escolher uma palavra-passe. Depois disso, terÃ¡s de solicitar uma nova.</p>
                    
                    <p style="margin: 20px 0 0; color: #666666; font-size: 14px; line-height: 20px;">NÃ£o solicitaste uma nova palavra-passe? Podes ignorar este e-mail.</p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 40px; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0 0 10px; color: #666666; font-size: 12px; line-height: 18px;">Este e-mail foi enviado para <strong>${user.Email}</strong></p>
                    <p style="margin: 10px 0; color: #999999; font-size: 12px;">
                      <a href="${baseUrl}" style="color: #666666; text-decoration: none;">Central de Ajuda</a> Â· 
                      <a href="${baseUrl}/pages/privacidade.html" style="color: #666666; text-decoration: none;">PolÃ­tica de Privacidade</a> Â· 
                      <a href="${baseUrl}/pages/termos.html" style="color: #666666; text-decoration: none;">Termos e condiÃ§Ãµes</a>
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
            "RepÃµe a palavra-passe - PromoPing",
            emailHtml
        );

        if (emailResult.success) {
            console.log(`[FORGOT-PASSWORD] Email de reset enviado para ${user.Email}`);
        }

        res.json({
            status: "ok",
            message: "Se este email estiver cadastrado, vocÃª receberÃ¡ um link para redefinir sua senha.",
        });
    } catch (err) {
        console.error("[FORGOT-PASSWORD] Erro ao processar solicitaÃ§Ã£o:", err);
        // Sempre retornar sucesso por seguranÃ§a
        res.json({
            status: "ok",
            message: "Se este email estiver cadastrado, vocÃª receberÃ¡ um link para redefinir sua senha.",
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
                error: "Token Ã© obrigatÃ³rio",
            });
        }

        // Buscar token vÃ¡lido
        const [tokenRows] = await pool.query(
            `SELECT u.Email
       FROM password_reset_tokens prt
       INNER JOIN Utilizadores u ON prt.ReferenciaID = u.ReferenciaID
       WHERE prt.Token = ? AND prt.Used = 0 AND prt.ExpiresAt > NOW()`,
            [token]
        );

        if (tokenRows.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "Token invÃ¡lido ou expirado",
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
                error: "Token e nova senha sÃ£o obrigatÃ³rios",
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                status: "error",
                error: "A senha deve ter pelo menos 6 caracteres",
            });
        }

        // Buscar token vÃ¡lido
        const [tokenRows] = await pool.query(
            `SELECT u.ReferenciaID
       FROM password_reset_tokens prt
       INNER JOIN Utilizadores u ON prt.ReferenciaID = u.ReferenciaID
       WHERE prt.Token = ? AND prt.Used = 0 AND prt.ExpiresAt > NOW()`,
            [token]
        );

        if (tokenRows.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "Token invÃ¡lido ou expirado",
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
            "UPDATE password_reset_tokens SET Used = 1 WHERE Token = ?",
            [token]
        );

        console.log(`[RESET-PASSWORD] Senha redefinida com sucesso para usuÃ¡rio ${tokenData.ReferenciaID}`);

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
                error: "Email e senha sÃ£o obrigatÃ³rios",
            });
        }

        // Busca utilizador
        const [rows] = await pool.query(
            `SELECT ${USER_SELECT_FIELDS}
             FROM Utilizadores
             WHERE Email = ?`,
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
        console.log(" UsuÃ¡rio retornado:", user);

        const userEmail = user.Email ?? user.email;
        const userNome = user.Nome ?? user.nome;
        const userReferenciaID = user.ReferenciaID ?? user.referenciaid;
        const userPerfilId = user.PerfilId ?? user.perfilid;
        const userSenhaHash = user.SenhaHash ?? user.senhahash;
        const userEmailVerificado = user.EmailVerificado ?? user.emailverificado;
        const userAtivo = user.Ativo ?? user.ativo;

        if (!userSenhaHash) {
            return res.status(400).json({
                status: "error",
                error: "Conta nÃ£o tem senha configurada. Use Google ou configure uma senha no perfil.",
            });
        }

        // Verifica senha usando bcrypt
        // ESSA PARTE AQUI Ã‰ CRÃTICA: valida se a senha estÃ¡ correta
        // Se tu mudar a lÃ³gica, pode deixar qualquer um fazer login
        // Ou bloquear quem tem a senha certa
        // NÃƒO MEXA NESSA MERDA
        const validPassword = await bcrypt.compare(password, userSenhaHash);
        console.log(" Senha vÃ¡lida?:", validPassword);

        if (!validPassword) {
            return res.status(400).json({
                status: "error",
                error: "Email ou senha incorretos",
            });
        }

        // Verificar se conta estÃ¡ desativada e permitir reativaÃ§Ã£o se ainda nÃ£o expirou
        const isInactive = userAtivo === 0 || userAtivo === false || String(userAtivo).toLowerCase() === "0" || String(userAtivo).toLowerCase() === "false" || String(userAtivo).toLowerCase() === "f";
        if (isInactive) {
            // Verificar se ainda estÃ¡ dentro do perÃ­odo de 20 dias
            let canReactivate = false;
            let expirationDate = null;

            try {
                // Verificar se DataDesativacao existe e nÃ£o expirou
                const [deactivatedInfo] = await pool.query(
                    "SELECT DataDesativacao FROM Utilizadores WHERE ReferenciaID = ?",
                    [userReferenciaID]
                );

                if (deactivatedInfo.length > 0 && deactivatedInfo[0].DataDesativacao) {
                    expirationDate = new Date(deactivatedInfo[0].DataDesativacao);
                    const now = new Date();
                    canReactivate = expirationDate > now;
                } else {
                    // Se nÃ£o tem DataDesativacao, usar DataRegisto como fallback (20 dias)
                    const registerDate = new Date(user.DataRegisto);
                    const expirationDateFallback = new Date(registerDate);
                    expirationDateFallback.setDate(expirationDateFallback.getDate() + 20);
                    canReactivate = expirationDateFallback > new Date();
                    expirationDate = expirationDateFallback;
                }
            } catch (error) {
                console.error("[AUTH] Erro ao verificar data de desativaÃ§Ã£o:", error);
                // Em caso de erro, permitir tentativa de reativaÃ§Ã£o
                canReactivate = true;
            }

            if (canReactivate) {
                // Reativar conta automaticamente ao fazer login
                await pool.query(
                    "UPDATE Utilizadores SET Ativo = 1, DataDesativacao = NULL WHERE ReferenciaID = ?",
                    [userReferenciaID]
                );
                console.log(`[AUTH] Conta ${userReferenciaID} reativada automaticamente via login`);

                // Marcar que a conta foi reativada para mostrar modal no frontend
                user.accountReactivated = true;
            } else {
                return res.status(403).json({
                    status: "error",
                    error: "Sua conta foi desativada hÃ¡ mais de 20 dias e foi permanentemente excluÃ­da. Entre em contato com o suporte.",
                    accountExpired: true
                });
            }
        }

        // Verificar se email estÃ¡ verificado
        const isEmailVerified = userEmailVerificado === 1 || userEmailVerificado === true || String(userEmailVerificado).toLowerCase() === "1" || String(userEmailVerificado).toLowerCase() === "true" || String(userEmailVerificado).toLowerCase() === "t";
        if (!isEmailVerified) {
            return res.status(403).json({
                status: "error",
                error: "Email nÃ£o verificado. Verifique seu email antes de fazer login.",
                needsVerification: true,
                email: userEmail
            });
        }

        // Se 2FA ativo, nÃ£o devolver token; devolver tempToken para completar verificaÃ§Ã£o
        const twoFA = await is2FAEnabled(userReferenciaID);
        if (twoFA) {
            const tempToken = gerarToken2FAPending(userReferenciaID, userEmail);
            return res.json({
                status: "ok",
                requires2FA: true,
                tempToken,
                user: {
                    ReferenciaID: userReferenciaID,
                    email: userEmail,
                    nome: userNome,
                    perfilId: userPerfilId
                }
            });
        }

        // IMPORTANTE: Verificar se o usuÃ¡rio Ã© admin (PerfilId = 1) para acesso ao Painel Administrativo
        // Se a requisiÃ§Ã£o vier do Painel Administrativo ou Admin PromoPing, apenas administradores podem fazer login
        // CARALHO, NÃƒO MEXA NESSA PARTE
        // Se tu fuder isso, qualquer zÃ© ruela pode acessar o painel admin
        // E aÃ­ pode foder tudo: deletar usuÃ¡rios, mudar planos, ver dados sensÃ­veis
        // PerfilId = 1 Ã© ADMIN, qualquer outro nÃºmero NÃƒO Ã‰ ADMIN
        // NÃƒO MUDE ESSA LÃ“GICA SEM ENTENDER AS CONSEQUÃŠNCIAS
        const referer = req.headers['referer'] || '';
        const origin = req.headers['origin'] || '';
        const adminPanelHeader = req.headers['x-admin-panel'] || req.headers['X-Admin-Panel'] || '';

        const isAdminPanel = referer.includes('Painel_Administrativo') ||
            referer.includes('painel-suporte-corporacao') ||
            origin.includes('Painel_Administrativo') ||
            origin.includes('painel-suporte-corporacao') ||
            adminPanelHeader === 'true';

        if (isAdminPanel) {
            const perfilId = userPerfilId;
            // PerfilId 1 = Admin (suporte), PerfilId 3 = Corporation (gestÃ£o dos funcionÃ¡rios)
            if (perfilId !== 1 && perfilId !== 3) {
                console.log(`[AUTH] Tentativa de login no Painel Administrativo negada: UsuÃ¡rio ${userEmail} (PerfilId=${perfilId})`);
                return res.status(403).json({
                    status: "error",
                    error: "Acesso negado. Apenas administradores e utilizadores corporativos podem acessar o painel.",
                    accessDenied: true
                });
            }
        }

        const { token, refreshToken } = gerarParesToken(userReferenciaID, userEmail);

        res.json({
            status: "ok",
            token,
            refreshToken,
            user: {
                ReferenciaID: userReferenciaID,
                email: userEmail,
                nome: userNome,
                perfilId: userPerfilId
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

// Completar login com cÃ³digo 2FA (apÃ³s resposta requires2FA do login)
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

// Enviar cÃ³digo 2FA por email (durante login, quando utilizador escolhe "enviar por email")
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
            return res.status(401).json({ error: "Refresh token nÃ£o fornecido" });
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ error: "ConfiguraÃ§Ã£o invÃ¡lida" });
        }
        const decoded = jwt.verify(refToken, secret);
        if (decoded.type !== "refresh" || !decoded.ReferenciaID || !decoded.email) {
            return res.status(403).json({ error: "Refresh token invÃ¡lido" });
        }
        const { token, refreshToken: newRefreshToken } = gerarParesToken(decoded.ReferenciaID, decoded.email);
        return res.json({ status: "ok", token, refreshToken: newRefreshToken });
    } catch (err) {
        if (err.name === "TokenExpiredError" || err.message === "jwt expired") {
            return res.status(401).json({ error: "Refresh token expirado", code: "REFRESH_EXPIRED" });
        }
        return res.status(403).json({ error: "Refresh token invÃ¡lido" });
    }
});

// CÃ³digo no QR muda a cada 30s; o telemÃ³vel escaneia e confirma com o token do utilizador.

// POST /api/auth/qr-init â€” gera cÃ³digo QR (alternativa ao GET qr-session; devolve code + expiresAt)
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
        return res.status(500).json({ error: "Erro ao gerar sessÃ£o QR" });
    }
});

// GET /api/auth/qr-session â€” obtÃ©m sessionId + cÃ³digo atual (e imagem QR em data URL)
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
        return res.status(500).json({ error: "Erro ao gerar sessÃ£o QR" });
    }
});

// GET /api/auth/qr-session/poll â€” polling para ver se o telemÃ³vel confirmou
router.get("/qr-session/poll", async (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        return res.status(400).json({ error: "sessionId obrigatÃ³rio" });
    }
    const status = await getSessionStatus(sessionId);
    return res.json(status);
});

// POST /api/auth/qr-confirm â€” telemÃ³vel envia o cÃ³digo escaneado + Bearer token do utilizador
router.post("/qr-confirm", verifyToken, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code || typeof code !== "string") {
            return res.status(400).json({ error: "CÃ³digo Ã© obrigatÃ³rio" });
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
            message: "Login no browser serÃ¡ concluÃ­do em instantes.",
            token: tokens.token,
            refreshToken: tokens.refreshToken,
        });
    } catch (err) {
        console.error("[QR-CONFIRM] Erro:", err);
        return res.status(500).json({ error: "Erro ao confirmar cÃ³digo" });
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
            telefone: telefone ? "fornecido" : "nÃ£o fornecido",
            data_nascimento: data_nascimento ? "fornecido" : "nÃ£o fornecido"
        });

        if (!nome || !email || !password || !data_nascimento) {
            console.log("[REGISTRO] Campos obrigatÃ³rios faltando");
            return res.status(400).json({
                status: "error",
                error: "Nome, email, senha e data de nascimento sÃ£o obrigatÃ³rios",
            });
        }

        if (password.length < 6) {
            console.log("[REGISTRO] Senha muito curta");
            return res.status(400).json({
                status: "error",
                error: "A senha deve ter pelo menos 6 caracteres",
            });
        }

        // Validar idade mÃ­nima (13 anos) - obrigatÃ³rio
        const birthDate = new Date(data_nascimento);

        // Verificar se a data Ã© vÃ¡lida
        if (isNaN(birthDate.getTime())) {
            console.log("[REGISTRO] Data de nascimento invÃ¡lida");
            return res.status(400).json({
                status: "error",
                error: "Data de nascimento invÃ¡lida",
            });
        }

        // Verificar se a data nÃ£o Ã© no futuro
        const today = new Date();
        if (birthDate > today) {
            console.log("[REGISTRO] Data de nascimento no futuro");
            return res.status(400).json({
                status: "error",
                error: "Data de nascimento nÃ£o pode ser no futuro",
            });
        }

        // Calcular idade
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        // Validar idade mÃ­nima de 13 anos
        if (age < 13) {
            console.log(`[REGISTRO] UsuÃ¡rio menor de 13 anos tentou se registrar (idade: ${age})`);
            return res.status(403).json({
                status: "error",
                error: "Ã‰ necessÃ¡rio ter pelo menos 13 anos para criar uma conta no PromoPing",
            });
        }

        console.log(`[REGISTRO] Idade validada: ${age} anos`);

        console.log("[REGISTRO] Verificando se email jÃ¡ existe...");
        const [existing] = await pool.query(
            "SELECT ReferenciaID FROM Utilizadores WHERE Email = ?",
            [email]
        );

        if (existing.length > 0) {
            console.log("[REGISTRO] Email jÃ¡ em uso");
            return res.status(400).json({
                status: "error",
                error: "Email jÃ¡ estÃ¡ em uso",
            });
        }

        console.log("[REGISTRO] Gerando hash da senha...");
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Determinar PerfilId: se nÃ£o existe admin (PerfilId=1), o primeiro registro vira admin; caso contrÃ¡rio, padrÃ£o user (2)
        console.log("[REGISTRO] Verificando perfil do usuÃ¡rio...");
        const [adminCountRows] = await pool.query(
            "SELECT COUNT(*) as total FROM Utilizadores WHERE PerfilId = 1"
        );
        const perfilId = (adminCountRows[0] ?.total || 0) === 0 ? 1 : 2;
        console.log(`[REGISTRO] PerfilId determinado: ${perfilId}`);

        console.log("[REGISTRO] Gerando ReferenciaID...");
        const referenciaID = gerarReferenciaID();
        console.log(`[REGISTRO] ReferenciaID gerado: ${referenciaID}`);

        console.log("[REGISTRO] Inserindo usuÃ¡rio na tabela Utilizadores...");

        // Tentar inserir com data_nascimento e/ou google_id se fornecidos
        let result;
        try {
            // Construir query dinamicamente baseado nos campos disponÃ­veis
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
            console.log(`[REGISTRO] UsuÃ¡rio criado com campos: ${fields.join(', ')}`);
        } catch (insertError) {
            // Se algum campo nÃ£o existir, tentar inserir sem ele
            console.log("[REGISTRO] Erro ao inserir, tentando sem campos opcionais:", insertError.message);
            
            // Tentar inserir apenas com campos bÃ¡sicos
            try {
                const [insertResult] = await pool.query(
                    "INSERT INTO Utilizadores (ReferenciaID, Nome, Email, SenhaHash, EmailVerificado, Telefone, PerfilId, Ativo, DataRegisto) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())",
                    [referenciaID, nome, email, hashedPassword, 0, telefone || null, perfilId]
                );
                result = insertResult;
                
                // Tentar atualizar google_id separadamente se disponÃ­vel
                if (oauthProvider === 'google' && oauthId) {
                    try {
                        await pool.query(
                            "UPDATE Utilizadores SET google_id = ? WHERE ReferenciaID = ?",
                            [oauthId, referenciaID]
                        );
                        console.log("[REGISTRO] google_id atualizado apÃ³s criaÃ§Ã£o:", oauthId);
                    } catch (googleIdErr) {
                        console.log("[REGISTRO] Campo google_id nÃ£o existe, ignorando");
                    }
                }
                
                // Tentar atualizar FotoPerfil separadamente se disponÃ­vel
                if (fotoPerfil) {
                    try {
                        await pool.query(
                            "UPDATE Utilizadores SET FotoPerfil = ? WHERE ReferenciaID = ?",
                            [fotoPerfil, referenciaID]
                        );
                        console.log("[REGISTRO] FotoPerfil atualizado apÃ³s criaÃ§Ã£o");
                    } catch (fotoErr) {
                        console.log("[REGISTRO] Campo FotoPerfil nÃ£o existe, ignorando");
                    }
                }
            } catch (retryError) {
                throw retryError;
            }
        }

        console.log(`[REGISTRO] UsuÃ¡rio criado com ReferenciaID: ${referenciaID}`);

        // Buscar ID do plano FREE
        console.log("[REGISTRO] Buscando plano FREE...");
        const [planoFree] = await pool.query(
            "SELECT Id FROM planos WHERE Nome = 'Free' LIMIT 1"
        );

        const planoFreeId = planoFree.length > 0 ? planoFree[0].Id : 1; // Fallback para ID 1
        console.log(`[REGISTRO] Plano FREE ID: ${planoFreeId}`);

        // Criar configuraÃ§Ã£o do usuÃ¡rio
        console.log("[REGISTRO] Criando configuraÃ§Ã£o do usuÃ¡rio...");
        try {
            // Verificar se jÃ¡ existe configuraÃ§Ã£o para este usuÃ¡rio
            const [existingConfig] = await pool.query(
                "SELECT Id FROM configutilizador WHERE ReferenciaID = ?",
                [referenciaID]
            );

            if (existingConfig.length > 0) {
                // Atualizar configuraÃ§Ã£o existente
                console.log("[REGISTRO] ConfiguraÃ§Ã£o jÃ¡ existe, atualizando...");
                await pool.query(
                    "UPDATE configutilizador SET CanalPreferido = ?, PlanoAtualId = ? WHERE ReferenciaID = ?",
                    ["email", planoFreeId, referenciaID]
                );
                console.log("[REGISTRO] ConfiguraÃ§Ã£o do usuÃ¡rio atualizada");
            } else {
                // Inserir nova configuraÃ§Ã£o
                console.log("[REGISTRO] Inserindo nova configuraÃ§Ã£o...");
                await pool.query(
                    "INSERT INTO configutilizador (ReferenciaID, CanalPreferido, PlanoAtualId) VALUES (?, ?, ?)",
                    [referenciaID, "email", planoFreeId]
                );
                console.log("[REGISTRO] ConfiguraÃ§Ã£o do usuÃ¡rio criada");
            }
        } catch (configError) {
            console.error("[REGISTRO] Erro ao criar configuraÃ§Ã£o do usuÃ¡rio:", configError.message);
            console.error("[REGISTRO] CÃ³digo SQL:", configError.code);
            console.error("[REGISTRO] SQL State:", configError.sqlState);
            console.error("[REGISTRO] Stack trace:", configError.stack);
            // NÃ£o falhar o registro se a configuraÃ§Ã£o falhar - pode ser criada depois
        }

        console.log(`[REGISTRO] UsuÃ¡rio ${nome} registrado com plano FREE (ID: ${planoFreeId})`);

        console.log("[REGISTRO] Gerando cÃ³digo de verificaÃ§Ã£o...");
        const codigo = gerarCodigo();
        console.log(`[REGISTRO] CÃ³digo gerado: ${codigo}`);

        console.log("[REGISTRO] Salvando cÃ³digo no banco de dados...");
        await pool.query("UPDATE Utilizadores SET CodigoEmail=? WHERE ReferenciaID=?", [
            codigo,
            referenciaID,
        ]);
        console.log("[REGISTRO] CÃ³digo salvo no banco de dados");

        // Responder IMEDIATAMENTE ao cliente (antes de enviar email)
        console.log("[REGISTRO] Enviando resposta ao cliente IMEDIATAMENTE...");
        res.json({
            status: "ok",
            message: "Conta criada com sucesso! Verifique seu email para ativar a conta.",
            codigo: codigo // Para desenvolvimento - remover em produÃ§Ã£o
        });
        console.log(" [REGISTRO] Resposta enviada ao cliente");

        // Enviar cÃ³digo por email EM BACKGROUND (nÃ£o bloqueia a resposta)
        console.log("[REGISTRO] Agendando envio de email em background...");
        (async () => {
            try {
                console.log(`[REGISTRO] DestinatÃ¡rio: ${email}`);
                console.log(`[REGISTRO] EMAIL_USER configurado: ${process.env.EMAIL_USER ? `Sim (${process.env.EMAIL_USER})` : 'NAO'}`);
                console.log(`[REGISTRO] EMAIL_PASS configurado: ${process.env.EMAIL_PASS ? 'Sim (***)' : 'NAO'}`);
                console.log(`[REGISTRO] EMAIL_HOST configurado: ${process.env.EMAIL_HOST || 'NÃ£o configurado'}`);
                console.log(`[REGISTRO] EMAIL_PORT configurado: ${process.env.EMAIL_PORT || 'NÃ£o configurado'}`);

                const {
                    sendEmail
                } = await import("../services/notify.js");
                console.log("[REGISTRO] FunÃ§Ã£o sendEmail importada com sucesso");

                const messageHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
          <h2 style="color: #ff6b35; text-align: center;">VerificaÃ§Ã£o de Conta</h2>
          <p>OlÃ¡ <b>${nome}</b>,</p>
          <p>Obrigado por se registrar no <b>PromoPing</b>!</p>
          <p>Use o cÃ³digo abaixo para verificar sua conta:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px solid #ff6b35;">
            <h1 style="color: #ff6b35; font-size: 2.5em; margin: 0; letter-spacing: 5px;">${codigo}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">Este cÃ³digo expira em 10 minutos.</p>
          <p style="color: #666; font-size: 14px;">Se nÃ£o foi vocÃª, ignore este e-mail.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} PromoPing - Todos os direitos reservados</p>
        </div>
      `;

                console.log(`[REGISTRO] Tentando enviar email para: ${email}`);
                console.log(`[REGISTRO] CÃ³digo a ser enviado: ${codigo}`);

                await sendEmail(email, "PromoPing - VerificaÃ§Ã£o de conta", messageHtml);

                console.log(`[REGISTRO] Email enviado com SUCESSO para ${email}`);
                console.log(`[REGISTRO] CÃ³digo de verificaÃ§Ã£o: ${codigo}`);
            } catch (emailError) {
                console.error("[REGISTRO] ========== ERRO AO ENVIAR EMAIL ==========");
                console.error("[REGISTRO] Tipo do erro:", emailError.name);
                console.error("[REGISTRO] Mensagem:", emailError.message);
                console.error("[REGISTRO] CÃ³digo:", emailError.code);
                if (emailError.response) {
                    console.error("[REGISTRO] Resposta do servidor:", emailError.response);
                }
                if (emailError.command) {
                    console.error("[REGISTRO] Comando:", emailError.command);
                }
                console.error("[REGISTRO] Stack trace completo:");
                console.error(emailError.stack);
                console.error("[REGISTRO] ==========================================");

                // NÃ£o falhar o registro se o email falhar, mas logar o erro detalhadamente
                console.log("[REGISTRO] Conta criada com sucesso, mas email nÃ£o foi enviado.");
                console.log("[REGISTRO] Para desenvolvimento, use o cÃ³digo exibido no console ou configure EMAIL_USER e EMAIL_PASS no .env");
                console.log(`[REGISTRO] CÃ³digo de verificaÃ§Ã£o para ${email}: ${codigo}`);
            }
        })();

        // Atualizar mÃ©tricas em background
        console.log("[REGISTRO] Agendando atualizaÃ§Ã£o de mÃ©tricas em background...");
        atualizarMetricasAutomaticamente().catch(metricError => {
            console.error("[REGISTRO] Erro ao atualizar mÃ©tricas apÃ³s criaÃ§Ã£o de utilizador:", metricError.message);
            console.error("[REGISTRO] Stack trace das mÃ©tricas:", metricError.stack);
        });

        console.log("[REGISTRO] Registro concluÃ­do com sucesso!");
    } catch (err) {
        console.error(" [REGISTRO] ERRO CRÃTICO no registro:", err);
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
        const returnTo = req.query.returnTo;
        if (returnTo && typeof returnTo === "string" && returnTo.startsWith("/")) {
            res.cookie("oauth_return_to", returnTo, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 10 * 60 * 1000,
                path: "/"
            });
        }
        console.log(" Google OAuth configurado:");
        console.log("   Client ID:", process.env.GOOGLE_CLIENT_ID.substring(0, 20) + "...");
        console.log("   Client Secret:", process.env.GOOGLE_CLIENT_SECRET.substring(0, 10) + "...");
        passport.authenticate("google", {
            scope: ["profile", "email", "https://www.googleapis.com/auth/calendar.readonly"]
        })(req, res);
    } else {
        console.error(" Google OAuth nÃ£o configurado:");
        console.log("   GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "Presente" : "Ausente");
        console.log("   GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "Presente" : "Ausente");
        res.status(400).json({
            error: "Google OAuth nÃ£o configurado. Configure as credenciais no ficheiro .env",
        });
    }
});

router.get("/google/callback", (req, res) => {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        const loginUrl = process.env.LOGIN_URL || "/login";
        console.log("[GOOGLE CALLBACK] Iniciando callback do Google OAuth");
        console.log("[GOOGLE CALLBACK] Query params:", JSON.stringify(req.query));
        
        passport.authenticate("google", {
            session: false, // NÃ£o usar sessÃµes para OAuth
            failureRedirect: loginUrl
        })(req, res, async (err, googleUser) => {
            // FunÃ§Ã£o auxiliar para salvar dados OAuth em cookie quando houver erro
            const saveOAuthData = (oauthData) => {
                const dataString = JSON.stringify(oauthData);
                res.cookie('oauth_temp_data', dataString, {
                    httpOnly: false, // Precisa ser acessÃ­vel via JavaScript
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 15 * 60 * 1000 // 15 minutos
                });
                console.log("[GOOGLE CALLBACK] Dados OAuth salvos temporariamente:", oauthData);
            };

            if (err) {
                console.error("[GOOGLE CALLBACK] Erro na autenticaÃ§Ã£o Google:", err);
                console.error("[GOOGLE CALLBACK] Stack trace:", err.stack);
                const errorDetails = err.message || 'Erro desconhecido';
                
                // Tentar obter dados do profile mesmo com erro (se disponÃ­vel)
                // Isso pode nÃ£o funcionar se o erro ocorrer antes do profile ser retornado
                return res.redirect(`${loginUrl}?error=auth_failed&details=${encodeURIComponent(errorDetails)}`);
            }

            // Tentar obter o usuÃ¡rio de vÃ¡rias fontes (sem sessÃµes)
            let user = googleUser || req.user;
            
            console.log("[GOOGLE CALLBACK] googleUser:", googleUser ? JSON.stringify(googleUser, null, 2) : "undefined");
            console.log("[GOOGLE CALLBACK] req.user:", req.user ? JSON.stringify(req.user, null, 2) : "undefined");
            
            if (!user) {
                console.error("[GOOGLE CALLBACK] UsuÃ¡rio estÃ¡ undefined apÃ³s autenticaÃ§Ã£o");
                return res.redirect(`${loginUrl}?error=user_undefined`);
            }

            // Verificar se user tem os campos necessÃ¡rios
            if (!user.ReferenciaID || !user.email) {
                console.error("[GOOGLE CALLBACK] user nÃ£o tem campos necessÃ¡rios:", {
                    hasReferenciaID: !!user.ReferenciaID,
                    hasEmail: !!user.email,
                    user: user
                });
                
                // Salvar dados OAuth disponÃ­veis para permitir completar registro/login
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
                
                return res.redirect(`${loginUrl}?error=user_incomplete&details=${encodeURIComponent('Dados do usuÃ¡rio incompletos')}`);
            }

            try {
                // Garantir que google_id estÃ¡ salvo no banco
                if (user.googleId) {
                    try {
                        await pool.query(
                            "UPDATE Utilizadores SET google_id = ? WHERE ReferenciaID = ?",
                            [user.googleId, user.ReferenciaID]
                        );
                        console.log("[GOOGLE CALLBACK] google_id salvo no banco:", user.googleId);
                    } catch (dbError) {
                        console.log("[GOOGLE CALLBACK] Erro ao salvar google_id (coluna pode nÃ£o existir):", dbError.message);
                        // Continuar mesmo se falhar - nÃ£o Ã© crÃ­tico
                    }
                }

                // Salvar tokens OAuth se disponÃ­veis
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
                             ON CONFLICT (ReferenciaID) DO UPDATE SET
                                 access_token = EXCLUDED.access_token,
                                 refresh_token = EXCLUDED.refresh_token,
                                 expires_at = EXCLUDED.expires_at,
                                 scope = EXCLUDED.scope,
                                 updated_at = NOW()`,
                            [user.ReferenciaID, user.accessToken, user.refreshToken || null, expiresAt, 'calendar.readonly']
                        );
                        console.log("[GOOGLE CALLBACK] Tokens OAuth salvos para sincronizaÃ§Ã£o");
                    } catch (tokenErr) {
                        console.error("[GOOGLE CALLBACK] Erro ao salvar tokens OAuth:", tokenErr);
                        // NÃ£o falhar o login se nÃ£o conseguir salvar tokens
                    }
                }

                const { token, refreshToken } = gerarParesToken(user.ReferenciaID, user.email);

                console.log("[GOOGLE CALLBACK] Token JWT gerado com sucesso para usuÃ¡rio:", user.ReferenciaID);

                const returnTo = req.cookies?.oauth_return_to;
                const redirectPath = (returnTo && typeof returnTo === "string" && returnTo.startsWith("/")) ? returnTo : "/dashboard";

                const escapedEmail = (user.email || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
                const escapedNome = (user.nome || user.name || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
                const escapedRedirect = redirectPath.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
                
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
            window.location.href = '${escapedRedirect}';
          </script>
          <p>Redirecionando...</p>
        </body>
        </html>
      `;
                
                res.clearCookie("oauth_return_to", { path: "/" });
                console.log("[GOOGLE CALLBACK] Redirecionando para:", redirectPath);
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
        console.error("Google OAuth nÃ£o configurado");
        res.status(400).json({
            error: "Google OAuth nÃ£o configurado. Configure as credenciais no ficheiro .env",
        });
    }
});

//rotas onde Ã© usado o github
router.get("/github", (req, res) => {
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
        console.log(" GitHub OAuth configurado:");
        console.log("   Client ID:", process.env.GITHUB_CLIENT_ID.substring(0, 20) + "...");
        console.log("   Client Secret:", process.env.GITHUB_CLIENT_SECRET.substring(0, 10) + "...");
        passport.authenticate("github", {
            scope: ["user:email"]
        })(req, res);
    } else {
        console.error(" GitHub OAuth nÃ£o configurado:");
        console.log("   GITHUB_CLIENT_ID:", process.env.GITHUB_CLIENT_ID ? "Presente" : "Ausente");
        console.log("   GITHUB_CLIENT_SECRET:", process.env.GITHUB_CLIENT_SECRET ? "Presente" : "Ausente");
        res.status(400).json({
            error: "GitHub OAuth nÃ£o configurado. Configure as credenciais no ficheiro .env",
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
                console.error("Erro na autenticaÃ§Ã£o GitHub:", err);
                return res.redirect(`${loginUrl}?error=auth_failed`);
            }

            if (!req.user) {
                console.error("req.user estÃ¡ undefined");
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
            error: "GitHub OAuth nÃ£o configurado. Configure as credenciais no ficheiro .env",
        });
    }
});


router.get("/discord", (req, res) => {
    if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
        // Armazenar parÃ¢metros na sessÃ£o (se disponÃ­vel) ou usar cookies como fallback
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
            error: "Discord OAuth nÃ£o configurado. Configure as credenciais no ficheiro .env",
        });
    }
});

router.get("/discord/callback", async (req, res) => {
    console.log(" Discord callback recebido:", JSON.stringify(req.query));
    
    // Verificar se hÃ¡ erro do Discord
    if (req.query.error) {
        console.error(" Erro retornado pelo Discord:", req.query.error);
        console.error(" DescriÃ§Ã£o do erro:", req.query.error_description);
        const fromProfile = req.query.state && req.query.state.includes('from=profile');
        const redirectUrl = fromProfile ? '/dashboard/perfil?error=discord_connection_failed' : `/login?error=discord_${req.query.error}&description=${encodeURIComponent(req.query.error_description || '')}`;
        return res.redirect(redirectUrl);
    }

    if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
        // Usar uma abordagem diferente: fazer authenticate primeiro, depois processar
        passport.authenticate("discord", {
            session: false
        })(req, res, async (err, discordUser) => {
            console.log(" [DISCORD CALLBACK] ========== INÃCIO DO CALLBACK ==========");
            console.log(" [DISCORD CALLBACK] Erro recebido:", err ? err.message : "Nenhum erro");
            console.log(" [DISCORD CALLBACK] DiscordUser recebido do passport:", discordUser ? JSON.stringify(discordUser, null, 2) : "null/undefined");
            console.log(" [DISCORD CALLBACK] Query params:", JSON.stringify(req.query));
            console.log(" [DISCORD CALLBACK] State:", req.query.state);
            console.log(" [DISCORD CALLBACK] req.user:", req.user ? JSON.stringify(req.user, null, 2) : "null/undefined");
            console.log(" [DISCORD CALLBACK] req.isAuthenticated:", req.isAuthenticated ? req.isAuthenticated() : "mÃ©todo nÃ£o disponÃ­vel");
            
            if (err) {
                console.error(" [DISCORD CALLBACK] ERRO na autenticaÃ§Ã£o Discord:", err);
                console.error(" [DISCORD CALLBACK] Stack trace:", err.stack);
                
                // Determinar tipo de erro especÃ­fico
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

            // Tentar obter o usuÃ¡rio de vÃ¡rias fontes
            if (!discordUser) {
                console.log(" [DISCORD CALLBACK] discordUser Ã© null, tentando req.user...");
                discordUser = req.user;
            }
            
            if (!discordUser) {
                console.error(" [DISCORD CALLBACK] ERRO CRÃTICO: discordUser Ã© null/undefined apÃ³s todas as tentativas");
                console.error(" [DISCORD CALLBACK] Query params completos:", JSON.stringify(req.query));
                console.error(" [DISCORD CALLBACK] req.user:", req.user);
                console.error(" [DISCORD CALLBACK] req.session:", req.session);
                console.error(" [DISCORD CALLBACK] Verificando se a estratÃ©gia foi executada...");
                
                // Se chegou aqui, a estratÃ©gia pode nÃ£o ter sido executada ou nÃ£o chamou done()
                const fromProfile = req.query.state && req.query.state.includes('from=profile');
                const redirectUrl = fromProfile ? '/dashboard/perfil?error=discord_user_not_found' : '/login?error=discord_user_not_found';
                return res.redirect(redirectUrl);
            }

            console.log(" [DISCORD CALLBACK] UsuÃ¡rio Discord autenticado com sucesso!");
            console.log(" [DISCORD CALLBACK] Email:", discordUser.email);
            console.log(" [DISCORD CALLBACK] ReferenciaID:", discordUser.ReferenciaID);
            console.log(" [DISCORD CALLBACK] DiscordId:", discordUser.discordId);

            // Verificar se veio do perfil (usuÃ¡rio jÃ¡ logado querendo conectar)
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
                    // Limpar cookies apÃ³s uso
                    res.clearCookie('discord_connect_token');
                    res.clearCookie('discord_connect_from');
                    
                    // Verificar token JWT do usuÃ¡rio logado
                    const decoded = jwt.verify(tokenFromProfile, process.env.JWT_SECRET);
                    const loggedInReferenciaID = decoded.ReferenciaID;
                    
                    console.log(` Associando Discord ao usuÃ¡rio logado: ${loggedInReferenciaID}`);

                    // Obter discordId do objeto retornado pela estratÃ©gia (agora incluÃ­do)
                    const discordIdToLink = discordUser.discordId;
                    
                    if (!discordIdToLink) {
                        console.error(" Discord ID nÃ£o encontrado no objeto de autenticaÃ§Ã£o");
                        throw new Error("NÃ£o foi possÃ­vel obter o ID do Discord");
                    }

                    // Verificar se o Discord jÃ¡ estÃ¡ associado a outro usuÃ¡rio
                    const existingDiscordUser = findDiscordUser(discordIdToLink);
                    
                    if (existingDiscordUser && existingDiscordUser.ReferenciaID && existingDiscordUser.ReferenciaID !== loggedInReferenciaID) {
                        // Discord jÃ¡ estÃ¡ associado a outro usuÃ¡rio
                        const html = `
                            <!DOCTYPE html>
                            <html>
                            <head>
                              <title>Discord Conectado - PromoPing</title>
                            </head>
                            <body>
                              <script>
                                alert('Esta conta Discord jÃ¡ estÃ¡ associada a outra conta.');
                                window.location.href = '/dashboard/perfil';
                              </script>
                              <p>Redirecionando...</p>
                            </body>
                            </html>
                          `;
                        return res.send(html);
                    }

                    // Associar Discord ao usuÃ¡rio logado
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
                        console.error(" [DISCORD CALLBACK] Erro ao atualizar discord_id (coluna pode nÃ£o existir):", dbError.message);
                        // Continuar mesmo se falhar - o linkDiscordUser jÃ¡ foi feito
                    }

                    // Inserir ou atualizar na tabela contasconectadas
                    try {
                        await pool.query(
                            "INSERT INTO contasconectadas (ReferenciaID, Tipo, Conectado, DataConexao) VALUES (?, 'discord', 1, NOW()) ON CONFLICT (ReferenciaID, Tipo) DO UPDATE SET Conectado = 1, DataConexao = NOW()",
                            [loggedInReferenciaID]
                        );
                        console.log(" [DISCORD CALLBACK] Discord inserido/atualizado em contasconectadas");
                    } catch (contasError) {
                        console.error(" [DISCORD CALLBACK] Erro ao inserir em contasconectadas:", contasError.message);
                        // Continuar mesmo se falhar
                    }

                    console.log(` Discord ${discordIdToLink} associado ao usuÃ¡rio ${loggedInReferenciaID}`);

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

            // Login normal (nÃ£o veio do perfil ou token invÃ¡lido)
            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Discord Login - PromoPing</title>
        </head>
        <body>
          <script>
            // Salvar dados do usuÃ¡rio no localStorage
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
        console.error(" Discord OAuth nÃ£o configurado");
        res.status(400).json({
            error: "Discord OAuth nÃ£o configurado. Configure as credenciais no ficheiro .env",
        });
    }
});


// WhatsApp foi removido do sistema - apenas Email e Discord disponÃ­veis
// Se precisar verificar telefone, use a rota de verificaÃ§Ã£o de email

// Verificar email - enviar cÃ³digo por email
router.post("/verificar/email", verifyToken, async (req, res) => {
    try {
        const referenciaID = req.user.ReferenciaID;
        const codigo = gerarCodigo();

        // Buscar email do usuÃ¡rio
        const [userRows] = await pool.query(
            "SELECT Email, Nome FROM Utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                status: "error",
                error: "UsuÃ¡rio nÃ£o encontrado",
            });
        }

        const user = userRows[0];

        // Salvar cÃ³digo no banco
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
        <h2> VerificaÃ§Ã£o de Conta</h2>
        <p>OlÃ¡ <b>${user.Nome}</b> ,</p>
        <p>Use o cÃ³digo abaixo para verificar sua conta:</p>
        <h1 style="color: #ff6b35; font-size: 2em; text-align: center; margin: 20px 0;">${codigo}</h1>
        <p>Este cÃ³digo expira em 10 minutos.</p>
        <p>Se nÃ£o foi vocÃª, ignore este e-mail.</p>
        <hr>
        <p style="color: #666; font-size: 0.9em;">&copy; ${new Date().getFullYear()} PromoPing</p>
      `;

            await sendEmail(user.Email, "PromoPing - VerificaÃ§Ã£o de conta", messageHtml);
            console.log(` CÃ³digo de verificaÃ§Ã£o enviado para ${user.Email}: ${codigo}`);
        } catch (emailError) {
            console.log(" Email nÃ£o configurado, mas cÃ³digo salvo:", codigo);
        }

        res.json({
            status: "ok",
            message: "CÃ³digo enviado por email!",
        });
    } catch (err) {
        console.error(" Erro ao enviar cÃ³digo por email:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao enviar cÃ³digo de verificaÃ§Ã£o",
        });
    }
});

// Validar cÃ³digo de verificaÃ§Ã£o
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
                error: "CÃ³digo e tipo sÃ£o obrigatÃ³rios",
            });
        }

        if (!['email', 'telefone'].includes(tipo)) {
            return res.status(400).json({
                status: "error",
                error: "Tipo deve ser 'email' ou 'telefone'",
            });
        }

        // Buscar usuÃ¡rio e verificar cÃ³digo
        const campoCodigo = tipo === 'email' ? 'CodigoEmail' : 'CodigoTelefone';
        const [userRows] = await pool.query(
            `SELECT ${USER_SELECT_FIELDS}
             FROM Utilizadores
             WHERE ReferenciaID = ? AND ${campoCodigo} = ?`,
            [referenciaID, codigo]
        );

        if (userRows.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "CÃ³digo invÃ¡lido ou expirado",
            });
        }

        // Marcar como verificado
        if (tipo === 'email') {
            await pool.query(
                "UPDATE Utilizadores SET EmailVerificado = 1, CodigoEmail = NULL WHERE ReferenciaID = ?",
                [referenciaID]
            );
        } else {
            // Para telefone, podemos adicionar um campo TelefoneVerificado se necessÃ¡rio
            await pool.query(
                "UPDATE Utilizadores SET CodigoTelefone = NULL WHERE ReferenciaID = ?",
                [referenciaID]
            );
        }

        console.log(` ${tipo} verificado com sucesso para usuÃ¡rio ${referenciaID}`);

        res.json({
            status: "ok",
            message: `${tipo === 'email' ? 'Email' : 'Telefone'} verificado com sucesso!`,
        });
    } catch (err) {
        console.error(" Erro ao validar cÃ³digo:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao validar cÃ³digo",
        });
    }
});

// Esqueci a senha - enviar cÃ³digo
router.post("/esqueci-senha", async (req, res) => {
    try {
        const {
            emailOuTelefone
        } = req.body;

        if (!emailOuTelefone) {
            return res.status(400).json({
                status: "error",
                error: "Email ou telefone Ã© obrigatÃ³rio",
            });
        }

        // WhatsApp foi removido - apenas email disponÃ­vel para recuperaÃ§Ã£o de senha
        // Verificar se Ã© email vÃ¡lido
        if (!emailOuTelefone.includes('@')) {
            return res.status(400).json({
                status: "error",
                error: "Apenas email Ã© suportado para recuperaÃ§Ã£o de senha. WhatsApp foi removido.",
            });
        }

        // Buscar por email
        const [userRows] = await pool.query(
            `SELECT ${USER_SELECT_FIELDS}
             FROM Utilizadores
             WHERE Email = ?`,
            [emailOuTelefone]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                status: "error",
                error: "UsuÃ¡rio nÃ£o encontrado",
            });
        }

        const user = userRows[0];
        const codigo = gerarCodigo();

        // Salvar cÃ³digo no banco
        await pool.query(
            "UPDATE Utilizadores SET CodigoEmail = ? WHERE ReferenciaID = ?",
            [codigo, user.ReferenciaID]
        );

        // Enviar por email
        const emailResult = await enviarEmail(
            user.Email,
            "PromoPing - RecuperaÃ§Ã£o de senha",
            `OlÃ¡ ${user.Nome}!\n\nVocÃª solicitou a recuperaÃ§Ã£o de senha.\n\nSeu cÃ³digo Ã©: ${codigo}\n\nEste cÃ³digo expira em 10 minutos.\n\nSe nÃ£o foi vocÃª, ignore este e-mail.\n\nPromoPing`
        );

        if (emailResult.success) {
            console.log(` CÃ³digo de recuperaÃ§Ã£o enviado para ${user.Email}: ${codigo}`);
        } else {
            console.log(" Email nÃ£o configurado, mas cÃ³digo salvo:", codigo);
        }

        res.json({
            status: "ok",
            message: "CÃ³digo enviado por email!",
            canal: 'email'
        });
    } catch (err) {
        console.error(" Erro na recuperaÃ§Ã£o de senha:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao processar recuperaÃ§Ã£o de senha",
        });
    }
});

// Resetar senha com cÃ³digo
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
                error: "Email/telefone, cÃ³digo e nova senha sÃ£o obrigatÃ³rios",
            });
        }

        if (novaSenha.length < 6) {
            return res.status(400).json({
                status: "error",
                error: "A nova senha deve ter pelo menos 6 caracteres",
            });
        }

        // WhatsApp foi removido - apenas email disponÃ­vel para reset de senha
        // Verificar se Ã© email vÃ¡lido
        if (!emailOuTelefone.includes('@')) {
            return res.status(400).json({
                status: "error",
                error: "Apenas email Ã© suportado para reset de senha. WhatsApp foi removido.",
            });
        }

        // Buscar por email e verificar cÃ³digo de email
        const [userRows] = await pool.query(
            `SELECT ${USER_SELECT_FIELDS}
             FROM Utilizadores
             WHERE Email = ? AND CodigoEmail = ?`,
            [emailOuTelefone, codigo]
        );

        if (userRows.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "CÃ³digo invÃ¡lido ou expirado",
            });
        }

        const user = userRows[0];

        // Hash da nova senha
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(novaSenha, saltRounds);

        // Atualizar senha e limpar cÃ³digos
        await pool.query(
            "UPDATE Utilizadores SET SenhaHash = ?, CodigoEmail = NULL, CodigoTelefone = NULL WHERE ReferenciaID = ?",
            [hashedPassword, user.ReferenciaID]
        );

        console.log(` Senha redefinida com sucesso para usuÃ¡rio ${user.ReferenciaID} via email`);

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


// Reenviar cÃ³digo de verificaÃ§Ã£o (para usuÃ¡rios nÃ£o logados)
router.post("/reenviar-codigo", async (req, res) => {
    try {
        const {
            email
        } = req.body;

        if (!email) {
            return res.status(400).json({
                status: "error",
                error: "Email Ã© obrigatÃ³rio",
            });
        }

        // Buscar usuÃ¡rio
        const [userRows] = await pool.query(
            `SELECT ${USER_SELECT_FIELDS}
             FROM Utilizadores
             WHERE Email = ?`,
            [email]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                status: "error",
                error: "UsuÃ¡rio nÃ£o encontrado",
            });
        }

        const user = userRows[0];

        // Se jÃ¡ estÃ¡ verificado, nÃ£o precisa reenviar
        if (user.EmailVerificado) {
            return res.status(400).json({
                status: "error",
                error: "Email jÃ¡ estÃ¡ verificado",
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
        <h2> CÃ³digo de VerificaÃ§Ã£o</h2>
        <p>OlÃ¡ <b>${user.Nome}</b> ,</p>
        <p>VocÃª solicitou um novo cÃ³digo de verificaÃ§Ã£o:</p>
        <h1 style="color: #ff6b35; font-size: 2em; text-align: center; margin: 20px 0;">${codigo}</h1>
        <p>Este cÃ³digo expira em 10 minutos.</p>
        <p>Se nÃ£o foi vocÃª, ignore este e-mail.</p>
        <hr>
        <p style="color: #666; font-size: 0.9em;">&copy; ${new Date().getFullYear()} PromoPing</p>
      `;

            await sendEmail(user.Email, "PromoPing - Novo cÃ³digo de verificaÃ§Ã£o", messageHtml);
            console.log(` Novo cÃ³digo de verificaÃ§Ã£o enviado para ${user.Email}: ${codigo}`);
        } catch (emailError) {
            console.log(" Email nÃ£o configurado, mas cÃ³digo salvo:", codigo);
        }

        // WhatsApp foi removido do sistema - apenas email disponÃ­vel

        res.json({
            status: "ok",
            message: "CÃ³digo reenviado com sucesso!",
        });
    } catch (err) {
        console.error(" Erro ao reenviar cÃ³digo:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao reenviar cÃ³digo",
        });
    }
});

// Verificar cÃ³digo sem login (para usuÃ¡rios nÃ£o logados)
router.post("/verificar-codigo", async (req, res) => {
    try {
        const {
            email,
            codigo
        } = req.body;

        if (!email || !codigo) {
            return res.status(400).json({
                status: "error",
                error: "Email e cÃ³digo sÃ£o obrigatÃ³rios",
            });
        }

        // Buscar usuÃ¡rio e verificar cÃ³digo
        const [userRows] = await pool.query(
            `SELECT ${USER_SELECT_FIELDS}
             FROM Utilizadores
             WHERE Email = ? AND CodigoEmail = ?`,
            [email, codigo]
        );

        if (userRows.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "CÃ³digo invÃ¡lido ou expirado",
            });
        }

        const user = userRows[0];

        // Marcar como verificado
        await pool.query(
            "UPDATE Utilizadores SET EmailVerificado = 1, CodigoEmail = NULL WHERE ReferenciaID = ?",
            [user.ReferenciaID]
        );

        const { token, refreshToken } = gerarParesToken(user.ReferenciaID, user.Email);

        console.log(` Email verificado com sucesso para usuÃ¡rio ${user.ReferenciaID}`);

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
        console.error(" Erro ao verificar cÃ³digo:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao verificar cÃ³digo",
        });
    }
});


// Atualizar telefone do usuÃ¡rio
router.put("/telefone", verifyToken, async (req, res) => {
    try {
        const {
            telefone
        } = req.body;
        const referenciaID = req.user.ReferenciaID;

        if (!telefone) {
            return res.status(400).json({
                status: "error",
                error: "Telefone Ã© obrigatÃ³rio",
            });
        }

        // Validar formato do telefone (bÃ¡sico)
        const telefoneRegex = /^[0-9+\-\s()]{9,15}$/;
        if (!telefoneRegex.test(telefone)) {
            return res.status(400).json({
                status: "error",
                error: "Formato de telefone invÃ¡lido",
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

// Buscar dados do usuÃ¡rio
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
                error: "UsuÃ¡rio nÃ£o encontrado",
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
            
            // Verificar se os dados nÃ£o expiraram (15 minutos)
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

// Rota para limpar dados OAuth temporÃ¡rios
router.post("/oauth-temp-data/clear", (req, res) => {
    res.clearCookie('oauth_temp_data');
    res.json({
        status: "ok",
        message: "Dados OAuth temporÃ¡rios limpos"
    });
});

export default router;
