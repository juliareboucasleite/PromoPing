/**
 * Calendário corporativo: eventos do suporte (só leitura) + atividades criadas pela corporação para o suporte.
 */
(function() {
    'use strict';

    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();
    let calendar = null;
    let staffList = [];
    let currentActivityId = null;

    function fetchAuth(url, options = {}) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        return fetch(safeUrl, {
            ...options,
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...options.headers }
        }).then(res => {
            if (!res.ok) throw new Error(res.statusText || 'Erro');
            return res.json();
        });
    }

    function escapeHtml(t) {
        if (!t) return '';
        const d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }

    function getEventColor(type) {
        const colors = { scraper: '#3b82f6', bug: '#ef4444', maintenance: '#f59e0b', deploy: '#10b981', milestone: '#8b5cf6' };
        return colors[type] || '#6b7280';
    }

    function getStatusColor(status) {
        const colors = { 'scheduled': '#3b82f6', 'in-progress': '#f59e0b', 'completed': '#10b981', 'cancelled': '#6b7280' };
        return colors[status] || '#6b7280';
    }

    function getTypeLabel(type) {
        const labels = { maintenance: 'Manutenção', scraper: 'Scraper', bug: 'Bug', deploy: 'Deploy', milestone: 'Marco/Milestone' };
        return labels[type] || type || '—';
    }

    function getStatusLabel(status) {
        const labels = { scheduled: 'Agendado', 'in-progress': 'Em progresso', completed: 'Concluído', cancelled: 'Cancelado' };
        return labels[status] || status || '—';
    }

    function formatDateTime(s) {
        if (!s) return '—';
        return new Date(s).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function getEstadoLabel(estado) {
        const labels = { pendente: 'Pendente', em_curso: 'Em curso', concluida: 'Concluída', cancelada: 'Cancelada' };
        return labels[estado] || estado || '—';
    }

    function getEstadoColor(estado) {
        const colors = { pendente: '#f59e0b', em_curso: '#3b82f6', concluida: '#10b981', cancelada: '#6b7280' };
        return colors[estado] || '#9ca3af';
    }

    let currentActivityFilter = 'pendentes';
    let lastDetailActivity = null;

    async function loadActivitiesList(filter) {
        const container = document.getElementById('corporationActivitiesListContainer');
        if (!container) return;
        container.innerHTML = '<div class="loading-state">A carregar...</div>';
        try {
            const data = await fetchAuth(`/api/corporation/calendar/activities/list?filter=${encodeURIComponent(filter || currentActivityFilter)}`);
            const activities = data.activities || [];
            if (activities.length === 0) {
                container.innerHTML = '<div class="empty-state" style="padding: 1.5rem; text-align: center; color: var(--text-secondary);">Nenhuma atividade</div>';
                return;
            }
            container.innerHTML = activities.map(a => {
                const titulo = a.acao || a.tipoAtividade || 'Atividade';
                const dataStr = formatDateTime(a.dataInicio);
                const estadoStr = getEstadoLabel(a.estado);
                const estadoColor = getEstadoColor(a.estado);
                return `<div class="activity-list-item" data-activity-id="${a.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-subtle); cursor: pointer; transition: background 0.15s;">
                    <div>
                        <strong style="color: var(--text-primary);">${escapeHtml(titulo)}</strong>
                        <span style="color: var(--text-secondary); font-size: 0.85rem; margin-left: 0.5rem;">${escapeHtml(dataStr)}</span>
                        <span style="margin-left: 0.5rem; font-size: 0.8rem; color: ${estadoColor};">${escapeHtml(estadoStr)}</span>
                    </div>
                    <span style="color: var(--text-secondary); font-size: 0.85rem;">${escapeHtml(a.assignedToNome || '—')}</span>
                </div>`;
            }).join('');
            container.querySelectorAll('.activity-list-item').forEach(el => {
                el.addEventListener('click', () => openActivityDetailModal(Number(el.dataset.activityId)));
            });
        } catch (e) {
            console.error('[CORPORATION CALENDAR] loadActivitiesList', e);
            container.innerHTML = '<div class="empty-state" style="padding: 1.5rem; text-align: center; color: #ef4444;">Erro ao carregar atividades.</div>';
        }
    }

    async function openActivityDetailModal(activityId) {
        const modal = document.getElementById('activityDetailModal');
        const titleEl = document.getElementById('activityDetailTitle');
        const bodyEl = document.getElementById('activityDetailBody');
        const commentsListEl = document.getElementById('activityCommentsList');
        const commentInput = document.getElementById('activityCommentInput');
        if (!modal || !bodyEl) return;
        titleEl.textContent = 'Detalhe da atividade';
        bodyEl.innerHTML = '<div class="loading-state">A carregar...</div>';
        commentsListEl.innerHTML = '';
        if (commentInput) commentInput.value = '';
        modal.classList.add('show');
        try {
            const data = await fetchAuth(`/api/corporation/calendar/activities/${activityId}`);
            lastDetailActivity = data.activity;
            const act = data.activity;
            const comments = data.comments || [];
            const reports = data.reports || [];
            bodyEl.innerHTML = `
                <div style="display: grid; gap: 0.75rem;">
                    <p><strong>Estado:</strong> <span style="color: ${getEstadoColor(act.estado)}">${escapeHtml(getEstadoLabel(act.estado))}</span></p>
                    <p><strong>Ação:</strong> ${escapeHtml(act.acao || '—')}</p>
                    <p><strong>Tipo:</strong> ${escapeHtml(act.tipoAtividade || '—')}</p>
                    ${act.descricao ? `<p><strong>Descrição:</strong><br><span style="color: #d1d5db; white-space: pre-wrap;">${escapeHtml(act.descricao)}</span></p>` : ''}
                    <p><strong>Início:</strong> ${formatDateTime(act.dataInicio)}</p>
                    <p><strong>Duração:</strong> ${act.duracaoMinutos || 0} min</p>
                    <p><strong>Designado:</strong> ${escapeHtml(act.assignedToNome || '—')}</p>
                    ${reports.length ? `<p><strong>Relatórios do suporte:</strong> ${reports.length} enviado(s)</p>` : ''}
                </div>`;
            commentsListEl.innerHTML = comments.length === 0
                ? '<p style="color: var(--text-secondary); font-size: 0.9rem;">Nenhum comentário.</p>'
                : comments.map(c => {
                    const who = c.IsCorporation ? 'Corporação' : 'Suporte';
                    const when = formatDateTime(c.CreatedAt);
                    return `<div style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle);"><span style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(who)} · ${when}</span><br><span style="white-space: pre-wrap;">${escapeHtml(c.Mensagem)}</span></div>`;
                }).join('');
            document.getElementById('activityDetailEditBtn').dataset.activityId = activityId;
        } catch (e) {
            console.error('[CORPORATION CALENDAR] openActivityDetailModal', e);
            bodyEl.innerHTML = '<p style="color: #ef4444;">Erro ao carregar detalhe.</p>';
        }
    }

    function closeActivityDetailModal() {
        document.getElementById('activityDetailModal')?.classList.remove('show');
        lastDetailActivity = null;
    }

    async function submitActivityComment() {
        const activityId = document.getElementById('activityDetailEditBtn')?.dataset.activityId;
        const commentInput = document.getElementById('activityCommentInput');
        if (!activityId || !commentInput || !String(commentInput.value).trim()) return;
        const mensagem = commentInput.value.trim();
        try {
            await fetchAuth(`/api/corporation/calendar/activities/${activityId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ mensagem })
            });
            commentInput.value = '';
            await openActivityDetailModal(Number(activityId));
        } catch (e) {
            (window.showAlert || alert)(e.message || 'Erro ao enviar comentário.');
        }
    }

    async function loadStaff() {
        try {
            const data = await fetchAuth('/api/corporation/staff');
            staffList = data.staff || [];
            const sel = document.getElementById('activityAssignedTo');
            if (!sel) return;
            sel.innerHTML = '<option value="">— Não designado —</option>' +
                staffList.map(s => `<option value="${escapeHtml(s.ReferenciaID)}">${escapeHtml(s.Nome || s.Email)}</option>`).join('');
        } catch (e) {
            console.error('[CORPORATION CALENDAR] loadStaff', e);
        }
    }

    async function loadEvents(start, end) {
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];
        const [eventsData, activitiesData] = await Promise.all([
            fetchAuth(`/api/corporation/calendar/events?start=${startStr}&end=${endStr}`).catch(() => ({ events: [] })),
            fetchAuth(`/api/corporation/calendar/activities?start=${startStr}&end=${endStr}`).catch(() => ({ activities: [] }))
        ]);
        const events = (eventsData.events || []).map(ev => ({
            id: String(ev.id),
            title: ev.title,
            start: ev.start,
            end: ev.end || null,
            backgroundColor: getEventColor(ev.type),
            borderColor: getStatusColor(ev.status),
            textColor: '#ffffff',
            extendedProps: {
                description: ev.description,
                type: ev.type,
                status: ev.status,
                createdByName: ev.createdByName,
                createdAt: ev.createdAt,
                isActivity: false
            }
        }));
        const activities = (activitiesData.activities || []).map(a => ({
            id: 'act-' + a.id,
            title: a.title || a.acao || 'Atividade',
            start: a.start,
            end: a.end || null,
            backgroundColor: '#6366f1',
            borderColor: '#4f46e5',
            textColor: '#ffffff',
            extendedProps: {
                isActivity: true,
                activityId: a.id,
                acao: a.acao,
                descricao: a.descricao,
                tipoAtividade: a.tipoAtividade,
                estado: a.estado,
                assignedTo: a.assignedTo,
                assignedToNome: a.assignedToNome
            }
        }));
        return events.concat(activities);
    }

    function openEventDetailModal(event) {
        const modal = document.getElementById('eventDetailModal');
        const titleEl = document.getElementById('eventDetailTitle');
        const bodyEl = document.getElementById('eventDetailBody');
        if (!modal || !bodyEl) return;
        const p = event.extendedProps || {};
        titleEl.textContent = event.title || 'Evento';
        bodyEl.innerHTML = `
            <div style="display: grid; gap: 0.75rem;">
                <p><strong>Título:</strong> ${escapeHtml(event.title)}</p>
                ${p.description ? `<p><strong>Descrição:</strong><br><span style="color: #d1d5db; white-space: pre-wrap;">${escapeHtml(p.description)}</span></p>` : ''}
                <p><strong>Tipo:</strong> ${escapeHtml(getTypeLabel(p.type))}</p>
                <p><strong>Status:</strong> <span style="color: ${getStatusColor(p.status)}">${escapeHtml(getStatusLabel(p.status))}</span></p>
                <p><strong>Início:</strong> ${formatDateTime(event.start)}</p>
                <p><strong>Fim:</strong> ${event.end ? formatDateTime(event.end) : '—'}</p>
                <p><strong>Criado por (suporte):</strong> ${escapeHtml(p.createdByName || '—')}</p>
            </div>`;
        modal.classList.add('show');
    }

    function closeEventDetailModal() {
        document.getElementById('eventDetailModal')?.classList.remove('show');
    }

    function openActivityModal(dateStr, activityData) {
        currentActivityId = activityData ? activityData.activityId : null;
        const modal = document.getElementById('activityModal');
        const titleEl = document.getElementById('activityModalTitle');
        const submitBtn = document.getElementById('activitySubmitBtn');
        const deleteBtn = document.getElementById('deleteActivityBtn');
        const form = document.getElementById('activityForm');
        if (!modal || !form) return;

        titleEl.textContent = currentActivityId ? 'Editar Atividade' : 'Nova Atividade';
        submitBtn.textContent = currentActivityId ? 'Guardar' : 'Criar Atividade';
        deleteBtn.style.display = currentActivityId ? 'inline-block' : 'none';

        if (activityData) {
            const d = new Date(activityData.start);
            const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
            document.getElementById('activityDataInicio').value = local.toISOString().slice(0, 16);
            document.getElementById('activityDuracao').value = activityData.duracaoMinutos || 60;
            document.getElementById('activityAssignedTo').value = activityData.assignedTo || '';
            document.getElementById('activityTipo').value = activityData.tipoAtividade || '';
            document.getElementById('activityAcao').value = activityData.acao || '';
            document.getElementById('activityDescricao').value = activityData.descricao || '';
        } else {
            form.reset();
            document.getElementById('activityDuracao').value = 60;
            if (dateStr) {
                const d = new Date(dateStr);
                const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
                document.getElementById('activityDataInicio').value = local.toISOString().slice(0, 16);
            }
        }
        modal.classList.add('show');
    }

    function closeActivityModal() {
        currentActivityId = null;
        document.getElementById('activityModal')?.classList.remove('show');
    }

    async function saveActivity(payload) {
        const url = currentActivityId
            ? `${API_BASE}/api/corporation/calendar/activities/${currentActivityId}`
            : `${API_BASE}/api/corporation/calendar/activities`;
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(currentActivityId ? `/api/corporation/calendar/activities/${currentActivityId}` : '/api/corporation/calendar/activities') : url;
        const method = currentActivityId ? 'PUT' : 'POST';
        const res = await fetch(safeUrl, {
            method,
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || res.statusText);
        }
        return res.json();
    }

    async function deleteActivity() {
        if (!currentActivityId) return;
        if (!window.confirm && !window.showConfirm) {
            if (!confirm('Remover esta atividade?')) return;
        } else {
            window.showConfirm('Remover esta atividade?', 'Remover', doDelete);
            return;
        }
        await doDelete();
    }

    async function doDelete() {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(`/api/corporation/calendar/activities/${currentActivityId}`) : `${API_BASE}/api/corporation/calendar/activities/${currentActivityId}`;
        const res = await fetch(safeUrl, { method: 'DELETE', headers: { 'Authorization': `Bearer ${TOKEN}` } });
        if (!res.ok) throw new Error('Erro ao remover');
        closeActivityModal();
        if (calendar) calendar.refetchEvents();
        loadActivitiesList(currentActivityFilter);
        if (window.showAlert) showAlert('Atividade removida.');
        else alert('Atividade removida.');
    }

    function initCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;
        if (typeof FullCalendar === 'undefined') {
            calendarEl.innerHTML = '<div style="padding: 2rem; text-align: center; color: #fca5a5;">FullCalendar não carregado.</div>';
            return;
        }
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'pt-br',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
            height: 'auto',
            events: async (info, successCallback, failureCallback) => {
                try {
                    const list = await loadEvents(info.start, info.end);
                    successCallback(list);
                } catch (e) {
                    failureCallback(e);
                }
            },
            eventClick: (info) => {
                info.jsEvent.preventDefault();
                const p = info.event.extendedProps || {};
                if (p.isActivity) {
                    openActivityDetailModal(p.activityId);
                } else {
                    openEventDetailModal(info.event);
                }
            },
            dateClick: (info) => {
                openActivityModal(info.dateStr);
            },
            eventDisplay: 'block',
            editable: false
        });
        calendar.render();
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadStaff();
        initCalendar();
        loadActivitiesList('pendentes');

        document.getElementById('refreshCalendarBtn')?.addEventListener('click', () => { calendar?.refetchEvents(); loadActivitiesList(currentActivityFilter); });
        document.getElementById('newActivityBtn')?.addEventListener('click', () => openActivityModal());

        document.querySelectorAll('.activities-tabs .tab-button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.activities-tabs .tab-button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentActivityFilter = btn.dataset.activityFilter || 'pendentes';
                loadActivitiesList(currentActivityFilter);
            });
        });

        document.getElementById('closeEventDetailModal')?.addEventListener('click', closeEventDetailModal);
        document.getElementById('closeEventDetailBtn')?.addEventListener('click', closeEventDetailModal);
        document.getElementById('eventDetailModal')?.addEventListener('click', (e) => { if (e.target.id === 'eventDetailModal') closeEventDetailModal(); });

        document.getElementById('closeActivityDetailModal')?.addEventListener('click', closeActivityDetailModal);
        document.getElementById('closeActivityDetailBtn')?.addEventListener('click', closeActivityDetailModal);
        document.getElementById('activityDetailModal')?.addEventListener('click', (e) => { if (e.target.id === 'activityDetailModal') closeActivityDetailModal(); });
        document.getElementById('activityDetailEditBtn')?.addEventListener('click', () => {
            if (!lastDetailActivity) return;
            const act = lastDetailActivity;
            const start = act.dataInicio ? new Date(act.dataInicio) : null;
            closeActivityDetailModal();
            openActivityModal(null, {
                activityId: act.id,
                start: start ? start.toISOString() : null,
                end: act.dataFim || null,
                duracaoMinutos: act.duracaoMinutos || 60,
                assignedTo: act.assignedTo || '',
                tipoAtividade: act.tipoAtividade || '',
                acao: act.acao || '',
                descricao: act.descricao || ''
            });
        });
        document.getElementById('activityCommentSubmit')?.addEventListener('click', submitActivityComment);

        document.getElementById('closeActivityModal')?.addEventListener('click', closeActivityModal);
        document.getElementById('cancelActivityBtn')?.addEventListener('click', closeActivityModal);
        document.getElementById('activityModal')?.addEventListener('click', (e) => { if (e.target.id === 'activityModal') closeActivityModal(); });

        document.getElementById('activityForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dataInicio = document.getElementById('activityDataInicio').value;
            if (!dataInicio) { (window.showAlert || alert)('Indique a data e hora de início.'); return; }
            const payload = {
                dataInicio: dataInicio.replace('T', ' ').slice(0, 19),
                duracaoMinutos: parseInt(document.getElementById('activityDuracao').value, 10) || 60,
                assignedTo: document.getElementById('activityAssignedTo').value || null,
                tipoAtividade: document.getElementById('activityTipo').value || null,
                acao: document.getElementById('activityAcao').value || null,
                descricao: document.getElementById('activityDescricao').value || null
            };
            try {
                await saveActivity(payload);
                closeActivityModal();
                if (calendar) calendar.refetchEvents();
                loadActivitiesList(currentActivityFilter);
                (window.showAlert || alert)('Atividade guardada.');
            } catch (err) {
                (window.showAlert || alert)(err.message || 'Erro ao guardar.');
            }
        });

        document.getElementById('deleteActivityBtn')?.addEventListener('click', () => deleteActivity());
    });
})();
