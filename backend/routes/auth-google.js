// @ts-nocheck
import express from "express";
import passport from "passport";
import session from "express-session";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import { pool } from "../database/db.js";

const router = express.Router();

// ================== CONFIG SESSÃO ==================
router.use(
  session({
    secret: "promoping-secret",
    resave: false,
    saveUninitialized: true,
  })
);

router.use(passport.initialize());
router.use(passport.session());

// ================== GOOGLE STRATEGY ==================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value;
          const googleId = profile.id;
          const nome = profile.displayName;

          let userId;

          // Verifica se já existe utilizador com esse email
          const [rows] = await pool.query("SELECT * FROM Utilizadores WHERE Email=?", [email]);

          if (rows.length > 0) {
            userId = rows[0].Id;

            // Usuário já existe, apenas log
            console.log("Usuário Google já existe:", email);
          } else {
            // Cria novo utilizador
            const [result] = await pool.query(
              "INSERT INTO Utilizadores (Nome, Email, SenhaHash, EmailVerificado) VALUES (?, ?, ?, ?)",
              [nome, email, "", 1]
            );
            userId = result.insertId;

            // Cria config do utilizador
            await pool.query(
              "INSERT INTO ConfigUtilizador (UserId, Email, CanalPreferido) VALUES (?, ?, ?)",
              [userId, email, "email"]
            );
          }

          return done(null, { id: userId, email, nome });
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
} else {
  console.log("⚠️ Google OAuth não configurado. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env");
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ================== ROTAS ==================

// Iniciar login com Google
router.get("/google", (req, res, next) => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  } else {
    res.status(400).json({
      error: "Google OAuth não configurado. Configure as credenciais no ficheiro .env",
    });
  }
});

// Callback do Google
router.get("/google/callback", (req, res) => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.authenticate("google", { failureRedirect: "/login.html" })(req, res, (err) => {
      if (err) {
        console.error("Erro na autenticação Google:", err);
        return res.redirect("/login.html?error=auth_failed");
      }

      if (!req.user) {
        console.error("req.user está undefined");
        return res.redirect("/login.html?error=user_undefined");
      }

      try {
        // Gera token JWT
        const token = jwt.sign(
          { id: req.user.id, email: req.user.email, nome: req.user.nome },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        // Redireciona para o painel com token
        res.redirect(`/pages/Painel.html?token=${token}`);
      } catch (tokenError) {
        console.error("Erro ao gerar token:", tokenError);
        res.redirect("/login.html?error=token_error");
      }
    });
  } else {
    res.status(400).json({
      error: "Google OAuth não configurado. Configure as credenciais no ficheiro .env",
    });
  }
});

export default router;
