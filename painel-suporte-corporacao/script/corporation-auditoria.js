/**
 * Painel de Auditoria — registo de acções administrativas.
 */
(function() {
    'use strict';
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();
    const PAGE_SIZE = 50;
    let currentOffset = 0;
    let currentTotal = 0;
    let lastLogs = [];

    async function fetchAuth(url) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
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

    function fmtDateTime(s) {
        if (!s) return '—';
        return new Date(s).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function buildQuery() {
        const params = new URLSearchParams();
        const action = document.getElementById('filterAction').value;
        const actor = document.getElementById('filterActor').value.trim();
        const from = document.getElementById('filterFrom').value;
        const to = document.getElementById('filterTo').value;
        if (action) params.set('action', action);
        if (actor) params.set('actor', actor);
        if (from) params.set('from', from);
        if (to) params.set('to', to + 'T23:59:59');
        params.set('limit', PAGE_SIZE);
        params.set('offset', currentOffset);
        return params.toString();
    }

    async function loadActions() {
        try {
            const data = await fetchAuth('/api/corporation/audit/actions');
            const select = document.getElementById('filterAction');
            const current = select.value;
            select.innerHTML = '<option value="">Todas</option>' +
                (data.actions || []).map(a => `<option value="${escapeHtml(a.action)}">${escapeHtml(a.action)} (${a.count})</option>`).join('');
            select.value = current;
        } catch (e) {
            console.warn('[AUDIT] /actions falhou:', e);
        }
    }

    async function loadLogs() {
        const el = document.getElementById('auditList');
        el.innerHTML = '<div class="loading-state">A carregar...</div>';
        try {
            const data = await fetchAuth('/api/corporation/audit/logs?' + buildQuery());
            const logs = data.logs || [];
            lastLogs = logs;
            currentTotal = data.total || 0;

            if (logs.length === 0) {
                el.innerHTML = '<div class="loading-state">Nenhum registo encontrado.</div>';
                updatePagination();
                return;
            }

            el.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Data/Hora</th>
                            <th>Actor</th>
                            <th>Acção</th>
                            <th>Alvo</th>
                            <th>Detalhes</th>
                            <th>IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map((l, i) => `
                            <tr>
                                <td>${fmtDateTime(l.created_at)}</td>
                                <td>
                                    <strong>${escapeHtml(l.actor_nome || l.actor_email || l.actor_referenciaid)}</strong>
                                    <div style="font-size: 0.75rem; color: #9ca3af;">${escapeHtml(l.actor_referenciaid)}</div>
                                </td>
                                <td><span class="pill">${escapeHtml(l.action)}</span></td>
                                <td>
                                    ${l.target_type ? `<small style="color:#9ca3af;">${escapeHtml(l.target_type)}</small><br>` : ''}
                                    ${l.target_id ? `<code>${escapeHtml(l.target_id)}</code>` : '—'}
                                </td>
                                <td>
                                    <div class="audit-row-detail" data-log-idx="${i}" title="Clique para ver">
                                        ${l.details ? escapeHtml(JSON.stringify(l.details)) : '—'}
                                    </div>
                                </td>
                                <td><code style="font-size: 0.8rem;">${escapeHtml(l.ip || '—')}</code></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            el.querySelectorAll('[data-log-idx]').forEach(d => {
                d.addEventListener('click', () => openDetail(parseInt(d.dataset.logIdx)));
            });

            updatePagination();
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color:#fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    function updatePagination() {
        const info = document.getElementById('paginationInfo');
        const start = currentTotal === 0 ? 0 : currentOffset + 1;
        const end = Math.min(currentOffset + PAGE_SIZE, currentTotal);
        info.textContent = `${start}-${end} de ${currentTotal}`;
        document.getElementById('prevPageBtn').disabled = currentOffset === 0;
        document.getElementById('nextPageBtn').disabled = end >= currentTotal;
    }

    function openDetail(idx) {
        const log = lastLogs[idx];
        if (!log) return;
        const modal = document.getElementById('auditDetailModal');
        const body = document.getElementById('auditDetailBody');
        body.innerHTML = `
            <div style="display: grid; gap: 0.75rem;">
                <div><strong>ID:</strong> <code>${log.id}</code></div>
                <div><strong>Data/Hora:</strong> ${fmtDateTime(log.created_at)}</div>
                <div><strong>Actor:</strong> ${escapeHtml(log.actor_nome || '—')} (${escapeHtml(log.actor_email || '')})</div>
                <div><strong>ReferenciaID:</strong> <code>${escapeHtml(log.actor_referenciaid)}</code></div>
                <div><strong>PerfilId:</strong> ${log.actor_perfil ?? '—'}</div>
                <div><strong>Acção:</strong> <span class="pill">${escapeHtml(log.action)}</span></div>
                <div><strong>Tipo de alvo:</strong> ${escapeHtml(log.target_type || '—')}</div>
                <div><strong>ID do alvo:</strong> <code>${escapeHtml(log.target_id || '—')}</code></div>
                <div><strong>IP:</strong> <code>${escapeHtml(log.ip || '—')}</code></div>
                <div><strong>User-Agent:</strong><br><small style="color:#9ca3af;">${escapeHtml(log.user_agent || '—')}</small></div>
                <div><strong>Detalhes:</strong>
                    <pre style="background: #0f0f10; border: 1px solid #2a2a2c; padding: 0.75rem; border-radius: 6px; overflow-x: auto; font-size: 0.8rem; color: #e5e7eb;">${escapeHtml(log.details ? JSON.stringify(log.details, null, 2) : '—')}</pre>
                </div>
            </div>
        `;
        modal.classList.add('show');
    }

    function closeDetail() {
        document.getElementById('auditDetailModal').classList.remove('show');
    }

    function applyFilters() {
        currentOffset = 0;
        loadLogs();
    }

    function clearFilters() {
        document.getElementById('filterAction').value = '';
        document.getElementById('filterActor').value = '';
        document.getElementById('filterFrom').value = '';
        document.getElementById('filterTo').value = '';
        applyFilters();
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadActions();
        loadLogs();

        document.getElementById('refreshAuditBtn')?.addEventListener('click', () => { loadActions(); loadLogs(); });
        document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);
        document.getElementById('clearFiltersBtn')?.addEventListener('click', clearFilters);
        document.getElementById('filterAction')?.addEventListener('change', applyFilters);
        document.getElementById('prevPageBtn')?.addEventListener('click', () => {
            currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
            loadLogs();
        });
        document.getElementById('nextPageBtn')?.addEventListener('click', () => {
            currentOffset += PAGE_SIZE;
            loadLogs();
        });
        document.getElementById('closeAuditDetailModal')?.addEventListener('click', closeDetail);
        document.getElementById('closeAuditDetailBtn')?.addEventListener('click', closeDetail);
        document.getElementById('auditDetailModal')?.addEventListener('click', (e) => { if (e.target.id === 'auditDetailModal') closeDetail(); });
    });
})();
