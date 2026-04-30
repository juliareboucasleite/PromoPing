/**
 * Sub-rotas financeiras do painel corporativo.
 * Montado em /api/corporation/financial — herda verifyToken + verifyCorporation.
 *
 * Combina dados locais (stripe_subscriptions + planos) com a Stripe API
 * (charges, payouts, balance) para dar uma visão financeira completa.
 */

import express from "express";
import { pool } from "../database/db.js";
import stripe from "../config/stripe.js";

const router = express.Router();

function dbErr(err, res, msg) {
    console.error("[CORP-FIN]", msg, err);
    if (err && (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'PROTOCOL_CONNECTION_LOST')) {
        return res.status(503).json({ status: "error", error: "Banco de dados indisponível." });
    }
    return res.status(500).json({ status: "error", error: msg || "Erro interno" });
}

function isStripeReady() {
    const key = process.env.STRIPE_SECRET_KEY;
    return Boolean(key && !key.includes('placeholder'));
}

function centsToEuros(cents) {
    if (typeof cents !== 'number') return 0;
    return Math.round(cents) / 100;
}

/**
 * GET /kpis
 * Devolve KPIs principais: receita 30d, MRR, assinaturas activas, churn, saldo Stripe.
 */
router.get("/kpis", async (req, res) => {
    try {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        const sixtyDaysAgo = now - (60 * 24 * 60 * 60);

        // --- Local DB: assinaturas activas + MRR ---
        const [activeSubs] = await pool.query(
            `SELECT s.plan_name, s.subscription_status, p.Preco
             FROM stripe_subscriptions s
             LEFT JOIN planos p ON LOWER(p.Nome) = LOWER(s.plan_name)
             WHERE s.subscription_status = 'active' OR s.status = 'active'`
        );

        const totalActive = activeSubs.length;
        let mrr = 0;
        const planBreakdown = {};
        for (const sub of activeSubs) {
            const preco = parseFloat(sub.Preco || 0);
            mrr += preco;
            const key = sub.plan_name || 'desconhecido';
            if (!planBreakdown[key]) planBreakdown[key] = { count: 0, mrr: 0 };
            planBreakdown[key].count += 1;
            planBreakdown[key].mrr += preco;
        }

        // Cancelamentos nos últimos 30d (para churn)
        const [cancelled30d] = await pool.query(
            `SELECT COUNT(*) AS c
             FROM stripe_subscriptions
             WHERE (subscription_status = 'canceled' OR status = 'canceled')
               AND updated_at >= NOW() - INTERVAL '30 days'`
        );
        const cancelledCount = parseInt(cancelled30d[0]?.c || 0);
        const churnRate = totalActive > 0 ? (cancelledCount / (totalActive + cancelledCount)) * 100 : 0;

        // --- Stripe API (se disponível): receita 30d, saldo ---
        let revenue30d = 0;
        let revenue30dPrev = 0;
        let refunds30d = 0;
        let availableBalance = 0;
        let pendingBalance = 0;
        let stripeError = null;

        if (isStripeReady()) {
            try {
                const charges = await stripe.charges.list({
                    limit: 100,
                    created: { gte: thirtyDaysAgo }
                });
                for (const c of charges.data) {
                    if (c.status === 'succeeded' && !c.refunded) {
                        revenue30d += c.amount - (c.amount_refunded || 0);
                    }
                    if (c.amount_refunded) refunds30d += c.amount_refunded;
                }

                const prevCharges = await stripe.charges.list({
                    limit: 100,
                    created: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
                });
                for (const c of prevCharges.data) {
                    if (c.status === 'succeeded' && !c.refunded) {
                        revenue30dPrev += c.amount - (c.amount_refunded || 0);
                    }
                }

                const balance = await stripe.balance.retrieve();
                availableBalance = (balance.available || []).reduce((s, b) => s + b.amount, 0);
                pendingBalance = (balance.pending || []).reduce((s, b) => s + b.amount, 0);
            } catch (e) {
                console.warn("[CORP-FIN] Stripe API falhou:", e.message);
                stripeError = e.message;
            }
        } else {
            stripeError = "Stripe não configurado (STRIPE_SECRET_KEY ausente).";
        }

        const revenueGrowth = revenue30dPrev > 0
            ? ((revenue30d - revenue30dPrev) / revenue30dPrev) * 100
            : null;

        res.json({
            status: "ok",
            kpis: {
                mrr: Number(mrr.toFixed(2)),
                arr: Number((mrr * 12).toFixed(2)),
                activeSubscriptions: totalActive,
                cancelled30d: cancelledCount,
                churnRate: Number(churnRate.toFixed(2)),
                revenue30d: centsToEuros(revenue30d),
                revenue30dPrev: centsToEuros(revenue30dPrev),
                revenueGrowth: revenueGrowth !== null ? Number(revenueGrowth.toFixed(2)) : null,
                refunds30d: centsToEuros(refunds30d),
                availableBalance: centsToEuros(availableBalance),
                pendingBalance: centsToEuros(pendingBalance),
                planBreakdown
            },
            stripeError
        });
    } catch (err) {
        return dbErr(err, res, "Erro ao calcular KPIs financeiros");
    }
});

