/**
 * Painel Financeiro corporativo: KPIs, gráfico, transacções, payouts, assinaturas, export CSV.
 */
(function() {
    'use strict';

    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();

    async function fetchAuth(url, options = {}) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, {
            ...options,
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...options.headers }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Erro ${res.status}`);
        }
        return res.json();
    }

    function escapeHtml(t) {
        if (t === null || t === undefined) return '';
        const d = document.createElement('div');
        d.textContent = String(t);
        return d.innerHTML;
    }

    function fmtEur(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n);
    }

    function fmtDateTime(unixOrIso) {
        if (!unixOrIso) return '—';
        const d = typeof unixOrIso === 'number' ? new Date(unixOrIso * 1000) : new Date(unixOrIso);
        return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function fmtDate(unixOrIso) {
        if (!unixOrIso) return '—';
        const d = typeof unixOrIso === 'number' ? new Date(unixOrIso * 1000) : new Date(unixOrIso);
        return d.toLocaleDateString('pt-PT');
    }

    function statusPill(status, kind) {
        const map = {
            succeeded: 'ok', paid: 'ok', active: 'ok',
            pending: 'warn', in_transit: 'warn', incomplete: 'warn',
            failed: 'err', canceled: 'err', refunded: 'err',
            past_due: 'err', unpaid: 'err'
        };
        const cls = map[(status || '').toLowerCase()] || 'muted';
        return `<span class="pill ${cls}">${escapeHtml(status || '—')}</span>`;
    }

    function showStripeError(msg) {
        const banner = document.getElementById('stripeErrorBanner');
        if (!banner) return;
        if (msg) {
            banner.textContent = `⚠ Stripe: ${msg}`;
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
        }
    }

    // --- KPIs ---
    async function loadKpis() {
        try {
            const data = await fetchAuth('/api/corporation/financial/kpis');
            const k = data.kpis || {};
            document.getElementById('kpiRevenue').textContent = fmtEur(k.revenue30d);
            document.getElementById('kpiMrr').textContent = fmtEur(k.mrr);
            document.getElementById('kpiArr').textContent = `ARR: ${fmtEur(k.arr)}`;
            document.getElementById('kpiActive').textContent = k.activeSubscriptions ?? '—';
            document.getElementById('kpiChurn').textContent = `Churn: ${k.churnRate ?? 0}% (${k.cancelled30d ?? 0} cancelaram)`;
            document.getElementById('kpiBalance').textContent = fmtEur(k.availableBalance);
            document.getElementById('kpiPending').textContent = `Pendente: ${fmtEur(k.pendingBalance)}`;
            document.getElementById('kpiRefunds').textContent = fmtEur(k.refunds30d);

            const growthEl = document.getElementById('kpiRevenueGrowth');
            if (k.revenueGrowth === null || k.revenueGrowth === undefined) {
                growthEl.textContent = 'sem dados anteriores';
                growthEl.className = 'fin-card-sub';
            } else {
                const sign = k.revenueGrowth >= 0 ? '▲' : '▼';
                growthEl.textContent = `${sign} ${Math.abs(k.revenueGrowth)}% vs. 30d anteriores`;
                growthEl.className = 'fin-card-sub ' + (k.revenueGrowth >= 0 ? 'up' : 'down');
            }

            // Plan breakdown
            const breakdownEl = document.getElementById('planBreakdown');
            const breakdown = k.planBreakdown || {};
            const entries = Object.entries(breakdown).sort((a, b) => b[1].mrr - a[1].mrr);
            if (entries.length === 0) {
                breakdownEl.innerHTML = '<span style="color: #9ca3af; font-size: 0.9rem;">Sem assinaturas activas.</span>';
            } else {
                breakdownEl.innerHTML = entries.map(([name, info]) =>
                    `<div class="plan-chip"><strong>${escapeHtml(name)}</strong> ${info.count} • ${fmtEur(info.mrr)}/mês</div>`
                ).join('');
            }

            showStripeError(data.stripeError);
        } catch (e) {
            console.error('[FIN] KPIs erro:', e);
            showStripeError('Falha ao carregar KPIs: ' + e.message);
        }
    }

    // --- Gráfico SVG simples ---
    async function loadChart() {
        const svg = document.getElementById('revenueChart');
        if (!svg) return;
        try {
            const data = await fetchAuth('/api/corporation/financial/revenue-series?days=30');
            const series = data.series || [];
            if (series.length === 0) {
                svg.innerHTML = `<text x="400" y="120" text-anchor="middle" fill="#9ca3af" font-size="14">Sem dados de receita.</text>`;
                return;
            }
            const W = 800, H = 240, padL = 50, padR = 20, padT = 20, padB = 30;
            const innerW = W - padL - padR;
            const innerH = H - padT - padB;
            const maxVal = Math.max(...series.map(s => s.revenue), 1);
            const barW = innerW / series.length;

            let bars = '';
            let labels = '';
            series.forEach((s, i) => {
                const h = (s.revenue / maxVal) * innerH;
                const x = padL + (i * barW) + 1;
                const y = padT + innerH - h;
                bars += `<rect x="${x}" y="${y}" width="${barW - 2}" height="${h}" fill="#ff9800" opacity="0.85"><title>${s.date}: ${fmtEur(s.revenue)}</title></rect>`;
                if (i === 0 || i === series.length - 1 || i === Math.floor(series.length / 2)) {
                    labels += `<text x="${x + barW/2}" y="${H - 10}" text-anchor="middle" fill="#9ca3af" font-size="10">${s.date.slice(5)}</text>`;
                }
            });

            const yTicks = [0, maxVal / 2, maxVal];
            let yLabels = '';
            yTicks.forEach(v => {
                const y = padT + innerH - (v / maxVal) * innerH;
                yLabels += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#2a2a2c" stroke-dasharray="3,3"/>`;
                yLabels += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" fill="#9ca3af" font-size="10">${fmtEur(v)}</text>`;
            });

            svg.innerHTML = yLabels + bars + labels;
        } catch (e) {
            console.error('[FIN] Chart erro:', e);
            svg.innerHTML = `<text x="400" y="120" text-anchor="middle" fill="#fca5a5" font-size="12">Erro: ${escapeHtml(e.message)}</text>`;
        }
    }

    // --- Transacções ---
    async function loadTransactions() {
        const el = document.getElementById('finPanelTransactions');
        try {
            const data = await fetchAuth('/api/corporation/financial/transactions?limit=50');
            const tx = data.transactions || [];
            if (tx.length === 0) {
                el.innerHTML = '<div class="loading-state">Sem transacções.</div>';
                return;
            }
            el.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Cliente</th>
                            <th>Cartão</th>
                            <th>Valor</th>
                            <th>Estado</th>
                            <th>Recibo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tx.map(t => `
                            <tr>
                                <td>${fmtDateTime(t.createdAt)}</td>
                                <td>${escapeHtml(t.customerEmail || t.customerName || '—')}</td>
                                <td>${t.cardBrand ? `${escapeHtml(t.cardBrand)} ••${escapeHtml(t.cardLast4 || '')}` : '—'}</td>
                                <td><strong>${fmtEur(t.amount)}</strong>${t.amountRefunded > 0 ? ` <small style="color:#fca5a5;">(-${fmtEur(t.amountRefunded)})</small>` : ''}</td>
                                <td>${statusPill(t.status)}</td>
                                <td>${t.receiptUrl ? `<a href="${escapeHtml(t.receiptUrl)}" target="_blank" rel="noopener" style="color:#ff9800;">Ver</a>` : '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color:#fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    // --- Payouts ---
    async function loadPayouts() {
        const el = document.getElementById('finPanelPayouts');
        try {
            const data = await fetchAuth('/api/corporation/financial/payouts?limit=20');
            const list = data.payouts || [];
            if (list.length === 0) {
                el.innerHTML = '<div class="loading-state">Sem payouts ainda. Os depósitos no IBAN aparecem aqui.</div>';
                return;
            }
            el.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Criado</th>
                            <th>Chega ao banco</th>
                            <th>Valor</th>
                            <th>Método</th>
                            <th>Estado</th>
                            <th>Falha</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map(p => `
                            <tr>
                                <td>${fmtDate(p.createdAt)}</td>
                                <td><strong>${fmtDate(p.arrivalDate)}</strong></td>
                                <td><strong>${fmtEur(p.amount)}</strong></td>
                                <td>${escapeHtml(p.method || '—')}</td>
                                <td>${statusPill(p.status)}</td>
                                <td style="color:#fca5a5;">${escapeHtml(p.failureReason || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color:#fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    // --- Assinaturas ---
    async function loadSubscriptions() {
        const el = document.getElementById('finPanelSubscriptions');
        try {
            const data = await fetchAuth('/api/corporation/financial/subscriptions?limit=200&status=active');
            const subs = data.subscriptions || [];
            if (subs.length === 0) {
                el.innerHTML = '<div class="loading-state">Sem assinaturas activas.</div>';
                return;
            }
            el.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Utilizador</th>
                            <th>Email</th>
                            <th>Plano</th>
                            <th>Preço</th>
                            <th>Estado</th>
                            <th>Início</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${subs.map(s => `
                            <tr>
                                <td>${escapeHtml(s.user_nome || s.referenciaid || s.ReferenciaID || '—')}</td>
                                <td>${escapeHtml(s.user_email || '—')}</td>
                                <td><strong>${escapeHtml(s.plan_name || '—')}</strong></td>
                                <td>${fmtEur(parseFloat(s.plan_price || 0))}/mês</td>
                                <td>${statusPill(s.subscription_status || s.status)}</td>
                                <td>${fmtDate(s.created_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color:#fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    // --- Tabs ---
    function setActiveTab(tabName) {
        document.querySelectorAll('.fin-tabs .tab-button').forEach(b => {
            b.classList.toggle('active', b.dataset.finTab === tabName);
        });
        document.getElementById('finPanelTransactions').style.display = tabName === 'transactions' ? '' : 'none';
        document.getElementById('finPanelPayouts').style.display = tabName === 'payouts' ? '' : 'none';
        document.getElementById('finPanelSubscriptions').style.display = tabName === 'subscriptions' ? '' : 'none';

        if (tabName === 'transactions') loadTransactions();
        else if (tabName === 'payouts') loadPayouts();
        else if (tabName === 'subscriptions') loadSubscriptions();
    }

    // --- Export CSV ---
    async function exportCsv() {
        try {
            const safeUrl = window.APIUtils
                ? window.APIUtils.buildSafeUrl('/api/corporation/financial/export')
                : `${API_BASE}/api/corporation/financial/export`;
            const res = await fetch(safeUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Erro ${res.status}`);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `promoping-transacoes-${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            if (window.showAlert) showAlert('Erro ao exportar: ' + e.message);
            else alert('Erro ao exportar: ' + e.message);
        }
    }

    function refreshAll() {
        loadKpis();
        loadChart();
        const active = document.querySelector('.fin-tabs .tab-button.active');
        setActiveTab(active ? active.dataset.finTab : 'transactions');
    }

    document.addEventListener('DOMContentLoaded', () => {
        refreshAll();

        document.getElementById('refreshFinBtn')?.addEventListener('click', refreshAll);
        document.getElementById('exportCsvBtn')?.addEventListener('click', exportCsv);

        document.querySelectorAll('.fin-tabs .tab-button').forEach(btn => {
            btn.addEventListener('click', () => setActiveTab(btn.dataset.finTab));
        });
    });
})();
