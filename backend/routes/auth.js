import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ================== REGISTER ==================
router.post("/register", async (req, res) => {
    try {
        const { nome, email, password } = req.body;

        if (!nome || !email || !password) {
            return res.status(400).json({ error: "Preencha todos os campos" });
        }

        // verificar se já existe email
        const [rows] = await pool.query("SELECT id FROM utilizadores WHERE email = ?", [email]);
        if (rows.length > 0) {
            return res.status(400).json({ error: "Email já registado" });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        await pool.query(
            "INSERT INTO utilizadores (nome, email, senha) VALUES (?, ?, ?)",
            [nome, email, hash]
        );

        res.json({ status: "ok", message: "Utilizador criado com sucesso" });
    } catch (err) {
        console.error("Erro no register:", err);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

// ================== LOGIN ==================
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Preencha email e password" });
        }

        const [rows] = await pool.query("SELECT * FROM utilizadores WHERE email = ?", [email]);
        if (rows.length === 0) {
            return res.status(400).json({ error: "Email não encontrado" });
        }

        const user = rows[0];
        const isValid = await bcrypt.compare(password, user.senha);

        if (!isValid) {
            return res.status(400).json({ error: "Senha incorreta" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, type: "web" },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({
            status: "ok",
            message: "Login bem sucedido",
            token,
            user: {
                id: user.id,
                nome: user.nome,
                email: user.email
            }
        });
    } catch (err) {
        console.error("Erro no login:", err);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

// ================== ME (rota protegida) ==================
router.get("/me", verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, nome, email, data_registo FROM utilizadores WHERE id = ?",
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Utilizador não encontrado" });
        }

        res.json({ status: "ok", user: rows[0] });
    } catch (err) {
        console.error("Erro no /me:", err);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

export default router;
