import express from "express";
import { pool as db } from "../database/db.js";

const router = express.Router();

function buildSeries(rows, labelKey, valueKey, labels) {
  const map = new Map(rows.map(r => [r[labelKey], Number(r[valueKey])]));
  return labels.map(l => map.get(l) || 0);
}

// Gera labels YYYY-MM para últimos N meses (inclui mês atual)
function lastNMonths(n) {
  const labels = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    labels.push(`${y}-${m}`);
  }
  return labels;
}

// Gera labels YYYY-MM-DD para últimos N dias (inclui hoje)
function lastNDays(n) {
  const labels = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    labels.push(`${y}-${m}-${d}`);
  }
  return labels;
}


router.get("/api/charts/overview", async (req, res) => {
  try {
    const months = Number(req.query.months || 9);
    const labels = lastNMonths(months);

    const [prodMes] = await db.query(`
      SELECT TO_CHAR(DataCriacao, 'YYYY-MM') as periodo, COUNT(*) as total
      FROM Produtos
      WHERE DataCriacao >= DATE_TRUNC('month', CURRENT_DATE) - ((? || ' months')::interval)
      GROUP BY periodo
      ORDER BY periodo ASC
    `, [months - 1]);

    const [notifMes] = await db.query(`
      SELECT TO_CHAR(COALESCE(DataEnvio, Data), 'YYYY-MM') as periodo, COUNT(*) as total
      FROM Notificacoes
      WHERE COALESCE(DataEnvio, Data) >= DATE_TRUNC('month', CURRENT_DATE) - ((? || ' months')::interval)
      GROUP BY periodo
      ORDER BY periodo ASC
    `, [months - 1]);

    const [usersMes] = await db.query(`
      SELECT TO_CHAR(DataRegisto, 'YYYY-MM') as periodo, COUNT(*) as total
      FROM Utilizadores
      WHERE DataRegisto >= DATE_TRUNC('month', CURRENT_DATE) - ((? || ' months')::interval)
      GROUP BY periodo
      ORDER BY periodo ASC
    `, [months - 1]);

    res.json({
      status: "ok",
      labels,
      series: {
        produtosCriados: buildSeries(prodMes, 'periodo', 'total', labels),
        notificacoes: buildSeries(notifMes, 'periodo', 'total', labels),
        utilizadoresNovos: buildSeries(usersMes, 'periodo', 'total', labels),
      }
    });
  } catch (err) {
    console.error("Erro charts/overview:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});


router.get("/api/charts/daily", async (req, res) => {
  try {
    const days = Number(req.query.days || 7);
    const labels = lastNDays(days);

    const [prodDia] = await db.query(`
      SELECT DataCriacao::date as periodo, COUNT(*) as total
      FROM Produtos
      WHERE DataCriacao >= CURRENT_DATE - ((? || ' days')::interval)
      GROUP BY DataCriacao::date
      ORDER BY DataCriacao::date ASC
    `, [days - 1]);

    const [notifDia] = await db.query(`
      SELECT COALESCE(DataEnvio, Data)::date as periodo, COUNT(*) as total
      FROM Notificacoes
      WHERE COALESCE(DataEnvio, Data) >= CURRENT_DATE - ((? || ' days')::interval)
      GROUP BY COALESCE(DataEnvio, Data)::date
      ORDER BY COALESCE(DataEnvio, Data)::date ASC
    `, [days - 1]);

    res.json({
      status: "ok",
      labels,
      series: {
        produtosCriados: buildSeries(prodDia, 'periodo', 'total', labels),
        notificacoes: buildSeries(notifDia, 'periodo', 'total', labels)
      }
    });
  } catch (err) {
    console.error("Erro charts/daily:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

export default router;


