/**
 * Calendário corporativo: igual ao do suporte, só leitura. Clique no evento para ver o que o suporte está a fazer.
 */
(function() {
    'use strict';

    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();
    let calendar = null;

    function fetchAuth(url) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        return fetch(safeUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } })
            .then(res => {
                if (!res.ok) throw new Error('Erro ao carregar eventos');
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

    async function loadEvents(start, end) {
        try {
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];
            const data = await fetchAuth(`/api/corporation/calendar/events?start=${startStr}&end=${endStr}`);
            const events = data.events || [];
            return events.map(ev => ({
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
                    createdAt: ev.createdAt
                }
            }));
        } catch (e) {
            console.error('[CORPORATION CALENDAR]', e);
            return [];
        }
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
        const modal = document.getElementById('eventDetailModal');
        if (modal) modal.classList.remove('show');
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
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            height: 'auto',
            events: async (info, successCallback, failureCallback) => {
                try {
                    const events = await loadEvents(info.start, info.end);
                    successCallback(events);
                } catch (e) {
                    failureCallback(e);
                }
            },
            eventClick: (info) => {
                info.jsEvent.preventDefault();
                openEventDetailModal(info.event);
            },
            dateClick: () => {},
            eventDisplay: 'block',
            editable: false
        });
        calendar.render();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initCalendar();
        document.getElementById('refreshCalendarBtn')?.addEventListener('click', () => calendar?.refetchEvents());
        document.getElementById('closeEventDetailModal')?.addEventListener('click', closeEventDetailModal);
        document.getElementById('closeEventDetailBtn')?.addEventListener('click', closeEventDetailModal);
        document.getElementById('eventDetailModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'eventDetailModal') closeEventDetailModal();
        });
    });
})();
