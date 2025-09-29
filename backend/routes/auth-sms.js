// @ts-nocheck
import express from "express";
import { pool } from "../database/db.js";
import jwt from "jsonwebtoken";
import twilio from "twilio";

const router = express.Router();

// Twilio
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// Função para gerar código aleatório
function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
}

// ================== ENVIAR CÓDIGO POR SMS ==================
router.post("/sms/send", async (req, res) => {
  try {
    const { telefone } = req.body;
    if (!telefone) return res.status(400).json({ error: "Telefone é obrigatório" });

    const codigo = gerarCodigo();

    // Salva código temporário (5 min de validade)
    await pool.query(
      `INSERT INTO CodigosSMS (Telefone, Codigo, ExpiraEm) 
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))
       ON DUPLICATE KEY UPDATE Codigo=?, ExpiraEm=DATE_ADD(NOW(), INTERVAL 5 MINUTE)`,
      [telefone, codigo, codigo]
    );

    // Envia SMS via Twilio
    await client.messages.create({
      body: `Seu código PromoPing é: ${codigo}`,
      from: process.env.TWILIO_PHONE,
      to: telefone,
    });

    res.json({ status: "ok", message: "Código enviado por SMS" });
  } catch (err) {
    console.error("Erro SMS:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================== REGISTAR COM SMS ==================
router.post("/sms/register", async (req, res) => {
  try {
    const { telefone, codigo } = req.body;
    if (!telefone || !codigo) {
      return res.status(400).json({ error: "Telefone e código são obrigatórios" });
    }

    // Valida código
    const [rows] = await pool.query(
      "SELECT * FROM CodigosSMS WHERE Telefone=? AND Codigo=? AND ExpiraEm > NOW()",
      [telefone, codigo]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: "Código inválido ou expirado" });
    }

    // Verifica se já existe utilizador
    const [userRows] = await pool.query(
      "SELECT * FROM Utilizadores WHERE Telefone=?",
      [telefone]
    );

    let userId;
    if (userRows.length > 0) {
      userId = userRows[0].Id;
    } else {
      // Cria novo user
      const [result] = await pool.query(
        "INSERT INTO Utilizadores (Nome, Telefone) VALUES (?, ?)",
        ["User " + telefone, telefone]
      );
      userId = result.insertId;

      // Cria config
      await pool.query(
        "INSERT INTO ConfigUtilizador (UserId, Telefone, CanalPreferido) VALUES (?, ?, ?)",
        [userId, telefone, "sms"]
      );
    }

    // Gera token
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ status: "ok", token });
  } catch (err) {
    console.error("Erro no registo SMS:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================== LOGIN COM SMS ==================
router.post("/sms/verify", async (req, res) => {
  try {
    const { telefone, codigo } = req.body;
    if (!telefone || !codigo) {
      return res.status(400).json({ error: "Telefone e código são obrigatórios" });
    }

    // Valida código
    const [rows] = await pool.query(
      "SELECT * FROM CodigosSMS WHERE Telefone=? AND Codigo=? AND ExpiraEm > NOW()",
      [telefone, codigo]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: "Código inválido ou expirado" });
    }

    // Verifica se existe utilizador
    const [userRows] = await pool.query(
      "SELECT * FROM Utilizadores WHERE Telefone=?",
      [telefone]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado, faça registo primeiro" });
    }

    const userId = userRows[0].Id;

    // Gera token
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ status: "ok", token });
  } catch (err) {
    console.error("Erro no login SMS:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
