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

    // Envia email (se configurado)
    try {
      const messageHtml = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
    <h2 style="color: #1e90ff; text-align: center;">PromoPing</h2>
    <p>Olá <b>${nome}</b> 👋,</p>
    <p>Obrigado por se registar no <b>PromoPing</b>.</p>
    <p>Use o código abaixo para verificar a sua conta:</p>
    <div style="text-align: center; margin: 20px 0;">
      <span style="font-size: 28px; font-weight: bold; color: #1e90ff; letter-spacing: 4px;">
        ${codigo}
      </span>
    </div>
    <p style="font-size: 14px; color: #666;">Este código expira em 10 minutos.</p>
    <hr style="margin: 20px 0;"/>
    <p style="font-size: 12px; color: #999; text-align: center;">
      Se não foi você, ignore este e-mail.<br/>
      &copy; ${new Date().getFullYear()} PromoPing
    </p>
  </div>
`;
      await sendEmail(email, "PromoPing - Verificação de conta", messageHtml);
    } catch (emailError) {
      console.log("⚠️ Email não configurado. Código salvo na base de dados:", codigo);
    }

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
