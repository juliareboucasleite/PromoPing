// @ts-nocheck
import express from "express";
import { pool } from "../database/db.js";
import { sendEmail } from "../services/notify.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Função gerar código de 6 dígitos
function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===== ENVIAR CÓDIGO DE VERIFICAÇÃO =====
router.post("/email/send", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email é obrigatório" });

    // Gera código
    const codigo = gerarCodigo();

    // Salva no utilizador
    await pool.query(
      "UPDATE Utilizadores SET CodigoEmail=? WHERE Email=?",
      [codigo, email]
    );

    // Envia email
    const messageHtml = `
      <h2>Confirmação de conta - PromoPing</h2>
      <p>Olá 👋,</p>
      <p>Use o código abaixo para verificar sua conta:</p>
      <h3 style="color:#1e90ff">${codigo}</h3>
      <p>Se não foi você, ignore este email.</p>
    `;
    await sendEmail(email, "PromoPing - Verificação de conta", messageHtml);

    res.json({ status: "ok", message: "Código enviado por email" });
  } catch (err) {
    console.error("Erro envio email:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== VALIDAR CÓDIGO DE EMAIL =====
router.post("/email/verify", async (req, res) => {
  try {
    const { email, codigo } = req.body;
    if (!email || !codigo) {
      return res.status(400).json({ error: "Email e código são obrigatórios" });
    }

    const [rows] = await pool.query(
      "SELECT * FROM Utilizadores WHERE Email=? AND CodigoEmail=?",
      [email, codigo]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "Código inválido" });
    }

    // Marca como verificado
    await pool.query(
      "UPDATE Utilizadores SET EmailVerificado=1, CodigoEmail=NULL WHERE Email=?",
      [email]
    );

    // Gera token JWT
    const token = jwt.sign({ id: rows[0].Id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ status: "ok", token });
  } catch (err) {
    console.error("Erro na verificação de email:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
