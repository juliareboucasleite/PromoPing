(function() {
    'use strict';
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();

    async function fetchAuth(url) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        if (!res.ok) throw new Error('Erro ao carregar dados');
        return res.json();
    }

    function escapeHtml(t) {
        if (!t) return '';
        const d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }

    function formatDate(s) {
        if (!s) return 'N/A';
        return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatDateTime(s) {
        if (!s) return 'N/A';
        return new Date(s).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    async function load() {
        const el = document.getElementById('staffList');
        if (!el) return;
        try {
            const data = await fetchAuth('/api/corporation/staff');
            const staff = data.staff || [];
            if (staff.length === 0) {
                el.innerHTML = '<div class="loading-state">Nenhum funcionário encontrado</div>';
                return;
            }
            el.innerHTML = `
                <table class="data-table">
                    <thead><tr><th>ReferenciaID</th><th>Nome</th><th>Email</th><th>Telefone</th><th>Cargo / Função</th><th>Registo</th><th></th></tr></thead>
                    <tbody>
                        ${staff.map(s => `
                            <tr>
                                <td><code style="font-size: 0.85rem;">${escapeHtml(s.ReferenciaID || '-')}</code></td>
                                <td>${escapeHtml(s.Nome)}</td>
                                <td>${escapeHtml(s.Email)}</td>
                                <td>${escapeHtml(s.Telefone || '-')}</td>
                                <td>${escapeHtml(s.PerfilNome || 'Suporte')}</td>
                                <td>${formatDate(s.DataRegisto)}</td>
                                <td><button type="button" class="refresh-button" data-ref="${escapeHtml(s.ReferenciaID)}" style="padding: 0.25rem 0.5rem;">Ver detalhe</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
            el.querySelectorAll('[data-ref]').forEach(btn => {
                btn.addEventListener('click', () => openDetail(btn.getAttribute('data-ref')));
            });
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    async function openDetail(referenciaID) {
        const modal = document.getElementById('staffModal');
        const title = document.getElementById('staffModalTitle');
        const body = document.getElementById('staffModalBody');
        if (!modal || !body) return;
        body.innerHTML = '<div class="loading-state">A carregar...</div>';
        modal.classList.add('show');
        try {
            const [staffRes, activityRes] = await Promise.all([
                fetchAuth(`/api/corporation/staff/${encodeURIComponent(referenciaID)}`),
                fetchAuth(`/api/corporation/staff/${encodeURIComponent(referenciaID)}/activity`)
            ]);
            const s = staffRes.staff;
            const act = activityRes.activity || {};
            const events = act.calendarEvents || [];
            const bugs = act.bugsProjetos || [];
            const supportCount = act.supportThreadsCount || 0;
            const notifs = act.notifications || [];

            title.textContent = s.Nome || 'Funcionário';

            var tabStyle = 'padding: 0.5rem 0.75rem; margin-right: 0.25rem; border: 1px solid #232326; background: #18181b; color: #9ca3af; cursor: pointer; font-size: 0.85rem; border-radius: 4px;';
            var tabActive = 'background: #3b82f6; color: #fff; border-color: #3b82f6;';

            var html = '<div class="staff-modal-tabs" style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 1rem; border-bottom: 1px solid #232326; padding-bottom: 0.75rem;">';
            html += '<button type="button" class="staff-tab active" data-tab="dados" style="' + tabStyle + tabActive + '">Dados</button>';
            html += '<button type="button" class="staff-tab" data-tab="eventos" style="' + tabStyle + '">Eventos (' + events.length + ')</button>';
            html += '<button type="button" class="staff-tab" data-tab="projetos" style="' + tabStyle + '">Bugs/Projetos (' + bugs.length + ')</button>';
            html += '<button type="button" class="staff-tab" data-tab="suporte" style="' + tabStyle + '">Suporte (' + supportCount + ')</button>';
            html += '<button type="button" class="staff-tab" data-tab="incidentes" style="' + tabStyle + '">Incidentes (' + notifs.length + ')</button>';
            html += '</div>';

            html += '<div id="staffTabDados" class="staff-tab-pane" style="display: block;">';
            html += '<div style="display: grid; gap: 0.75rem;">';
            html += '<p><strong>ReferenciaID:</strong> <code>' + escapeHtml(s.ReferenciaID || '-') + '</code></p>';
            html += '<p><strong>Nome:</strong> ' + escapeHtml(s.Nome) + '</p>';
            html += '<p><strong>Email:</strong> ' + escapeHtml(s.Email) + '</p>';
            html += '<p><strong>Telefone:</strong> ' + escapeHtml(s.Telefone || '-') + '</p>';
            html += '<p><strong>Cargo / Função:</strong> ' + escapeHtml(s.PerfilNome || 'Suporte') + '</p>';
            html += '<p><strong>Data de registo:</strong> ' + formatDate(s.DataRegisto) + '</p>';
            html += '</div></div>';

            html += '<div id="staffTabEventos" class="staff-tab-pane" style="display: none;">';
            if (events.length === 0) {
                html += '<p style="color: #6b7280; font-size: 0.9rem;">Nenhum evento no calendário.</p>';
            } else {
                html += '<ul style="list-style: none; padding: 0; margin: 0; font-size: 0.9rem;">';
                events.forEach(function(ev) {
                    html += '<li style="padding: 0.5rem 0; border-bottom: 1px solid #232326;">' + escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(ev.Titulo)) || ev.Titulo || 'Sem título') + ' <span style="color: #9ca3af;">(' + (ev.Tipo || '-') + ', ' + (ev.Status || '-') + ')</span> — ' + formatDateTime(ev.StartDate) + '</li>';
                });
                html += '</ul>';
            }
            html += '</div>';

            html += '<div id="staffTabProjetos" class="staff-tab-pane" style="display: none;">';
            if (bugs.length === 0) {
                html += '<p style="color: #6b7280; font-size: 0.9rem;">Nenhum bug ou projeto associado.</p>';
            } else {
                html += '<ul style="list-style: none; padding: 0; margin: 0; font-size: 0.9rem;">';
                bugs.forEach(function(b) {
                    html += '<li style="padding: 0.5rem 0; border-bottom: 1px solid #232326;">#' + b.Id + ' ' + escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(b.Titulo)) || b.Titulo || 'Sem título') + ' <span style="color: #9ca3af;">(' + (b.Tipo || '-') + ', ' + (b.Status || '-') + ')</span> — ' + formatDate(b.DataCriacao) + '</li>';
                });
                html += '</ul>';
            }
            html += '</div>';

            html += '<div id="staffTabSuporte" class="staff-tab-pane" style="display: none;">';
            html += '<p style="font-size: 0.9rem;">Participou em <strong>' + supportCount + '</strong> conversa(s) de suporte (respostas dadas).</p>';
            html += '</div>';

            html += '<div id="staffTabIncidentes" class="staff-tab-pane" style="display: none;">';
            if (notifs.length === 0) {
                html += '<p style="color: #6b7280; font-size: 0.9rem;">Nenhum incidente ou atualização registado por este funcionário.</p>';
            } else {
                html += '<ul style="list-style: none; padding: 0; margin: 0; font-size: 0.9rem;">';
                notifs.forEach(function(n) {
                    var tipoLabel = n.Tipo === 'incident_resolved' ? 'Incidente resolvido' : n.Tipo === 'incident_update' ? 'Atualização de incidente' : 'Atualização do sistema';
                    html += '<li style="padding: 0.5rem 0; border-bottom: 1px solid #232326;">' + escapeHtml(tipoLabel) + ': ' + escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(n.Titulo)) || n.Titulo || '') + ' — ' + formatDateTime(n.DataCriacao) + '</li>';
                });
                html += '</ul>';
            }
            html += '</div>';

            body.innerHTML = html;

            body.querySelectorAll('.staff-tab').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var tab = this.getAttribute('data-tab');
                    body.querySelectorAll('.staff-tab').forEach(function(b) { b.style.background = ''; b.style.color = '#9ca3af'; b.style.borderColor = '#232326'; });
                    this.style.background = '#3b82f6'; this.style.color = '#fff'; this.style.borderColor = '#3b82f6';
                    body.querySelectorAll('.staff-tab-pane').forEach(function(p) { p.style.display = 'none'; });
                    var pane = document.getElementById('staffTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
                    if (pane) pane.style.display = 'block';
                });
            });
        } catch (e) {
            body.innerHTML = '<p style="color: #fca5a5;">Erro: ' + escapeHtml(e.message) + '</p>';
        }
    }

    function closeModal() {
        const modal = document.getElementById('staffModal');
        if (modal) modal.classList.remove('show');
    }

    document.addEventListener('DOMContentLoaded', () => {
        load();
        document.getElementById('refreshStaffBtn')?.addEventListener('click', load);
        document.getElementById('closeStaffModal')?.addEventListener('click', closeModal);
        document.getElementById('staffModal')?.addEventListener('click', (e) => { if (e.target.id === 'staffModal') closeModal(); });
    });
})();