/**
 * GET /revenue-series?days=30
 * Receita diária para o gráfico.
 */
router.get("/revenue-series", async (req, res) => {
    try {
        const days = Math.max(7, Math.min(365, parseInt(req.query.days) || 30));
        const now = Math.floor(Date.now() / 1000);
        const since = now - (days * 24 * 60 * 60);

        const buckets = {};
        for (let i = 0; i < days; i++) {
            const d = new Date((now - (i * 24 * 60 * 60)) * 1000);
            const key = d.toISOString().slice(0, 10);
            buckets[key] = 0;
        }

        if (!isStripeReady()) {
            return res.json({ status: "ok", series: [], stripeError: "Stripe não configurado." });
        }

        let starting_after = null;
        let pages = 0;
        const maxPages = 10;
        while (pages < maxPages) {
            const params = { limit: 100, created: { gte: since } };
            if (starting_after) params.starting_after = starting_after;
            const charges = await stripe.charges.list(params);
            for (const c of charges.data) {
                if (c.status !== 'succeeded') continue;
                const key = new Date(c.created * 1000).toISOString().slice(0, 10);
                if (key in buckets) {
                    buckets[key] += (c.amount - (c.amount_refunded || 0));
                }
            }
            if (!charges.has_more) break;
            starting_after = charges.data[charges.data.length - 1]?.id;
            if (!starting_after) break;
            pages += 1;
        }

        const series = Object.keys(buckets).sort().map(date => ({
            date,
            revenue: centsToEuros(buckets[date])
        }));

        res.json({ status: "ok", series });
    } catch (err) {
        console.error("[CORP-FIN] revenue-series:", err);
        return res.status(500).json({ status: "error", error: err.message });
    }
});

/**
 * GET /transactions?limit=50&starting_after=&status=
 * Lista de transacções (charges) da Stripe.
 */
router.get("/transactions", async (req, res) => {
    try {
        if (!isStripeReady()) {
            return res.json({ status: "ok", transactions: [], stripeError: "Stripe não configurado." });
        }
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 50));
        const params = { limit };
        if (req.query.starting_after) params.starting_after = req.query.starting_after;
        if (req.query.from || req.query.to) {
            params.created = {};
            if (req.query.from) params.created.gte = Math.floor(new Date(req.query.from).getTime() / 1000);
            if (req.query.to) params.created.lte = Math.floor(new Date(req.query.to).getTime() / 1000);
        }

        const charges = await stripe.charges.list(params);
        const filtered = req.query.status
            ? charges.data.filter(c => c.status === req.query.status)
            : charges.data;

        const transactions = filtered.map(c => ({
            id: c.id,
            amount: centsToEuros(c.amount),
            amountRefunded: centsToEuros(c.amount_refunded || 0),
            currency: c.currency,
            status: c.status,
            refunded: c.refunded,
            description: c.description,
            customerEmail: c.billing_details?.email || c.receipt_email,
            customerName: c.billing_details?.name,
            paymentMethod: c.payment_method_details?.type,
            cardBrand: c.payment_method_details?.card?.brand,
            cardLast4: c.payment_method_details?.card?.last4,
            createdAt: c.created,
            receiptUrl: c.receipt_url
        }));

        res.json({
            status: "ok",
            transactions,
            hasMore: charges.has_more,
            nextCursor: charges.has_more ? charges.data[charges.data.length - 1]?.id : null
        });
    } catch (err) {
        console.error("[CORP-FIN] transactions:", err);
        return res.status(500).json({ status: "error", error: err.message });
    }
});

