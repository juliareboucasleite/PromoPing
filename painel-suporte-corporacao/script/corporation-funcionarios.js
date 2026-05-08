(function() {
    'use strict';

    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();

    const ROLE_META = {
        support_agent: {
            label: 'Support Agent',
            description: 'Responde tickets e opera o suporte.',
            tone: 'info'
        },
        support_admin: {
            label: 'Support Admin',
            description: 'Administra o painel de suporte.',
            tone: 'warn'
        },
        corporation_admin: {
            label: 'Corporation Admin',
            description: 'Acede ao painel corporativo e aprova fluxos internos.',
            tone: 'success'
        }
    };

    function getRoleLabel(roleCode) {
        return ROLE_META[roleCode] ? ROLE_META[roleCode].label : roleCode;
    }

    function getRoleTone(roleCode) {
        return ROLE_META[roleCode] ? ROLE_META[roleCode].tone : 'neutral';
    }

    function buildRoleBadge(roleCode) {
        return `<span class="role-badge role-badge-${getRoleTone(roleCode)}">${escapeHtml(getRoleLabel(roleCode))}</span>`;
    }

    function normalizeRoleCodes(roleCodes) {
        const list = Array.isArray(roleCodes) ? roleCodes : [];
        return Array.from(new Set(list.map((item) => String(item && item.code ? item.code : item).trim()).filter(Boolean)));
    }

    function deriveLegacyPerfilId(roleCodes) {
        const normalized = normalizeRoleCodes(roleCodes);
        return normalized.includes('corporation_admin') ? 3 : 1;
    }

    function getRoleCheckboxes() {
        return [
            document.getElementById('staffRoleSupportAgent'),
            document.getElementById('staffRoleSupportAdmin'),
            document.getElementById('staffRoleCorporationAdmin')
        ].filter(Boolean);
    }

    function setSelectedRoleCodes(roleCodes) {
        const selected = new Set(normalizeRoleCodes(roleCodes));
        getRoleCheckboxes().forEach((checkbox) => {
            checkbox.checked = selected.has(checkbox.value);
        });
    }

    function getSelectedRoleCodes() {
        return getRoleCheckboxes().filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
    }

    async function fetchAuth(url, options = {}) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, {
            ...options,
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
        return data;
    }

    function escapeHtml(t) {
        if (t === null || t === undefined) return '';
        const d = document.createElement('div');
        d.textContent = String(t);
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

    function alertOk(msg) {
        if (window.showAlert) showAlert(msg);
        else alert(msg);
    }

    function confirmAction(msg, onYes) {
        if (window.showConfirm) showConfirm(msg, 'Confirmar', onYes);
        else if (confirm(msg)) onYes();
    }

    function renderRoles(roleCodes) {
        const normalized = normalizeRoleCodes(roleCodes);
        if (!normalized.length) return '<span style="color:#9ca3af;">Sem roles</span>';
        return normalized.map(buildRoleBadge).join('');
    }

    async function load() {
        const el = document.getElementById('staffList');
        if (!el) return;
        try {
            const includeInactive = document.getElementById('includeInactiveCheck')?.checked ? '1' : '0';
            const includeCorp = document.getElementById('includeCorpCheck')?.checked ? '1' : '0';
            const data = await fetchAuth(`/api/corporation/staff?includeInactive=${includeInactive}&includeCorp=${includeCorp}`);
            const staff = data.staff || [];
            if (!staff.length) {
                el.innerHTML = '<div class="loading-state">Nenhum funcionario encontrado.</div>';
                return;
            }

            el.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ReferenciaID</th>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Telefone</th>
                            <th>Roles</th>
                            <th>Estado</th>
                            <th>Ultimo login</th>
                            <th>Acoes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${staff.map((s) => {
                            const ativo = s.Ativo === 1 || s.Ativo === null;
                            const roleCodes = normalizeRoleCodes(s.accessRoles || []);
                            const estadoPill = ativo
                                ? '<span style="color:#4ade80; font-size: 0.8rem;">● Ativo</span>'
                                : '<span style="color:#fca5a5; font-size: 0.8rem;">● Suspenso</span>';
                            return `
                                <tr ${!ativo ? 'style="opacity: 0.6;"' : ''}>
                                    <td><code style="font-size: 0.85rem;">${escapeHtml(s.ReferenciaID || '-')}</code></td>
                                    <td>${escapeHtml(s.Nome)}</td>
                                    <td>${escapeHtml(s.Email)}</td>
                                    <td>${escapeHtml(s.Telefone || '-')}</td>
                                    <td><div class="role-badge-list">${renderRoles(roleCodes)}</div></td>
                                    <td>${estadoPill}</td>
                                    <td style="font-size: 0.85rem; color: #9ca3af;">${s.UltimoLogin ? formatDateTime(s.UltimoLogin) : '—'}</td>
                                    <td style="white-space: nowrap;">
                                        <button type="button" class="refresh-button" data-act="view" data-ref="${escapeHtml(s.ReferenciaID)}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Ver</button>
                                        <button type="button" class="refresh-button" data-act="edit" data-ref="${escapeHtml(s.ReferenciaID)}" data-nome="${escapeHtml(s.Nome)}" data-tel="${escapeHtml(s.Telefone || '')}" data-roles="${escapeHtml(roleCodes.join(','))}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Editar</button>
                                        <button type="button" class="refresh-button" data-act="reset" data-ref="${escapeHtml(s.ReferenciaID)}" data-nome="${escapeHtml(s.Nome)}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Reset password</button>
                                        ${ativo
                                            ? `<button type="button" class="modal-delete-button" data-act="suspend" data-ref="${escapeHtml(s.ReferenciaID)}" data-nome="${escapeHtml(s.Nome)}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Suspender</button>`
                                            : `<button type="button" class="refresh-button" data-act="reactivate" data-ref="${escapeHtml(s.ReferenciaID)}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: #4ade80; color: #0f0f10;">Reativar</button>`
                                        }
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>`;

            el.querySelectorAll('button[data-act]').forEach((btn) => {
                btn.addEventListener('click', () => handleAction(btn));
            });
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    function handleAction(btn) {
        const act = btn.dataset.act;
        const ref = btn.dataset.ref;
        const nome = btn.dataset.nome || '';
        if (act === 'view') return openDetail(ref);
        if (act === 'edit') return openEditModal(ref, nome, btn.dataset.tel || '', (btn.dataset.roles || '').split(',').filter(Boolean));
        if (act === 'reset') return resetPassword(ref, nome);
        if (act === 'suspend') return suspendStaff(ref, nome);
        if (act === 'reactivate') return reactivateStaff(ref);
    }

    async function suspendStaff(ref, nome) {
        confirmAction(`Suspender ${nome}? A conta deixa de poder entrar.`, async () => {
            try {
                await fetchAuth(`/api/corporation/staff/${encodeURIComponent(ref)}/suspend`, { method: 'POST', body: JSON.stringify({}) });
                alertOk('Conta suspensa.');
                load();
            } catch (e) { alertOk('Erro: ' + e.message); }
        });
    }

    async function reactivateStaff(ref) {
        try {
            await fetchAuth(`/api/corporation/staff/${encodeURIComponent(ref)}/reactivate`, { method: 'POST', body: JSON.stringify({}) });
            alertOk('Conta reativada.');
            load();
        } catch (e) { alertOk('Erro: ' + e.message); }
    }

    async function resetPassword(ref, nome) {
        confirmAction(`Gerar nova password para ${nome}? A atual deixa de funcionar.`, async () => {
            try {
                const data = await fetchAuth(`/api/corporation/staff/${encodeURIComponent(ref)}/reset-password`, { method: 'POST', body: JSON.stringify({}) });
                showTempPassword(data.tempPassword, nome);
            } catch (e) { alertOk('Erro: ' + e.message); }
        });
    }

    function showTempPassword(pwd, targetName) {
        document.getElementById('tempPasswordValue').value = pwd;
        document.getElementById('tempPasswordTarget').textContent = `Para: ${targetName}`;
        document.getElementById('tempPasswordModal').classList.add('show');
    }

    function openCreateModal() {
        const form = document.getElementById('staffForm');
        form.reset();
        document.getElementById('staffFormRefId').value = '';
        document.getElementById('staffFormTitle').textContent = 'Novo funcionario';
        document.getElementById('staffFormSubmit').textContent = 'Criar';
        document.getElementById('staffFormEmailGroup').style.display = '';
        document.getElementById('staffFormEmail').required = true;
        setSelectedRoleCodes(['support_agent', 'support_admin']);
        document.getElementById('staffFormModal').classList.add('show');
    }

    function openEditModal(ref, nome, telefone, roleCodes) {
        document.getElementById('staffFormRefId').value = ref;
        document.getElementById('staffFormTitle').textContent = 'Editar funcionario';
        document.getElementById('staffFormSubmit').textContent = 'Guardar';
        document.getElementById('staffFormNome').value = nome || '';
        document.getElementById('staffFormTelefone').value = telefone || '';
        document.getElementById('staffFormEmailGroup').style.display = 'none';
        document.getElementById('staffFormEmail').required = false;
        setSelectedRoleCodes(roleCodes);
        document.getElementById('staffFormModal').classList.add('show');
    }

    function closeStaffFormModal() {
        document.getElementById('staffFormModal').classList.remove('show');
    }

    async function submitStaffForm(e) {
        e.preventDefault();
        const ref = document.getElementById('staffFormRefId').value;
        const nome = document.getElementById('staffFormNome').value.trim();
        const email = document.getElementById('staffFormEmail').value.trim();
        const telefone = document.getElementById('staffFormTelefone').value.trim();
        const accessRoleCodes = getSelectedRoleCodes();

        if (!accessRoleCodes.length) {
            alertOk('Seleciona pelo menos uma role interna.');
            return;
        }

        const payload = {
            nome,
            telefone,
            accessRoleCodes,
            perfilId: deriveLegacyPerfilId(accessRoleCodes)
        };

        try {
            if (ref) {
                await fetchAuth(`/api/corporation/staff/${encodeURIComponent(ref)}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                alertOk('Funcionario atualizado.');
            } else {
                const data = await fetchAuth('/api/corporation/staff', {
                    method: 'POST',
                    body: JSON.stringify({ ...payload, email })
                });
                closeStaffFormModal();
                showTempPassword(data.tempPassword, nome);
                load();
                return;
            }
            closeStaffFormModal();
            load();
        } catch (err) {
            alertOk('Erro: ' + err.message);
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
            const roleCodes = normalizeRoleCodes(s.accessRoles || []);

            title.textContent = s.Nome || 'Funcionario';

            const tabStyle = 'padding: 0.5rem 0.75rem; margin-right: 0.25rem; border: 1px solid #232326; background: #18181b; color: #9ca3af; cursor: pointer; font-size: 0.85rem; border-radius: 4px;';
            const tabActive = 'background: #3b82f6; color: #fff; border-color: #3b82f6;';

            let html = '<div class="staff-modal-tabs" style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 1rem; border-bottom: 1px solid #232326; padding-bottom: 0.75rem;">';
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
            html += '<p><strong>Perfil legado:</strong> ' + escapeHtml(s.PerfilNome || (s.PerfilId === 3 ? 'Corporacao' : 'Suporte')) + '</p>';
            html += '<p><strong>Roles internas:</strong> <span class="role-badge-list">' + renderRoles(roleCodes) + '</span></p>';
            html += '<p><strong>Data de registo:</strong> ' + formatDate(s.DataRegisto) + '</p>';
            html += '</div></div>';

            html += '<div id="staffTabEventos" class="staff-tab-pane" style="display: none;">';
            if (!events.length) {
                html += '<p style="color: #6b7280; font-size: 0.9rem;">Nenhum evento no calendario.</p>';
            } else {
                html += '<ul style="list-style: none; padding: 0; margin: 0; font-size: 0.9rem;">';
                events.forEach(function(ev) {
                    html += '<li style="padding: 0.5rem 0; border-bottom: 1px solid #232326;">' + escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(ev.Titulo)) || ev.Titulo || 'Sem titulo') + ' <span style="color: #9ca3af;">(' + (ev.Tipo || '-') + ', ' + (ev.Status || '-') + ')</span> - ' + formatDateTime(ev.StartDate) + '</li>';
                });
                html += '</ul>';
            }
            html += '</div>';

            html += '<div id="staffTabProjetos" class="staff-tab-pane" style="display: none;">';
            if (!bugs.length) {
                html += '<p style="color: #6b7280; font-size: 0.9rem;">Nenhum bug ou projeto associado.</p>';
            } else {
                html += '<ul style="list-style: none; padding: 0; margin: 0; font-size: 0.9rem;">';
                bugs.forEach(function(b) {
                    html += '<li style="padding: 0.5rem 0; border-bottom: 1px solid #232326;">#' + b.Id + ' ' + escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(b.Titulo)) || b.Titulo || 'Sem titulo') + ' <span style="color: #9ca3af;">(' + (b.Tipo || '-') + ', ' + (b.Status || '-') + ')</span> - ' + formatDate(b.DataCriacao) + '</li>';
                });
                html += '</ul>';
            }
            html += '</div>';

            html += '<div id="staffTabSuporte" class="staff-tab-pane" style="display: none;">';
            html += '<p style="font-size: 0.9rem;">Participou em <strong>' + supportCount + '</strong> conversa(s) de suporte.</p>';
            html += '</div>';

            html += '<div id="staffTabIncidentes" class="staff-tab-pane" style="display: none;">';
            if (!notifs.length) {
                html += '<p style="color: #6b7280; font-size: 0.9rem;">Nenhum incidente ou atualizacao registado por este funcionario.</p>';
            } else {
                html += '<ul style="list-style: none; padding: 0; margin: 0; font-size: 0.9rem;">';
                notifs.forEach(function(n) {
                    const tipoLabel = n.Tipo === 'incident_resolved' ? 'Incidente resolvido' : n.Tipo === 'incident_update' ? 'Atualizacao de incidente' : 'Atualizacao do sistema';
                    html += '<li style="padding: 0.5rem 0; border-bottom: 1px solid #232326;">' + escapeHtml(tipoLabel) + ': ' + escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(n.Titulo)) || n.Titulo || '') + ' - ' + formatDateTime(n.DataCriacao) + '</li>';
                });
                html += '</ul>';
            }
            html += '</div>';

            body.innerHTML = html;

            body.querySelectorAll('.staff-tab').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const tab = this.getAttribute('data-tab');
                    body.querySelectorAll('.staff-tab').forEach(function(b) { b.style.background = ''; b.style.color = '#9ca3af'; b.style.borderColor = '#232326'; });
                    this.style.background = '#3b82f6';
                    this.style.color = '#fff';
                    this.style.borderColor = '#3b82f6';
                    body.querySelectorAll('.staff-tab-pane').forEach(function(p) { p.style.display = 'none'; });
                    const pane = document.getElementById('staffTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
                    if (pane) pane.style.display = 'block';
                });
            });
        } catch (e) {
            body.innerHTML = '<p style="color: #fca5a5;">Erro: ' + escapeHtml(e.message) + '</p>';
        }
    }

    function closeModal() {
        document.getElementById('staffModal')?.classList.remove('show');
    }

    function closeTempPasswordModal() {
        document.getElementById('tempPasswordModal').classList.remove('show');
    }

    document.addEventListener('DOMContentLoaded', () => {
        load();
        document.getElementById('refreshStaffBtn')?.addEventListener('click', load);
        document.getElementById('newStaffBtn')?.addEventListener('click', openCreateModal);
        document.getElementById('includeInactiveCheck')?.addEventListener('change', load);
        document.getElementById('includeCorpCheck')?.addEventListener('change', load);

        document.getElementById('closeStaffModal')?.addEventListener('click', closeModal);
        document.getElementById('staffModal')?.addEventListener('click', (e) => { if (e.target.id === 'staffModal') closeModal(); });

        document.getElementById('staffForm')?.addEventListener('submit', submitStaffForm);
        document.getElementById('staffFormCancel')?.addEventListener('click', closeStaffFormModal);
        document.getElementById('closeStaffFormModal')?.addEventListener('click', closeStaffFormModal);
        document.getElementById('staffFormModal')?.addEventListener('click', (e) => { if (e.target.id === 'staffFormModal') closeStaffFormModal(); });

        document.getElementById('closeTempPasswordModal')?.addEventListener('click', closeTempPasswordModal);
        document.getElementById('closeTempPasswordBtn')?.addEventListener('click', closeTempPasswordModal);
        document.getElementById('copyTempPasswordBtn')?.addEventListener('click', () => {
            const input = document.getElementById('tempPasswordValue');
            input.select();
            try {
                navigator.clipboard.writeText(input.value);
                alertOk('Password copiada.');
            } catch (_) {
                document.execCommand('copy');
            }
        });
    });
})();
