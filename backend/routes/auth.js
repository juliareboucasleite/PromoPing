// @ts-nocheck
import express from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as DiscordStrategy } from "passport-discord";
import { pool } from "../database/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { verifyToken } from "../middleware/auth.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { findDiscordUser, registerDiscordUser, linkDiscordUser } from "../utils/discord-users.js";
import { getCachedDiscordUser, setCachedDiscordUser } from "../utils/discord-cache.js";

dotenv.config({ path: path.resolve(process.cwd(), '.env') }); // Garante que .env está sendo lido da raiz

const router = express.Router();

function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Função para enviar email
async function enviarEmail(to, subject, text) {
  try {
    const { sendEmail } = await import("../services/notify.js");
    await sendEmail(to, subject, text);
    console.log(` Email enviado para ${to}`);
    return { success: true };
  } catch (error) {
    console.error(" Erro ao enviar email:", error);
    return { success: false, error: error.message };
  }
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://127.0.0.1:3000/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value;
          const googleId = profile.id;

          const [rows] = await pool.query(
            "SELECT * FROM Utilizadores WHERE Email = ?",
            [email]
          );

          let userId;
          if (rows.length > 0) {
            userId = rows[0].Id;
            // Usuário já existe, apenas atualizar dados se necessário
            console.log("Usuário Google já existe:", email);
          } else {
            const [result] = await pool.query(
              "INSERT INTO Utilizadores (Nome, Email, Telefone) VALUES (?, ?, ?)",
              [profile.displayName, email, null]
            );
            userId = result.insertId;
          }

          await pool.query(
            `INSERT INTO ConfigUtilizador (UserId, Email, CanalPreferido) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE Email = VALUES(Email)`,
            [userId, email, "email"]
          );

          return done(null, { id: userId, email });
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
} else {
  // Google OAuth não configurado - silencioso
}

