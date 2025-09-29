// @ts-nocheck
import express from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { pool } from "../database/db.js";

const router = express.Router();

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

        // 🔹 Verifica se já existe utilizador com esse GoogleId
        const [rows] = await pool.query(
          "SELECT * FROM Utilizadores WHERE GoogleId = ? OR Email = ?",
          [googleId, email]
        );

        let userId;
        if (rows.length > 0) {
          userId = rows[0].Id;
          // Atualiza GoogleId se ainda não estava associado
          await pool.query("UPDATE Utilizadores SET GoogleId=? WHERE Id=?", [
            googleId,
            userId,
          ]);
        } else {
          // Cria novo utilizador
          const [result] = await pool.query(
            "INSERT INTO Utilizadores (Nome, Email, GoogleId) VALUES (?, ?, ?)",
            [profile.displayName, email, googleId]
          );
          userId = result.insertId;
        }

        // 🔹 Salva/atualiza config do utilizador
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

// Serialização da sessão
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ================== ROTAS GOOGLE ==================
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    // 🔹 Aqui podes redirecionar para o painel
    res.redirect("/painel");
  }
);

export default router;
