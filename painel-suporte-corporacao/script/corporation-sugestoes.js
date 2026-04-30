(function() {
    'use strict';
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();

    let allItems = [];

    async function fetchAuth(url) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        if (!res.ok) throw new Error('Erro ao carregar sugestões');
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
        const map = { pendente: 'Pendente', pending: 'Pendente', aceite: 'Aceite', accepted: 'Aceite', aprovada: 'Aceite',
            rejeitada: 'Rejeitada', rejected: 'Rejeitada', implementada: 'Implementada', implemented: 'Implementada' };
        return map[(s || '').toLowerCase()] || s || '—';
    }

    function renderSummary() {
        const total = allItems.length;
        const accepted = allItems.filter(i => ['aceite', 'accepted', 'aprovada'].includes(statusKey(i.Status))).length;
        const implemented = allItems.filter(i => ['implementada', 'implemented'].includes(statusKey(i.Status))).length;
        const top = [...allItems].sort((a, b) => (b.Votos || 0) - (a.Votos || 0))[0];
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('summaryTotal', total);
        set('summaryAccepted', accepted);
        set('summaryImplemented', implemented);
        set('summaryTopVotes', top ? (top.Votos || 0) : 0);
        const topTitle = top ? ((window.APIUtils?.stripBracketPrefix?.(top.Titulo)) || top.Titulo || '—') : '—';
        const topEl = document.getElementById('summaryTopTitle');
        if (topEl) topEl.textContent = topTitle.length > 28 ? topTitle.slice(0, 28) + '…' : topTitle;
    }

    function applyFilters() {
        const status = document.getElementById('filterStatus')?.value || '';
        const plat = document.getElementById('filterPlataforma')?.value || '';
        const sort = document.getElementById('filterSort')?.value || 'recent';
        const search = (document.getElementById('filterSearch')?.value || '').toLowerCase().trim();

        let filtered = [...allItems];
        if (status) filtered = filtered.filter(i => statusKey(i.Status) === status || statusLabel(i.Status).toLowerCase() === status);
        if (plat) filtered = filtered.filter(i => (i.Plataforma || '').toLowerCase() === plat);
        if (search) {
            filtered = filtered.filter(i => {
                const t = ((window.APIUtils?.stripBracketPrefix?.(i.Titulo)) || i.Titulo || '').toLowerCase();
                const d = (i.Descricao || '').toLowerCase();
                return t.includes(search) || d.includes(search);
            });
        }
        filtered.sort((a, b) => {
            if (sort === 'votes') return (b.Votos || 0) - (a.Votos || 0);
            if (sort === 'oldest') return new Date(a.DataCriacao) - new Date(b.DataCriacao);
            return new Date(b.DataCriacao) - new Date(a.DataCriacao);
        });
        render(filtered);
        const countEl = document.getElementById('filterCount');
        if (countEl) countEl.textContent = `${filtered.length} de ${allItems.length}`;
    }

    function render(list) {
        const el = document.getElementById('sugestoesList');
        if (!el) return;
        if (!list.length) {
            el.innerHTML = '<div class="loading-state">Nenhuma sugestão encontrada.</div>';
            return;
        }
        el.innerHTML = list.map(s => {
            const titulo = (window.APIUtils?.stripBracketPrefix?.(s.Titulo)) || s.Titulo || 'Sem título';
            const sk = statusKey(s.Status);
            return `
                <div class="item-card">
                    <div class="item-head">
                        <span class="item-id">#${escapeHtml(s.Id)}</span>
                        <span class="item-votes">▲ ${escapeHtml(s.Votos ?? 0)}</span>
                    </div>
                    <h3 class="item-title">${escapeHtml(titulo)}</h3>
                    ${s.Descricao ? `<p class="item-desc">${escapeHtml(s.Descricao)}</p>` : ''}
                    <div class="item-meta">
                        <span class="status-pill ${escapeHtml(sk)}">${escapeHtml(statusLabel(s.Status))}</span>
                        ${s.Plataforma ? `<span class="platform-pill">${escapeHtml(s.Plataforma)}</span>` : ''}
                        ${s.Prioridade ? `<span><strong>Prio:</strong> ${escapeHtml(s.Prioridade)}</span>` : ''}
                        <span style="margin-left:auto;color:#6b7280">${escapeHtml(formatDate(s.DataCriacao))}</span>
                    </div>
                </div>`;
        }).join('');
    }

    async function load() {
        const el = document.getElementById('sugestoesList');
        if (!el) return;
        try {
            el.innerHTML = '<div class="loading-state">A carregar...</div>';
            const data = await fetchAuth('/api/corporation/sugestoes');
            allItems = data.sugestoes || [];
            renderSummary();
            applyFilters();
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color:#fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        load();
        document.getElementById('refreshSugestoesBtn')?.addEventListener('click', load);
        ['filterStatus', 'filterPlataforma', 'filterSort'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', applyFilters);
        });
        document.getElementById('filterSearch')?.addEventListener('input', applyFilters);
    });
})();