// ================== DISCORD STRATEGY ==================
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  passport.use(
    new DiscordStrategy(
      {
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: "http://127.0.0.1:3000/auth/discord/callback",
        scope: ['identify', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log(" Discord profile recebido:", {
            id: profile.id,
            username: profile.username,
            email: profile.email,
            avatar: profile.avatar
          });

          const email = profile.email;
          const discordId = profile.id;
          const username = profile.username;
          const avatar = profile.avatar;

          // Verificar se usuário Discord já existe no JSON
          let discordUser = findDiscordUser(discordId);
          
          if (discordUser && discordUser.userId) {
            // Usuário Discord já existe e está associado - LOGIN DIRETO
            console.log(" Usuário Discord já registrado - Login direto:", discordUser.username);
            
            const token = jwt.sign(
              { id: discordUser.userId, email: discordUser.email },
              process.env.JWT_SECRET,
              { expiresIn: "7d" }
            );

            console.log(" Login direto realizado para usuário:", discordUser.userId);
            return done(null, { userId: discordUser.userId, email: discordUser.email, token });
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

    let userId;
          if (rows.length > 0) {
            // Usuário já existe no banco - ASSOCIAR DISCORD
            console.log(" Usuário existente encontrado - Associando Discord:", rows[0].Nome);
            userId = rows[0].Id;
            
            // Associar Discord com usuário do banco
            linkDiscordUser(discordId, userId);
    } else {
            // Criar novo usuário no banco
            console.log("🆕 Criando novo usuário no banco:", username);
      const [result] = await pool.query(
              "INSERT INTO Utilizadores (Nome, Email, Ativo) VALUES (?, ?, 1)",
              [username, email]
      );
      userId = result.insertId;
            
            // Buscar ID do plano FREE
            const [planoFree] = await pool.query(
              "SELECT Id FROM planos WHERE Nome = 'Free' LIMIT 1"
            );
            
            const planoFreeId = planoFree.length > 0 ? planoFree[0].Id : 1; // Fallback para ID 1

            // Criar configuração do usuário com plano FREE
            await pool.query(
              "INSERT INTO ConfigUtilizador (UserId, Email, CanalPreferido, PlanoAtualId) VALUES (?, ?, ?, ?)",
              [userId, email, "discord", planoFreeId]
            );
            
            console.log(` Usuário Discord ${username} registrado com plano FREE (ID: ${planoFreeId})`);
            
            // Associar Discord com novo usuário
            linkDiscordUser(discordId, userId);
          }

          const token = jwt.sign(
            { id: userId, email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
          );

          console.log(" Token JWT gerado para usuário:", userId);
          return done(null, { userId, email, token });
        } catch (error) {
          console.error(" Erro na autenticação Discord:", error);
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
    const { discordId } = req.params;
    const discordUser = findDiscordUser(discordId);
    
    if (discordUser && discordUser.userId) {
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
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Rota alternativa para Discord sem rate limiting
router.get('/discord/direct/:discordId', async (req, res) => {
  try {
    const { discordId } = req.params;
    const discordUser = findDiscordUser(discordId);
    
    if (discordUser && discordUser.userId) {
      // Gerar token diretamente
    const token = jwt.sign(
        { id: discordUser.userId, email: discordUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

      console.log(" Login direto via rota alternativa para usuário:", discordUser.userId);
      
      // Criar página HTML que salva no localStorage e redireciona
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
              id: ${discordUser.userId},
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
      res.status(404).json({ error: "Usuário Discord não encontrado" });
    }
  } catch (error) {
    console.error(" Erro no login direto Discord:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ================== ROTAS SMS/WHATSAPP REMOVIDAS ==================
// Serviços SMS e WhatsApp foram removidos - apenas Email e Discord disponíveis

// ================== ROTAS EMAIL/SENHA ==================

// LOGIN com email e senha
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
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
        error:
          "Conta não tem senha configurada. Use Google ou configure uma senha no perfil.",
      });
    }

    // Verifica senha
    const validPassword = await bcrypt.compare(password, user.SenhaHash);
    console.log(" Senha válida?:", validPassword);

    if (!validPassword) {
      return res.status(400).json({
        status: "error",
        error: "Email ou senha incorretos",
      });
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

    // Gera token JWT
    const token = jwt.sign(
      { id: user.Id, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      status: "ok",
      token,
      user: { id: user.Id, email: user.Email, nome: user.Nome },
    });
  } catch (err) {
    console.error(" Erro no login:", err);
    res.status(500).json({
      status: "error",
      error: err.message || "Erro interno no servidor",
    });
  }
});

// REGISTO com email e senha
router.post("/register", async (req, res) => {
  try {
    const { nome, email, password, telefone } = req.body;
    console.log(" Registro tentativa:", email);

    if (!nome || !email || !password) {
      return res.status(400).json({
        status: "error",
        error: "Nome, email e senha são obrigatórios",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: "error",
        error: "A senha deve ter pelo menos 6 caracteres",
      });
    }

    const [existing] = await pool.query(
      "SELECT Id FROM Utilizadores WHERE Email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        status: "error",
        error: "Email já está em uso",
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const [result] = await pool.query(
      "INSERT INTO Utilizadores (Nome, Email, SenhaHash, EmailVerificado, Telefone) VALUES (?, ?, ?, ?, ?)",
      [nome, email, hashedPassword, 0, telefone || null]
    );

    const userId = result.insertId;

    // Buscar ID do plano FREE
    const [planoFree] = await pool.query(
      "SELECT Id FROM planos WHERE Nome = 'Free' LIMIT 1"
    );
    
    const planoFreeId = planoFree.length > 0 ? planoFree[0].Id : 1; // Fallback para ID 1

    await pool.query(
      "INSERT INTO ConfigUtilizador (UserId, Email, CanalPreferido, PlanoAtualId) VALUES (?, ?, ?, ?)",
      [userId, email, "email", planoFreeId]
    );
    
    console.log(` Usuário ${nome} registrado com plano FREE (ID: ${planoFreeId})`);

    const codigo = gerarCodigo();
    await pool.query("UPDATE Utilizadores SET CodigoEmail=? WHERE Id=?", [
      codigo,
      userId,
    ]);

    // Enviar código por email
    try {
      const { sendEmail } = await import("../services/notify.js");
      const messageHtml = `
        <h2> Verificação de Conta</h2>
        <p>Olá <b>${nome}</b> ,</p>
        <p>Obrigado por se registrar no <b>PromoPing</b>!</p>
        <p>Use o código abaixo para verificar sua conta:</p>
        <h1 style="color: #ff6b35; font-size: 2em; text-align: center; margin: 20px 0;">${codigo}</h1>
        <p>Este código expira em 10 minutos.</p>
        <p>Se não foi você, ignore este e-mail.</p>
        <hr>
        <p style="color: #666; font-size: 0.9em;">&copy; ${new Date().getFullYear()} PromoPing</p>
      `;
      await sendEmail(email, "PromoPing - Verificação de conta", messageHtml);
      console.log(`Código de verificação enviado para ${email}: ${codigo}`);
    } catch (emailError) {
      console.log("Email não configurado, mas conta criada com sucesso");
    }

    // WhatsApp desabilitado
    // if (telefone) {
    //   try {
    //     const telefoneLimpo = telefone.replace(/[^\d]/g, '');
    //     await enviarWhatsApp(
    //       telefoneLimpo,
    //       `Seu código de verificação é: ${codigo}\n\nEste código expira em 10 minutos.\n\nSe não foi você, ignore esta mensagem.`
    //     );
    //     console.log(`Código de verificação enviado para ${telefone}: ${codigo}`);
    //   } catch (whatsappError) {
    //     console.log("WhatsApp não configurado, mas conta criada com sucesso");
    //   }
    // }

    res.json({
      status: "ok",
      message: "Conta criada com sucesso! Verifique seu email para ativar a conta.",
      codigo: codigo // Para desenvolvimento - remover em produção
    });
  } catch (err) {
    console.error("Erro no registo:", err);
    res.status(500).json({
      status: "error",
      error: err.message || "Erro interno no servidor",
    });
  }
});

// ================== ROTAS GOOGLE ==================
router.get("/google", (req, res) => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    console.log(" Google OAuth configurado:");
    console.log("   Client ID:", process.env.GOOGLE_CLIENT_ID.substring(0, 20) + "...");
    console.log("   Client Secret:", process.env.GOOGLE_CLIENT_SECRET.substring(0, 10) + "...");
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res);
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
    passport.authenticate("google", { failureRedirect: loginUrl })(req, res, (err) => {
      if (err) {
        console.error("Erro na autenticação Google:", err);
        return res.redirect(`${loginUrl}?error=auth_failed`);
      }

      if (!req.user) {
        console.error("req.user está undefined");
        return res.redirect(`${loginUrl}?error=user_undefined`);
      }

      try {
        const token = jwt.sign(
          { id: req.user.id, email: req.user.email, nome: req.user.nome },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        const panelUrl = process.env.AFTER_LOGIN_REDIRECT || "/dashboard/painel";
        res.redirect(`${panelUrl}?token=${token}`);
      } catch (tokenError) {
        console.error("Erro ao gerar token:", tokenError);
        res.redirect(`${loginUrl}?error=token_error`);
      }
    });
  } else {
    res.status(400).json({
      error: "Google OAuth não configurado. Configure as credenciais no ficheiro .env",
    });
  }
});

// ================== ROTAS DISCORD ==================

router.get("/discord", (req, res) => {
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    passport.authenticate("discord", { scope: ['identify', 'email'] })(req, res);
  } else {
    res.status(400).json({
      error:
        "Discord OAuth não configurado. Configure as credenciais no ficheiro .env",
    });
  }
});

router.get("/discord/callback", (req, res) => {
  console.log(" Discord callback recebido:", JSON.stringify(req.query));
  
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    passport.authenticate("discord", { 
      failureRedirect: "/login?error=discord_auth_failed"
    })(req, res, (err, user) => {
      if (err) {
        console.error(" Erro na autenticação Discord:", err);
        return res.redirect("/login?error=discord_auth_failed");
      }
      
      if (!user) {
        console.error(" Usuário Discord não encontrado");
        return res.redirect("/login?error=discord_auth_failed");
      }
      
      console.log(" Usuário Discord autenticado:", user.email);
      
      // Criar página HTML que salva no localStorage e redireciona
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
              id: ${user.userId},
              email: '${user.email}',
              token: '${user.token}',
              loginMethod: 'discord'
            }));
            
            // Salvar token separadamente para compatibilidade com auth.js
            localStorage.setItem('token', '${user.token}');
            
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
      error:
        "Discord OAuth não configurado. Configure as credenciais no ficheiro .env",
    });
  }
});

// ================== ROTAS DE VERIFICAÇÃO ==================

// Verificar telefone - enviar código por WhatsApp
router.post("/verificar/telefone", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const codigo = gerarCodigo();

    // Buscar telefone do usuário
    const [userRows] = await pool.query(
      "SELECT Telefone, Nome FROM Utilizadores WHERE Id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        status: "error",
        error: "Usuário não encontrado",
      });
    }

    const user = userRows[0];

    if (!user.Telefone) {
      return res.status(400).json({
        status: "error",
        error: "Telefone não cadastrado. Adicione um telefone no perfil primeiro.",
      });
    }

    // Salvar código no banco
    await pool.query(
      "UPDATE Utilizadores SET CodigoTelefone = ? WHERE Id = ?",
      [codigo, userId]
    );

    // Enviar WhatsApp
    const telefoneLimpo = user.Telefone.replace(/[^\d]/g, ''); // Remove caracteres não numéricos
    const resultadoWhatsApp = await enviarWhatsApp(
      telefoneLimpo,
      ` Seu código de verificação é: ${codigo}\n\nEste código expira em 10 minutos.\n\nSe não foi você, ignore esta mensagem.`
    );

    if (resultadoWhatsApp.success) {
      console.log(` Código de verificação enviado para ${user.Telefone}: ${codigo}`);
    } else {
      console.error(` Erro ao enviar WhatsApp para ${user.Telefone}:`, resultadoWhatsApp.error);
    }

    res.json({
      status: "ok",
      message: "Código enviado!",
    });
  } catch (err) {
    console.error("Erro ao enviar código:", err);
    res.status(500).json({
      status: "error",
      error: "Erro ao enviar código de verificação",
    });
  }
});

