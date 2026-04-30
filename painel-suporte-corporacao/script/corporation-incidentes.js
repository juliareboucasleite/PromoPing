(function() {
    'use strict';
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();

    let allItems = [];

    async function fetchAuth(url) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        if (!res.ok) throw new Error('Erro ao carregar incidentes');
        return res.json();
    }

    function escapeHtml(t) {
        if (t === null || t === undefined) return '';
        const d = document.createElement('div');
        d.textContent = String(t);
        return d.innerHTML;
    }

    function formatDate(s) {
        if (!s) return '—';
        return new Date(s).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function statusKey(s) { return (s || '').toLowerCase(); }
    function statusLabel(s) {
        return ({ investigating: 'A investigar', identified: 'Identificado', monitoring: 'A monitorar', resolved: 'Resolvido' })[statusKey(s)] || s || '—';
    }

    function renderSummary() {
        const total = allItems.length;
        const active = allItems.filter(i => statusKey(i.Status) !== 'resolved').length;
        const resolved = allItems.filter(i => statusKey(i.Status) === 'resolved').length;
        const oneHour = Date.now() - 60 * 60 * 1000;
        const recent = allItems.filter(i => new Date(i.DataInicio || i.DataCriacao).getTime() >= oneHour).length;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('summaryActive', active);
        set('summaryResolved', resolved);
        set('summaryRecent', recent);
        set('summaryTotal', total);
    }

    function applyFilters() {
        const status = document.getElementById('filterStatus')?.value || '';
        const impact = document.getElementById('filterImpact')?.value || '';
        const search = (document.getElementById('filterSearch')?.value || '').toLowerCase().trim();

        let filtered = [...allItems];
        if (status) filtered = filtered.filter(i => statusKey(i.Status) === status);
        if (impact) filtered = filtered.filter(i => (i.Impacto || '').toLowerCase() === impact);
        if (search) {
            filtered = filtered.filter(i => {
                const t = ((window.APIUtils?.stripBracketPrefix?.(i.Titulo)) || i.Titulo || '').toLowerCase();
                const d = (i.Descricao || '').toLowerCase();
                const c = (i.ComponenteAfetado || '').toLowerCase();
                return t.includes(search) || d.includes(search) || c.includes(search);
            });
        }
        render(filtered);
        const countEl = document.getElementById('filterCount');
        if (countEl) countEl.textContent = `${filtered.length} de ${allItems.length}`;
    }

    function render(list) {
        const el = document.getElementById('incidentList');
        if (!el) return;
        if (!list.length) {
            el.innerHTML = '<div class="loading-state">Nenhum incidente encontrado.</div>';
            return;
        }
        el.innerHTML = list.map(i => {
            const titulo = (window.APIUtils?.stripBracketPrefix?.(i.Titulo)) || i.Titulo || 'Sem título';
            const sk = statusKey(i.Status);
            const impactClass = (i.Impacto || '').toLowerCase();
            return `
                <div class="item-card status-${escapeHtml(sk)}">
                    <div class="item-head">
                        <span class="item-id">#${escapeHtml(i.Id)}</span>
                        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center">
                            <span class="status-pill ${escapeHtml(sk)}">${escapeHtml(statusLabel(i.Status))}</span>
                            ${i.Impacto ? `<span class="impact-pill ${escapeHtml(impactClass)}">${escapeHtml(i.Impacto)}</span>` : ''}
                        </div>
                    </div>
                    <h3 class="item-title">${escapeHtml(titulo)}</h3>
                    ${i.Descricao ? `<p class="item-desc">${escapeHtml(i.Descricao)}</p>` : ''}
                    <div class="item-meta">
                        ${i.ComponenteAfetado ? `<span><strong>Componente:</strong> ${escapeHtml(i.ComponenteAfetado)}</span>` : ''}
                        <span><strong>Início:</strong> ${escapeHtml(formatDate(i.DataInicio))}</span>
                        ${i.DataFim ? `<span><strong>Fim:</strong> ${escapeHtml(formatDate(i.DataFim))}</span>` : ''}
                        ${i.Duracao ? `<span><strong>Duração:</strong> ${escapeHtml(i.Duracao)}</span>` : ''}
                    </div>
                </div>`;
        }).join('');
    }

    async function load() {
        const el = document.getElementById('incidentList');
        if (!el) return;
        try {
            el.innerHTML = '<div class="loading-state">A carregar...</div>';
            const data = await fetchAuth('/api/corporation/incidents');
            allItems = data.incidents || [];
            renderSummary();
            applyFilters();
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color:#fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        load();
        document.getElementById('refreshIncBtn')?.addEventListener('click', load);
        ['filterStatus', 'filterImpact'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', applyFilters);
        });
        document.getElementById('filterSearch')?.addEventListener('input', applyFilters);
    });
})();
