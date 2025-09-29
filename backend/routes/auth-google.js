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

        // Verifica se já existe utilizador
        const [rows] = await pool.query("SELECT Id FROM Utilizadores WHERE Email=?", [email]);
        let userId;

        if (rows.length > 0) {
          userId = rows[0].Id;
        } else {
          // Cria utilizador
          const [result] = await pool.query(
            "INSERT INTO Utilizadores (Nome, Email, SenhaHash, EmailVerificado) VALUES (?, ?, ?, ?)",
            [profile.displayName, email, "", 1] // Senha vazia porque é Google login
          );
          userId = result.insertId;

          // Cria config do utilizador
          await pool.query(
            "INSERT INTO ConfigUtilizador (UserId, Email, CanalPreferido) VALUES (?, ?, ?)",
            [userId, email, "email"]
          );
        }

        return done(null, { id: userId, email });
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Serialização de sessão
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ================== ROTAS ==================

// Iniciar login com Google
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Callback do Google
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    // Gera token JWT
    const token = jwt.sign({ id: req.user.id, email: req.user.email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Redireciona para o painel com token na URL
    res.redirect(`/painel.html?token=${token}`);
  }
);

export default router;