// Verificar email - enviar código por email
router.post("/verificar/email", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const codigo = gerarCodigo();

    // Buscar email do usuário
    const [userRows] = await pool.query(
      "SELECT Email, Nome FROM Utilizadores WHERE Id = ?",
      [userId]
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
      "UPDATE Utilizadores SET CodigoEmail = ? WHERE Id = ?",
      [codigo, userId]
    );

    // Enviar email
    try {
      const { sendEmail } = await import("../services/notify.js");
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
    const { codigo, tipo } = req.body; // tipo: 'email' ou 'telefone'
    const userId = req.user.id;

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
      `SELECT * FROM Utilizadores WHERE Id = ? AND ${campoCodigo} = ?`,
      [userId, codigo]
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
        "UPDATE Utilizadores SET EmailVerificado = 1, CodigoEmail = NULL WHERE Id = ?",
        [userId]
      );
    } else {
      // Para telefone, podemos adicionar um campo TelefoneVerificado se necessário
      await pool.query(
        "UPDATE Utilizadores SET CodigoTelefone = NULL WHERE Id = ?",
        [userId]
      );
    }

    console.log(` ${tipo} verificado com sucesso para usuário ${userId}`);

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
    const { emailOuTelefone } = req.body;

    if (!emailOuTelefone) {
      return res.status(400).json({
        status: "error",
        error: "Email ou telefone é obrigatório",
      });
    }

    // Determinar se é email ou telefone
    const isEmail = emailOuTelefone.includes('@');
    let user = null;

    if (isEmail) {
      // Buscar por email
      const [userRows] = await pool.query(
        "SELECT * FROM Utilizadores WHERE Email = ?",
        [emailOuTelefone]
      );
      user = userRows[0];
    } else {
      // Buscar por telefone
      const [userRows] = await pool.query(
        "SELECT * FROM Utilizadores WHERE Telefone = ?",
        [emailOuTelefone]
      );
      user = userRows[0];
    }

    if (!user) {
      return res.status(404).json({
        status: "error",
        error: "Usuário não encontrado",
      });
    }

    const codigo = gerarCodigo();

    // Salvar código no campo apropriado
    if (isEmail) {
      await pool.query(
        "UPDATE Utilizadores SET CodigoEmail = ? WHERE Id = ?",
        [codigo, user.Id]
      );
    } else {
      await pool.query(
        "UPDATE Utilizadores SET CodigoTelefone = ? WHERE Id = ?",
        [codigo, user.Id]
      );
    }

    // Enviar código pelo canal apropriado
    if (isEmail) {
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
    } else {
      // Enviar por WhatsApp
      const telefoneLimpo = user.Telefone.replace(/[^\d]/g, '');
      const resultadoWhatsApp = await enviarWhatsApp(
        telefoneLimpo,
        ` Seu código de recuperação é: ${codigo}\n\nEste código expira em 10 minutos.\n\nSe não foi você, ignore esta mensagem.`
      );
      
      if (resultadoWhatsApp.success) {
        console.log(` Código de recuperação enviado para ${user.Telefone}: ${codigo}`);
      } else {
        console.error(` Erro ao enviar WhatsApp para ${user.Telefone}:`, resultadoWhatsApp.error);
      }
    }

    res.json({
      status: "ok",
      message: `Código enviado por ${isEmail ? 'email' : 'WhatsApp'}!`,
      canal: isEmail ? 'email' : 'whatsapp'
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
    const { emailOuTelefone, codigo, novaSenha } = req.body;

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

    // Determinar se é email ou telefone
    const isEmail = emailOuTelefone.includes('@');
    let user = null;

    if (isEmail) {
      // Buscar por email e verificar código de email
      const [userRows] = await pool.query(
        "SELECT * FROM Utilizadores WHERE Email = ? AND CodigoEmail = ?",
        [emailOuTelefone, codigo]
      );
      user = userRows[0];
    } else {
      // Buscar por telefone e verificar código de telefone
      const [userRows] = await pool.query(
        "SELECT * FROM Utilizadores WHERE Telefone = ? AND CodigoTelefone = ?",
        [emailOuTelefone, codigo]
      );
      user = userRows[0];
    }

    if (!user) {
      return res.status(400).json({
        status: "error",
        error: "Código inválido ou expirado",
      });
    }

    // Hash da nova senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(novaSenha, saltRounds);

    // Atualizar senha e limpar códigos
    await pool.query(
      "UPDATE Utilizadores SET SenhaHash = ?, CodigoEmail = NULL, CodigoTelefone = NULL WHERE Id = ?",
      [hashedPassword, user.Id]
    );

    console.log(` Senha redefinida com sucesso para usuário ${user.Id} via ${isEmail ? 'email' : 'WhatsApp'}`);

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

// ================== ROTAS DE VERIFICAÇÃO ADICIONAIS ==================

// Reenviar código de verificação (para usuários não logados)
router.post("/reenviar-codigo", async (req, res) => {
  try {
    const { email } = req.body;

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
      "UPDATE Utilizadores SET CodigoEmail = ? WHERE Id = ?",
      [codigo, user.Id]
    );

    // Enviar por email
    try {
      const { sendEmail } = await import("../services/notify.js");
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

    // Se tem telefone, também enviar por WhatsApp
    if (user.Telefone) {
      try {
        const telefoneLimpo = user.Telefone.replace(/[^\d]/g, '');
        await enviarWhatsApp(
          telefoneLimpo,
          ` Seu novo código de verificação é: ${codigo}\n\nEste código expira em 10 minutos.\n\nSe não foi você, ignore esta mensagem.`
        );
        console.log(` Novo código de verificação enviado para ${user.Telefone}: ${codigo}`);
      } catch (whatsappError) {
        console.log(" WhatsApp não configurado");
      }
    }

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
    const { email, codigo } = req.body;

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
      "UPDATE Utilizadores SET EmailVerificado = 1, CodigoEmail = NULL WHERE Id = ?",
      [user.Id]
    );

    // Gerar token JWT
    const token = jwt.sign(
      { id: user.Id, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(` Email verificado com sucesso para usuário ${user.Id}`);

    res.json({
      status: "ok",
      message: "Email verificado com sucesso!",
      token,
      user: { id: user.Id, email: user.Email, nome: user.Nome },
    });
  } catch (err) {
    console.error(" Erro ao verificar código:", err);
    res.status(500).json({
      status: "error",
      error: "Erro ao verificar código",
    });
  }
});

// ================== ROTAS DE PERFIL ==================

// Atualizar telefone do usuário
router.put("/telefone", verifyToken, async (req, res) => {
  try {
    const { telefone } = req.body;
    const userId = req.user.id;

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
      "UPDATE Utilizadores SET Telefone = ? WHERE Id = ?",
      [telefone, userId]
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
    const userId = req.user.id;

    const [rows] = await pool.query(
      "SELECT Id, Nome, Email, Telefone, EmailVerificado FROM Utilizadores WHERE Id = ?",
      [userId]
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
        id: user.Id,
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

export default router;
