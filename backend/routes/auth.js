// @ts-nocheck
import express from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { pool } from "../database/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const router = express.Router();

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
            "SELECT * FROM Utilizadores WHERE GoogleId = ? OR Email = ?",
            [googleId, email]
          );

          let userId;
          if (rows.length > 0) {
            userId = rows[0].Id;
            await pool.query("UPDATE Utilizadores SET GoogleId=? WHERE Id=?", [
              googleId,
              userId,
            ]);
          } else {
            const [result] = await pool.query(
              "INSERT INTO Utilizadores (Nome, Email, GoogleId) VALUES (?, ?, ?)",
              [profile.displayName, email, googleId]
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
    const { nome, email, password } = req.body;
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
      "INSERT INTO Utilizadores (Nome, Email, SenhaHash, EmailVerificado) VALUES (?, ?, ?, ?)",
      [nome, email, hashedPassword, 0]
    );

    const userId = result.insertId;

    await pool.query(
      "INSERT INTO ConfigUtilizador (UserId, Email, CanalPreferido) VALUES (?, ?, ?)",
      [userId, email, "email"]
    );

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.query("UPDATE Utilizadores SET CodigoEmail=? WHERE Id=?", [
      codigo,
      userId,
    ]);

    try {
      const { sendEmail } = await import("../services/notify.js");
      const messageHtml = `
        <h2>Confirmação de conta - PromoPing</h2>
        <p>Olá ${nome} 👋,</p>
        <p>Use o código abaixo para verificar sua conta:</p>
        <h3 style="color:#1e90ff">${codigo}</h3>
        <p>Se não foi você, ignore este email.</p>
      `;
      await sendEmail(email, "PromoPing - Verificação de conta", messageHtml);
    } catch (emailError) {
      console.log("⚠️ Email não configurado, mas conta criada com sucesso");
    }

    res.json({
      status: "ok",
      message:
        "Conta criada com sucesso! Verifique seu email para ativar a conta.",
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

export default router;
