// @ts-nocheck
import express from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { pool } from "../database/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { verifyToken } from "../middleware/auth.js";
import { enviarWhatsApp } from "./auth-whatsApp.js";

const router = express.Router();

// ================== FUNÇÕES AUXILIARES ==================

// Função para gerar código de 6 dígitos
function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Função para enviar email
async function enviarEmail(to, subject, text) {
  try {
    const { sendEmail } = await import("../services/notify.js");
    await sendEmail(to, subject, text);
    console.log(`📧 Email enviado para ${to}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Erro ao enviar email:", error);
    return { success: false, error: error.message };
  }
}

// ================== GOOGLE STRATEGY ==================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/callback",
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
  console.log(
    "⚠️ Google OAuth não configurado. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env"
  );
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ================== ROTAS SMS/WHATSAPP ==================

// Criar conta via telefone (SMS/WhatsApp)
router.post("/register-sms", async (req, res) => {
  try {
    const { telefone, nome } = req.body;

    if (!telefone) {
      return res.status(400).json({
        status: "error",
        error: "Telefone é obrigatório",
      });
    }

    // Verificar se telefone já existe
    const [existing] = await pool.query(
      "SELECT Id FROM Utilizadores WHERE Telefone = ?",
      [telefone]
    );

    let userId;
    if (existing.length > 0) {
      userId = existing[0].Id;
    } else {
      // Criar novo usuário
      const [result] = await pool.query(
        "INSERT INTO Utilizadores (Nome, Telefone, Ativo) VALUES (?, ?, ?)",
        [nome || "Usuário", telefone, 0]
      );
      userId = result.insertId;
    }

    const codigo = gerarCodigo();
    await pool.query(
      "UPDATE Utilizadores SET CodigoTelefone = ? WHERE Id = ?",
      [codigo, userId]
    );

    // Enviar WhatsApp
    const telefoneLimpo = telefone.replace(/[^\d]/g, '');
    const resultadoWhatsApp = await enviarWhatsApp(
      telefoneLimpo,
      `📢 Seu código PromoPing é: ${codigo}\n\nUse este código para ativar sua conta.\n\nSe não foi você, ignore esta mensagem.`
    );

    if (resultadoWhatsApp.success) {
      console.log(`📱 Código SMS enviado para ${telefone}: ${codigo}`);
    } else {
      console.error(`❌ Erro ao enviar WhatsApp para ${telefone}:`, resultadoWhatsApp.error);
    }

    res.json({
      status: "ok",
      message: "Código enviado para WhatsApp!",
      telefone: telefone
    });
  } catch (err) {
    console.error("❌ Erro no registro SMS:", err);
    res.status(500).json({
      status: "error",
      error: "Erro ao enviar código",
    });
  }
});

// Validar código SMS/WhatsApp
router.post("/validar-sms", async (req, res) => {
  try {
    const { telefone, codigo } = req.body;

    if (!telefone || !codigo) {
      return res.status(400).json({
        status: "error",
        error: "Telefone e código são obrigatórios",
      });
    }

    // Buscar usuário e verificar código
    const [userRows] = await pool.query(
      "SELECT * FROM Utilizadores WHERE Telefone = ? AND CodigoTelefone = ?",
      [telefone, codigo]
    );

    if (userRows.length === 0) {
      return res.status(400).json({
        status: "error",
        error: "Código inválido ou expirado",
      });
    }

    const user = userRows[0];

    // Ativar conta e limpar código
    await pool.query(
      "UPDATE Utilizadores SET Ativo = 1, CodigoTelefone = NULL WHERE Id = ?",
      [user.Id]
    );

    // Criar configuração do usuário
    await pool.query(
      "INSERT INTO ConfigUtilizador (UserId, Email, CanalPreferido) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE CanalPreferido = 'whatsapp'",
      [user.Id, user.Email || null, "whatsapp"]
    );

    // Gerar token JWT
    const token = jwt.sign(
      { id: user.Id, telefone: user.Telefone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`✅ Conta SMS ativada com sucesso para usuário ${user.Id}`);

    res.json({
      status: "ok",
      message: "Conta criada e validada com sucesso!",
      token,
      user: { id: user.Id, telefone: user.Telefone, nome: user.Nome }
    });
  } catch (err) {
    console.error("❌ Erro ao validar SMS:", err);
    res.status(500).json({
      status: "error",
      error: "Erro ao validar conta",
    });
  }
});

// ================== ROTAS EMAIL/SENHA ==================

// LOGIN com email e senha
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("📩 Login tentativa:", email);

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
    console.log("🔍 Resultado SELECT:", rows);

    if (rows.length === 0) {
      return res.status(400).json({
        status: "error",
        error: "Email ou senha incorretos",
      });
    }

    const user = rows[0];
    console.log("👤 Usuário retornado:", user);

    if (!user.SenhaHash) {
      return res.status(400).json({
        status: "error",
        error:
          "Conta não tem senha configurada. Use Google ou configure uma senha no perfil.",
      });
    }

    // Verifica senha
    const validPassword = await bcrypt.compare(password, user.SenhaHash);
    console.log("🔑 Senha válida?:", validPassword);

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
    console.error("❌ Erro no login:", err);
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
    console.log("📩 Registro tentativa:", email);

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

    await pool.query(
      "INSERT INTO ConfigUtilizador (UserId, Email, CanalPreferido) VALUES (?, ?, ?)",
      [userId, email, "email"]
    );

    const codigo = gerarCodigo();
    await pool.query("UPDATE Utilizadores SET CodigoEmail=? WHERE Id=?", [
      codigo,
      userId,
    ]);

    // Enviar código por email
    try {
      const { sendEmail } = await import("../services/notify.js");
      const messageHtml = `
        <h2>🔐 Verificação de Conta</h2>
        <p>Olá <b>${nome}</b> 👋,</p>
        <p>Obrigado por se registrar no <b>PromoPing</b>!</p>
        <p>Use o código abaixo para verificar sua conta:</p>
        <h1 style="color: #ff6b35; font-size: 2em; text-align: center; margin: 20px 0;">${codigo}</h1>
        <p>Este código expira em 10 minutos.</p>
        <p>Se não foi você, ignore este e-mail.</p>
        <hr>
        <p style="color: #666; font-size: 0.9em;">&copy; ${new Date().getFullYear()} PromoPing</p>
      `;
      await sendEmail(email, "PromoPing - Verificação de conta", messageHtml);
      console.log(`📧 Código de verificação enviado para ${email}: ${codigo}`);
    } catch (emailError) {
      console.log("⚠️ Email não configurado, mas conta criada com sucesso");
    }

    // Se telefone foi fornecido, também enviar por WhatsApp
    if (telefone) {
      try {
        const telefoneLimpo = telefone.replace(/[^\d]/g, '');
        await enviarWhatsApp(
          telefoneLimpo,
          `🔐 Seu código de verificação é: ${codigo}\n\nEste código expira em 10 minutos.\n\nSe não foi você, ignore esta mensagem.`
        );
        console.log(`📱 Código de verificação enviado para ${telefone}: ${codigo}`);
      } catch (whatsappError) {
        console.log("⚠️ WhatsApp não configurado, mas conta criada com sucesso");
      }
    }

    res.json({
      status: "ok",
      message: "Conta criada com sucesso! Verifique seu email (e WhatsApp se fornecido) para ativar a conta.",
      codigo: codigo // Para desenvolvimento - remover em produção
    });
  } catch (err) {
    console.error("❌ Erro no registo:", err);
    res.status(500).json({
      status: "error",
      error: err.message || "Erro interno no servidor",
    });
  }
});

// ================== ROTAS GOOGLE ==================
router.get("/google", (req, res) => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res);
  } else {
    res.status(400).json({
      error:
        "Google OAuth não configurado. Configure as credenciais no ficheiro .env",
    });
  }
});

router.get("/google/callback", (req, res) => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.authenticate("google", { failureRedirect: "/" })(
      req,
      res,
      () => {
        res.redirect("/pages/Painel.html");
      }
    );
  } else {
    res.status(400).json({
      error:
        "Google OAuth não configurado. Configure as credenciais no ficheiro .env",
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
      `🔐 Seu código de verificação é: ${codigo}\n\nEste código expira em 10 minutos.\n\nSe não foi você, ignore esta mensagem.`
    );

    if (resultadoWhatsApp.success) {
      console.log(`📱 Código de verificação enviado para ${user.Telefone}: ${codigo}`);
    } else {
      console.error(`❌ Erro ao enviar WhatsApp para ${user.Telefone}:`, resultadoWhatsApp.error);
    }

    res.json({
      status: "ok",
      message: "Código enviado para WhatsApp!",
    });
  } catch (err) {
    console.error("❌ Erro ao enviar código por WhatsApp:", err);
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
        <h2>🔐 Verificação de Conta</h2>
        <p>Olá <b>${user.Nome}</b> 👋,</p>
        <p>Use o código abaixo para verificar sua conta:</p>
        <h1 style="color: #ff6b35; font-size: 2em; text-align: center; margin: 20px 0;">${codigo}</h1>
        <p>Este código expira em 10 minutos.</p>
        <p>Se não foi você, ignore este e-mail.</p>
        <hr>
        <p style="color: #666; font-size: 0.9em;">&copy; ${new Date().getFullYear()} PromoPing</p>
      `;
      
      await sendEmail(user.Email, "PromoPing - Verificação de conta", messageHtml);
      console.log(`📧 Código de verificação enviado para ${user.Email}: ${codigo}`);
    } catch (emailError) {
      console.log("⚠️ Email não configurado, mas código salvo:", codigo);
    }

    res.json({
      status: "ok",
      message: "Código enviado por email!",
    });
  } catch (err) {
    console.error("❌ Erro ao enviar código por email:", err);
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

    console.log(`✅ ${tipo} verificado com sucesso para usuário ${userId}`);

    res.json({
      status: "ok",
      message: `${tipo === 'email' ? 'Email' : 'Telefone'} verificado com sucesso!`,
    });
  } catch (err) {
    console.error("❌ Erro ao validar código:", err);
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
        console.log(`📧 Código de recuperação enviado para ${user.Email}: ${codigo}`);
      } else {
        console.log("⚠️ Email não configurado, mas código salvo:", codigo);
      }
    } else {
      // Enviar por WhatsApp
      const telefoneLimpo = user.Telefone.replace(/[^\d]/g, '');
      const resultadoWhatsApp = await enviarWhatsApp(
        telefoneLimpo,
        `🔑 Seu código de recuperação é: ${codigo}\n\nEste código expira em 10 minutos.\n\nSe não foi você, ignore esta mensagem.`
      );
      
      if (resultadoWhatsApp.success) {
        console.log(`📱 Código de recuperação enviado para ${user.Telefone}: ${codigo}`);
      } else {
        console.error(`❌ Erro ao enviar WhatsApp para ${user.Telefone}:`, resultadoWhatsApp.error);
      }
    }

    res.json({
      status: "ok",
      message: `Código enviado por ${isEmail ? 'email' : 'WhatsApp'}!`,
      canal: isEmail ? 'email' : 'whatsapp'
    });
  } catch (err) {
    console.error("❌ Erro na recuperação de senha:", err);
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

    console.log(`✅ Senha redefinida com sucesso para usuário ${user.Id} via ${isEmail ? 'email' : 'WhatsApp'}`);

    res.json({
      status: "ok",
      message: "Senha redefinida com sucesso!",
    });
  } catch (err) {
    console.error("❌ Erro ao resetar senha:", err);
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
        <h2>🔐 Código de Verificação</h2>
        <p>Olá <b>${user.Nome}</b> 👋,</p>
        <p>Você solicitou um novo código de verificação:</p>
        <h1 style="color: #ff6b35; font-size: 2em; text-align: center; margin: 20px 0;">${codigo}</h1>
        <p>Este código expira em 10 minutos.</p>
        <p>Se não foi você, ignore este e-mail.</p>
        <hr>
        <p style="color: #666; font-size: 0.9em;">&copy; ${new Date().getFullYear()} PromoPing</p>
      `;
      
      await sendEmail(user.Email, "PromoPing - Novo código de verificação", messageHtml);
      console.log(`📧 Novo código de verificação enviado para ${user.Email}: ${codigo}`);
    } catch (emailError) {
      console.log("⚠️ Email não configurado, mas código salvo:", codigo);
    }

    // Se tem telefone, também enviar por WhatsApp
    if (user.Telefone) {
      try {
        const telefoneLimpo = user.Telefone.replace(/[^\d]/g, '');
        await enviarWhatsApp(
          telefoneLimpo,
          `🔐 Seu novo código de verificação é: ${codigo}\n\nEste código expira em 10 minutos.\n\nSe não foi você, ignore esta mensagem.`
        );
        console.log(`📱 Novo código de verificação enviado para ${user.Telefone}: ${codigo}`);
      } catch (whatsappError) {
        console.log("⚠️ WhatsApp não configurado");
      }
    }

    res.json({
      status: "ok",
      message: "Código reenviado com sucesso!",
    });
  } catch (err) {
    console.error("❌ Erro ao reenviar código:", err);
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

    console.log(`✅ Email verificado com sucesso para usuário ${user.Id}`);

    res.json({
      status: "ok",
      message: "Email verificado com sucesso!",
      token,
      user: { id: user.Id, email: user.Email, nome: user.Nome },
    });
  } catch (err) {
    console.error("❌ Erro ao verificar código:", err);
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
    console.error("❌ Erro ao atualizar telefone:", err);
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
    console.error("❌ Erro ao buscar perfil:", err);
    res.status(500).json({
      status: "error",
      error: "Erro interno no servidor",
    });
  }
});

export default router;
