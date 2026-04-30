(function() {
    'use strict';
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();

    let allBugs = [];

    async function fetchAuth(url) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        if (!res.ok) throw new Error('Erro ao carregar bugs');
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

    function statusKey(s) {
        return (s || '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    }

    function statusLabel(s) {
        const map = { open: 'Aberto', in_progress: 'Em progresso', 'in-progress': 'Em progresso', resolved: 'Resolvido', closed: 'Fechado' };
        return map[(s || '').toLowerCase()] || s || '—';
    }

    function tipoLabel(t) {
        return ({ bug: 'Bug', projeto: 'Projeto', melhoria: 'Melhoria' })[t] || t || '—';
    }

    function tipoClass(t) {
        return ({ bug: 'bug', projeto: 'projeto', melhoria: 'melhoria' })[t] || 'default';
    }

    function priorityClass(p) {
        return (p || '').toLowerCase();
    }

    function renderSummary() {
        const open = allBugs.filter(b => statusKey(b.Status) === 'open').length;
        const progress = allBugs.filter(b => statusKey(b.Status) === 'in_progress').length;
        const resolved = allBugs.filter(b => statusKey(b.Status) === 'resolved').length;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('summaryOpen', open);
        set('summaryProgress', progress);
        set('summaryResolved', resolved);
        set('summaryTotal', allBugs.length);
    }

    function applyFilters() {
        const tipo = document.getElementById('filterTipo')?.value || '';
        const status = document.getElementById('filterStatus')?.value || '';
        const prioridade = document.getElementById('filterPrioridade')?.value || '';
        const search = (document.getElementById('filterSearch')?.value || '').toLowerCase().trim();

        let filtered = [...allBugs];
        if (tipo) filtered = filtered.filter(b => (b.Tipo || '').toLowerCase() === tipo);
        if (status) filtered = filtered.filter(b => statusKey(b.Status) === statusKey(status));
        if (prioridade) filtered = filtered.filter(b => (b.Prioridade || '').toLowerCase() === prioridade);
        if (search) {
            filtered = filtered.filter(b => {
                const t = ((window.APIUtils?.stripBracketPrefix?.(b.Titulo)) || b.Titulo || '').toLowerCase();
                const d = (b.Descricao || '').toLowerCase();
                return t.includes(search) || d.includes(search);
            });
        }
        render(filtered);
        const countEl = document.getElementById('filterCount');
        if (countEl) countEl.textContent = `${filtered.length} de ${allBugs.length}`;
    }

    function render(list) {
        const el = document.getElementById('bugsList');
        if (!el) return;
        if (!list.length) {
            el.innerHTML = '<div class="loading-state">Nenhum bug ou projeto encontrado.</div>';
            return;
        }
        el.innerHTML = list.map(b => {
            const titulo = (window.APIUtils?.stripBracketPrefix?.(b.Titulo)) || b.Titulo || 'Sem título';
            const sk = statusKey(b.Status);
            const pc = priorityClass(b.Prioridade);
            return `
                <div class="item-card priority-${escapeHtml(pc)}">
                    <div class="item-head">
                        <span class="item-id">#${escapeHtml(b.Id)}</span>
                        <span class="item-tag ${escapeHtml(tipoClass(b.Tipo))}">${escapeHtml(tipoLabel(b.Tipo))}</span>
                    </div>
                    <h3 class="item-title">${escapeHtml(titulo)}</h3>
                    ${b.Descricao ? `<p class="item-desc">${escapeHtml(b.Descricao)}</p>` : ''}
                    <div class="item-meta">
                        <span class="status-pill ${escapeHtml(sk)}">${escapeHtml(statusLabel(b.Status))}</span>
                        ${b.Prioridade ? `<span><strong>Prioridade:</strong> ${escapeHtml(b.Prioridade)}</span>` : ''}
                        ${b.author_nome ? `<span><strong>Por:</strong> ${escapeHtml(b.author_nome)}</span>` : ''}
                        <span style="margin-left:auto;color:#6b7280">${escapeHtml(formatDate(b.DataCriacao))}</span>
                    </div>
                </div>`;
        }).join('');
    }

    async function load() {
        const el = document.getElementById('bugsList');
        if (!el) return;
        try {
            el.innerHTML = '<div class="loading-state">A carregar...</div>';
            const data = await fetchAuth('/api/corporation/bugs');
            allBugs = data.bugs || [];
            renderSummary();
            applyFilters();
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color:#fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        load();
        document.getElementById('refreshBugsBtn')?.addEventListener('click', load);
        ['filterTipo', 'filterStatus', 'filterPrioridade'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', applyFilters);
        });
        document.getElementById('filterSearch')?.addEventListener('input', applyFilters);
    });
})();
