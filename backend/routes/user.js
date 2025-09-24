import express from "express";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// 📊 Obter estatísticas do utilizador
router.get("/stats", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Contar produtos monitorizados
        const [produtosRows] = await pool.query(
            "SELECT COUNT(*) as total FROM Produtos WHERE UserId = ?",
            [userId]
        );

        // Contar notificações enviadas
        const [notifRows] = await pool.query(
            "SELECT COUNT(*) as total FROM Notificacoes WHERE UserId = ? AND Enviada = TRUE",
            [userId]
        );

        // Calcular dinheiro poupado (diferença entre preço original e preço atual quando meta atingida)
        const [poupancaRows] = await pool.query(`
            SELECT COALESCE(SUM(
                CASE 
                    WHEN p.PrecoAlvo IS NOT NULL AND h.Preco <= p.PrecoAlvo 
                    THEN p.PrecoAlvo - h.Preco 
                    ELSE 0 
                END
            ), 0) as poupado
            FROM Produtos p
            LEFT JOIN HistoricoPrecos h ON p.Id = h.ProdutoId
            WHERE p.UserId = ? AND h.DataRegistro = (
                SELECT MAX(DataRegistro) FROM HistoricoPrecos WHERE ProdutoId = p.Id
            )
        `, [userId]);

        // Data de registo
        const [userRows] = await pool.query(
            "SELECT data_registo FROM utilizadores WHERE id = ?",
            [userId]
        );

        const stats = {
            produtos_monitorizados: produtosRows[0].total,
            notificacoes_enviadas: notifRows[0].total,
            dinheiro_poupado: Number(poupancaRows[0].poupado).toFixed(2),
            membro_desde: userRows[0]?.data_registo ? new Date(userRows[0].data_registo).toLocaleDateString('pt-PT') : 'N/A'
        };

        res.json({ status: "ok", stats });
    } catch (err) {
        console.error("Erro ao obter estatísticas:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// 👤 Obter perfil completo do utilizador
router.get("/profile", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Dados básicos do utilizador
        const [userRows] = await pool.query(
            "SELECT id, nome, email, telefone, data_registo FROM utilizadores WHERE id = ?",
            [userId]
        );

        if (userRows.length === 0) {
            return res.status(404).json({ error: "Utilizador não encontrado" });
        }

        const user = userRows[0];

        // Contas conectadas
        const [contasRows] = await pool.query(
            "SELECT Tipo, Identificador, Conectado, DataConexao FROM ContasConectadas WHERE UserId = ?",
            [userId]
        );

        // Preferências de notificação
        const [prefRows] = await pool.query(
            "SELECT Tipo, Ativo FROM PreferenciasNotificacao WHERE UserId = ?",
            [userId]
        );

        // Estatísticas
        const [statsRows] = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM Produtos WHERE UserId = ?) as produtos_monitorizados,
                (SELECT COUNT(*) FROM Notificacoes WHERE UserId = ? AND Enviada = TRUE) as notificacoes_enviadas,
                (SELECT COALESCE(SUM(
                    CASE 
                        WHEN p.PrecoAlvo IS NOT NULL AND h.Preco <= p.PrecoAlvo 
                        THEN p.PrecoAlvo - h.Preco 
                        ELSE 0 
                    END
                ), 0) FROM Produtos p
                LEFT JOIN HistoricoPrecos h ON p.Id = h.ProdutoId
                WHERE p.UserId = ? AND h.DataRegistro = (
                    SELECT MAX(DataRegistro) FROM HistoricoPrecos WHERE ProdutoId = p.Id
                )) as dinheiro_poupado
        `, [userId, userId, userId]);

        const profile = {
            ...user,
            contas_conectadas: contasRows,
            preferencias: prefRows,
            estatisticas: {
                produtos_monitorizados: statsRows[0].produtos_monitorizados,
                notificacoes_enviadas: statsRows[0].notificacoes_enviadas,
                dinheiro_poupado: Number(statsRows[0].dinheiro_poupado).toFixed(2),
                membro_desde: new Date(user.data_registo).toLocaleDateString('pt-PT')
            }
        };

        res.json({ status: "ok", profile });
    } catch (err) {
        console.error("Erro ao obter perfil:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// ✏️ Atualizar informações pessoais
router.put("/profile", verifyToken, async (req, res) => {
    try {
        const { nome, email, telefone } = req.body;
        const userId = req.user.id;

        await pool.query(
            "UPDATE utilizadores SET nome = ?, email = ?, telefone = ? WHERE id = ?",
            [nome, email, telefone, userId]
        );

        res.json({ status: "ok", message: "Perfil atualizado com sucesso" });
    } catch (err) {
        console.error("Erro ao atualizar perfil:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// 🔔 Atualizar preferências de notificação
router.put("/preferences", verifyToken, async (req, res) => {
    try {
        const { preferences } = req.body; // [{tipo: 'email', ativo: true}, ...]
        const userId = req.user.id;

        for (const pref of preferences) {
            await pool.query(`
                INSERT INTO PreferenciasNotificacao (UserId, Tipo, Ativo) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE Ativo = ?
            `, [userId, pref.tipo, pref.ativo, pref.ativo]);
        }

        res.json({ status: "ok", message: "Preferências atualizadas com sucesso" });
    } catch (err) {
        console.error("Erro ao atualizar preferências:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// 🔗 Desconectar conta
router.delete("/accounts/:tipo", verifyToken, async (req, res) => {
    try {
        const { tipo } = req.params;
        const userId = req.user.id;

        await pool.query(
            "UPDATE ContasConectadas SET Conectado = FALSE WHERE UserId = ? AND Tipo = ?",
            [userId, tipo]
        );

        res.json({ status: "ok", message: "Conta desconectada com sucesso" });
    } catch (err) {
        console.error("Erro ao desconectar conta:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

export default router;