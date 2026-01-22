import express from "express";
import { pool } from "../database/db.js";
import { sendEmail } from "../services/notify.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// ===== FUNÇÃO CRÍTICA: GERAÇÃO DE CÓDIGO =====
// Função gerar código de 6 dígitos nunca mexa nisso pelo amor de deus
// Se tu mudar essa lógica, pode gerar códigos duplicados ou inválidos
// E aí ninguém mais consegue verificar email, deixa essa merda quieta
function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===== ATENÇÃO: ENVIO DE EMAIL =====
// isso envia o codigo pro utilizador algo que foi dificil de fazer, mude caso saiba se nao, nao mexa
// Se tu fuder essa parte, ninguém mais recebe email de verificação
// E aí todo mundo fica sem conseguir fazer login direito
router.post("/email/send", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email é obrigatório" });

    // Buscar dados do usuário
    const [userRows] = await pool.query(
      "SELECT Nome, Email FROM Utilizadores WHERE Email = ?",
      [email]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const user = userRows[0];
    const nome = user.Nome || "Usuário";

    // aqui gera o codigo
    const codigo = gerarCodigo();

    // Salva no utilizador
    await pool.query(
      "UPDATE Utilizadores SET CodigoEmail=? WHERE Email=?",
      [codigo, email]
    );

    // Envia email (se configurado)
    try {
      const messageHtml = `
        <h2>Verificação de Conta</h2>
        <p>Olá <b>${nome}</b>,</p>
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
      console.error("Erro ao enviar email:", emailError);
      console.log("Email não configurado. Código salvo na base de dados:", codigo);
    }

    res.json({ status: "ok", message: "Código enviado por email" });
  } catch (err) {
    console.error("Erro ao enviar código de verificação:", err);
    res.status(500).json({ error: err.message || "Erro interno do servidor" });
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


    // Gera token JWT - NÃO MEXA NESSA MERDA
    // Se tu mudar o expiresIn ou a estrutura do payload, vai quebrar o login
    // E aí todo mundo vai ter que fazer login de novo toda hora
    const token = jwt.sign({ id: rows[0].Id }, process.env.JWT_SECRET, {
      expiresIn: "7d", // 7 dias tá perfeito, não mexe nisso
    });

    res.json({ status: "ok", token });
  } catch (err) {
    console.error("Erro na verificação de email:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