/**
 * GET /payouts?limit=20
 * Lista de payouts da Stripe (depósitos no IBAN).
 */
router.get("/payouts", async (req, res) => {
    try {
        if (!isStripeReady()) {
            return res.json({ status: "ok", payouts: [], stripeError: "Stripe não configurado." });
        }
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
        const payouts = await stripe.payouts.list({ limit });

        const list = payouts.data.map(p => ({
            id: p.id,
            amount: centsToEuros(p.amount),
            currency: p.currency,
            status: p.status,
            arrivalDate: p.arrival_date,
            createdAt: p.created,
            method: p.method,
            type: p.type,
            description: p.description,
            failureReason: p.failure_message
        }));

        res.json({ status: "ok", payouts: list, hasMore: payouts.has_more });
    } catch (err) {
        console.error("[CORP-FIN] payouts:", err);
        return res.status(500).json({ status: "error", error: err.message });
    }
});

/**
 * GET /subscriptions
 * Assinaturas activas locais com info de utilizador e plano.
 */
router.get("/subscriptions", async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(500, parseInt(req.query.limit) || 100));
        const offset = Math.max(0, parseInt(req.query.offset) || 0);
        const statusFilter = req.query.status;

        let where = "";
        const params = [];
        if (statusFilter === 'active') where = "WHERE (s.subscription_status = 'active' OR s.status = 'active')";
        else if (statusFilter === 'canceled') where = "WHERE (s.subscription_status = 'canceled' OR s.status = 'canceled')";

        const [rows] = await pool.query(
            `SELECT s.id, s.ReferenciaID, s.customer_id, s.subscription_id,
                    s.subscription_status, s.status, s.plan_name, s.created_at, s.updated_at,
                    s.grace_period_end, s.cancellation_reason,
                    u.Nome AS user_nome, u.Email AS user_email,
                    p.Preco AS plan_price
             FROM stripe_subscriptions s
             LEFT JOIN utilizadores u ON u.ReferenciaID = s.ReferenciaID
             LEFT JOIN planos p ON LOWER(p.Nome) = LOWER(s.plan_name)
             ${where}
             ORDER BY s.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({ status: "ok", subscriptions: rows });
    } catch (err) {
        return dbErr(err, res, "Erro ao listar assinaturas");
    }
});

/**
 * GET /export?from=&to=
 * Exporta transacções como CSV.
 */
router.get("/export", async (req, res) => {
    try {
        if (!isStripeReady()) {
            return res.status(503).json({ status: "error", error: "Stripe não configurado." });
        }

        const params = { limit: 100 };
        if (req.query.from || req.query.to) {
            params.created = {};
            if (req.query.from) params.created.gte = Math.floor(new Date(req.query.from).getTime() / 1000);
            if (req.query.to) params.created.lte = Math.floor(new Date(req.query.to).getTime() / 1000);
        }

        const all = [];
        let starting_after = null;
        let pages = 0;
        const maxPages = 20;
        while (pages < maxPages) {
            const p = { ...params };
            if (starting_after) p.starting_after = starting_after;
            const charges = await stripe.charges.list(p);
            all.push(...charges.data);
            if (!charges.has_more) break;
            starting_after = charges.data[charges.data.length - 1]?.id;
            if (!starting_after) break;
            pages += 1;
        }

        const escapeCsv = (v) => {
            if (v === null || v === undefined) return '';
            const s = String(v).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
        };

        const header = ['id','data','status','valor_eur','reembolsado_eur','moeda','email','nome','cartao','last4','descricao'];
        const lines = [header.join(',')];
        for (const c of all) {
            lines.push([
                c.id,
                new Date(c.created * 1000).toISOString(),
                c.status,
                centsToEuros(c.amount).toFixed(2),
                centsToEuros(c.amount_refunded || 0).toFixed(2),
                (c.currency || '').toUpperCase(),
                c.billing_details?.email || c.receipt_email || '',
                c.billing_details?.name || '',
                c.payment_method_details?.card?.brand || '',
                c.payment_method_details?.card?.last4 || '',
                c.description || ''
            ].map(escapeCsv).join(','));
        }

        const csv = '﻿' + lines.join('\n');
        const filename = `promoping-transacoes-${new Date().toISOString().slice(0,10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (err) {
        console.error("[CORP-FIN] export:", err);
        return res.status(500).json({ status: "error", error: err.message });
    }
});

export default router;
