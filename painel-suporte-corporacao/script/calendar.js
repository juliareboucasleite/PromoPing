(function() {
    'use strict';

    // Configuração
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = localStorage.getItem('PROMOPING_TOKEN');

    // Estado
    let calendar = null;
    let currentEventId = null;
    let isEditMode = false;
    let googleConnected = false;

    /**
     * Verificar autenticação
     */
    function checkAuth() {
        if (!TOKEN) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    /**
     * Requisição autenticada com tratamento de erros
     */
    async function fetchAuth(url, options = {}) {
        try {
            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
            const response = await fetch(safeUrl, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error(`[CALENDAR] Resposta não-JSON de ${url}:`, text.substring(0, 200));
                throw new Error(`Resposta inválida do servidor (${response.status})`);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error(`[CALENDAR] Erro ao fazer requisição para ${url}:`, error);
            throw new Error(`Erro de conexão: ${error.message}`);
        }
    }

    /**
     * Mapear tipo de evento para cor
     */
    function getEventColor(type) {
        const colors = {
            'scraper': '#3b82f6',      
            'bug': '#ef4444',          
            'maintenance': '#f59e0b', 
            'deploy': '#10b981',       
            'milestone': '#8b5cf6'      
        };
        return colors[type] || '#6b7280';
    }

    /**
     * Mapear status para cor de borda
     */
    function getStatusColor(status) {
        const colors = {
            'scheduled': '#3b82f6',     
            'in-progress': '#f59e0b',  
            'completed': '#10b981',     
            'cancelled': '#6b7280'      
        };
        return colors[status] || '#6b7280';
    }

    /**
     * Carregar eventos do servidor (eventos + atividades corporação)
     */
    async function loadEvents(start, end) {
        try {
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            const [eventsRes, activitiesRes] = await Promise.all([
                fetchAuth(`/api/admin/calendar/events?start=${startStr}&end=${endStr}`).then(r => r.json()).catch(() => ({ status: 'ok', events: [] })),
                fetchAuth(`/api/admin/calendar/activities?start=${startStr}&end=${endStr}`).then(r => r.json()).catch(() => ({ status: 'ok', activities: [] }))
            ]);

            const events = (eventsRes.status === 'ok' && eventsRes.events) ? eventsRes.events.map(event => ({
                id: event.id.toString(),
                title: event.title,
                start: event.start,
                end: event.end || null,
                backgroundColor: getEventColor(event.type),
                borderColor: getStatusColor(event.status),
                textColor: '#ffffff',
                extendedProps: {
                    description: event.description,
                    type: event.type,
                    status: event.status,
                    createdBy: event.createdBy,
                    createdByName: event.createdByName,
                    createdAt: event.createdAt,
                    isActivity: false
                }
            })) : [];

            const activities = (activitiesRes.status === 'ok' && activitiesRes.activities) ? activitiesRes.activities.map(a => ({
                id: 'act-' + a.id,
                title: a.acao || a.tipoAtividade || 'Atividade',
                start: a.dataInicio,
                end: a.dataFim || null,
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
                    assignedToNome: a.assignedToNome
                }
            })) : [];

            return events.concat(activities);
        } catch (error) {
            console.error('[CALENDAR] Erro ao carregar eventos:', error);
            showAlert(`Erro ao carregar eventos: ${error.message}`);
            return [];
        }
    }

    /**
     * Inicializar calendário
     */
    function initCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) {
            console.error('[CALENDAR] Elemento #calendar não encontrado');
            return;
        }

        // Verificar se FullCalendar está carregado
        if (typeof FullCalendar === 'undefined') {
            console.error('[CALENDAR] FullCalendar não está carregado. Verifique se o script foi incluído.');
            calendarEl.innerHTML = '<div style="padding: 2rem; text-align: center; color: #fca5a5;">Erro: FullCalendar não carregado. Verifique a conexão com a internet.</div>';
            return;
        }

        console.log('[CALENDAR] Inicializando FullCalendar...');

        try {
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
                } catch (error) {
                    console.error('[CALENDAR] Erro ao carregar eventos:', error);
                    failureCallback(error);
                }
            },
            eventClick: (info) => {
                if (info.event.extendedProps && info.event.extendedProps.isActivity) {
                    openActivityDetailModal(info.event.extendedProps.activityId);
                } else {
                    openEventModal(info.event);
                }
            },
            dateClick: (info) => {
                openNewEventModal(info.dateStr);
            },
            eventDisplay: 'block',
            editable: true,
            eventResize: async (info) => {
                await updateEvent(info.event);
            },
            eventDrop: async (info) => {
                await updateEvent(info.event);
            }
            });

            calendar.render();
            console.log('[CALENDAR] Calendário renderizado com sucesso');
        } catch (error) {
            console.error('[CALENDAR] Erro ao inicializar calendário:', error);
            calendarEl.innerHTML = `<div style="padding: 2rem; text-align: center; color: #fca5a5;">Erro ao inicializar calendário: ${error.message}</div>`;
        }
    }

    /**
     * Abrir modal para novo evento
     */
    function openNewEventModal(dateStr = null) {
        isEditMode = false;
        currentEventId = null;
        
        const modal = document.getElementById('eventModal');
        const form = document.getElementById('eventForm');
        const modalTitle = document.getElementById('modalTitle');
        const deleteBtn = document.getElementById('deleteBtn');

        modalTitle.textContent = 'Novo Evento';
        deleteBtn.style.display = 'none';
        form.reset();

        // Preencher data se fornecida
        if (dateStr) {
            const date = new Date(dateStr);
            const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
            document.getElementById('eventStartDate').value = localDate.toISOString().slice(0, 16);
        } else {
            // Data/hora atual
            const now = new Date();
            const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
            document.getElementById('eventStartDate').value = localNow.toISOString().slice(0, 16);
        }

        modal.classList.add('show');
    }

    /**
     * Abrir modal para editar evento
     */
    function openEventModal(event) {
        isEditMode = true;
        currentEventId = event.id;

        const modal = document.getElementById('eventModal');
        const form = document.getElementById('eventForm');
        const modalTitle = document.getElementById('modalTitle');
        const deleteBtn = document.getElementById('deleteBtn');

        modalTitle.textContent = 'Editar Evento';
        deleteBtn.style.display = 'inline-block';

        // Preencher formulário com dados do evento
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDescription').value = event.extendedProps.description || '';

        // Converter data para formato local
        const startDate = new Date(event.start);
        const localStart = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000);
        document.getElementById('eventStartDate').value = localStart.toISOString().slice(0, 16);

        if (event.end) {
            const endDate = new Date(event.end);
            const localEnd = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000);
            document.getElementById('eventEndDate').value = localEnd.toISOString().slice(0, 16);
        } else {
            document.getElementById('eventEndDate').value = '';
        }

        document.getElementById('eventType').value = event.extendedProps.type || 'maintenance';
        document.getElementById('eventStatus').value = event.extendedProps.status || 'scheduled';

        modal.classList.add('show');
    }

    /**
     * Fechar modal
     */
    function closeModal() {
        const modal = document.getElementById('eventModal');
        modal.classList.remove('show');
        isEditMode = false;
        currentEventId = null;
    }

    /** Atividades (corporação): lista por filtro */
    let currentActivityFilter = 'hoje';
    async function loadActivitiesList(filter) {
        const container = document.getElementById('activitiesListContainer');
        if (!container) return;
        try {
            container.innerHTML = '<div class="loading-state">A carregar...</div>';
            const response = await fetchAuth(`/api/admin/calendar/activities?filter=${encodeURIComponent(filter || currentActivityFilter)}`);
            const data = await response.json();
            const list = Array.isArray(data.activities) ? data.activities : [];
            if (list.length === 0) {
                container.innerHTML = '<div class="loading-state">Nenhuma atividade</div>';
                return;
            }
            function fmtDt(d) {
                if (!d) return '—';
                try {
                    return new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                } catch (_) {
                    return '—';
                }
            }
            function safeStr(val, maxLen) {
                const s = String(val != null ? val : '—');
                return maxLen ? s.substring(0, maxLen) : s;
            }
            function estadoColor(estado) {
                if (estado === 'concluida') return '#86efac';
                if (estado === 'em_curso') return '#fcd34d';
                return '#94a3b8';
            }
            const rows = list.map(function(a) {
                return '<tr><td>' + fmtDt(a.dataInicio) + '</td><td>' + escapeHtml(safeStr(a.acao || a.tipoAtividade || '—', 40)) + '</td><td>' + escapeHtml(safeStr(a.assignedToNome)) + '</td><td><span style="color:' + estadoColor(a.estado) + '">' + escapeHtml(a.estado || 'pendente') + '</span></td><td><button type="button" class="refresh-button" data-activity-id="' + String(a.id) + '" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">Ver</button></td></tr>';
            }).join('');
            container.innerHTML = '<table class="data-table"><thead><tr><th>Data</th><th>Ação / Tipo</th><th>Designado</th><th>Estado</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
            container.querySelectorAll('[data-activity-id]').forEach(btn => {
                btn.addEventListener('click', () => openActivityDetailModal(btn.getAttribute('data-activity-id')));
            });
        } catch (err) {
            console.error('[CALENDAR] loadActivitiesList', err);
            if (container) container.innerHTML = '<div class="loading-state" style="color: #fca5a5;">Erro ao carregar</div>';
        }
    }

    /** Modal detalhe atividade: dados, estado, comentários, relatório */
    let currentActivityDetailId = null;
    function escapeHtml(t) {
        if (t == null) return '';
        const d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }
    async function openActivityDetailModal(activityId) {
        currentActivityDetailId = activityId;
        const modal = document.getElementById('activityDetailModal');
        const titleEl = document.getElementById('activityDetailTitle');
        const bodyEl = document.getElementById('activityDetailBody');
        if (!modal || !bodyEl) return;
        try {
            const response = await fetchAuth(`/api/admin/calendar/activities/${activityId}`);
            const data = await response.json();
            if (data.status !== 'ok' || !data.activity) {
                showAlert('Atividade não encontrada.');
                return;
            }
            const a = data.activity;
            const comments = data.comments || [];
            const reports = data.reports || [];
            const dataFim = a.dataFim ? new Date(a.dataFim).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
            const dataInicio = a.dataInicio ? new Date(a.dataInicio).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
            titleEl.textContent = a.acao || 'Detalhe da atividade';
            bodyEl.innerHTML = `
                <div class="form-group">
                    <label class="form-label">Data / Início</label>
                    <p style="margin: 0; color: var(--text-primary);">${dataInicio}</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Duração / Fim</label>
                    <p style="margin: 0; color: var(--text-primary);">${a.duracaoMinutos || 0} min — ${dataFim}</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Designado</label>
                    <p style="margin: 0; color: var(--text-primary);">${escapeHtml(a.assignedToNome || '—')}</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Tipo</label>
                    <p style="margin: 0; color: var(--text-primary);">${escapeHtml(a.tipoAtividade || '—')}</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Ação</label>
                    <p style="margin: 0; color: var(--text-primary);">${escapeHtml(a.acao || '—')}</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Descrição</label>
                    <p style="margin: 0; color: var(--text-secondary); white-space: pre-wrap;">${escapeHtml(a.descricao || '—')}</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Estado</label>
                    <select id="activityEstadoSelect" class="form-input" style="max-width: 200px;">
                        <option value="pendente" ${a.estado === 'pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="em_curso" ${a.estado === 'em_curso' ? 'selected' : ''}>Em curso</option>
                        <option value="concluida" ${a.estado === 'concluida' ? 'selected' : ''}>Concluída</option>
                        <option value="cancelada" ${a.estado === 'cancelada' ? 'selected' : ''}>Cancelada</option>
                    </select>
                    <button type="button" id="saveActivityEstadoBtn" class="refresh-button" style="margin-left: 0.5rem; padding: 0.4rem 0.75rem;">Guardar estado</button>
                </div>
                <hr style="border-color: var(--border-subtle); margin: 1rem 0;">
                <div class="form-group">
                    <label class="form-label">Comentários</label>
                    <div id="activityCommentsList" style="max-height: 160px; overflow-y: auto; margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-elevated); border-radius: 6px;">
                        ${comments.length === 0 ? '<p style="color: var(--text-muted); margin: 0; font-size: 0.875rem;">Nenhum comentário.</p>' : (function() {
                            var arr = [];
                            comments.forEach(function(c) {
                                var msg = c.Mensagem || c.mensagem || '';
                                var who = (c.IsCorporation || c.isCorporation) ? 'Corporação' : 'Suporte';
                                var at = (c.CreatedAt || c.createdAt) ? new Date(c.CreatedAt || c.createdAt).toLocaleString('pt-PT') : '';
                                arr.push('<p style="margin: 0 0 0.5rem; font-size: 0.875rem;"><strong>' + who + '</strong> ' + escapeHtml(msg) + ' <span style="color: var(--text-muted);">' + at + '</span></p>');
                            });
                            return arr.join('');
                        })()}
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" id="activityCommentInput" class="form-input" placeholder="Comentário..." style="flex: 1;">
                        <button type="button" id="activityCommentBtn" class="modal-submit-button" style="padding: 0.5rem 1rem;">Enviar</button>
                    </div>
                </div>
                <hr style="border-color: var(--border-subtle); margin: 1rem 0;">
                <div class="form-group">
                    <label class="form-label">Submeter relatório</label>
                    <textarea id="activityReportText" class="form-input" rows="2" placeholder="O que foi feito, como foi feito..."></textarea>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0.25rem 0;">Anexo: PDF, DOC, DOCX ou TXT</p>
                    <input type="file" id="activityReportFile" accept=".pdf,.doc,.docx,.txt" style="margin: 0.25rem 0;">
                    <button type="button" id="activityReportBtn" class="modal-submit-button" style="margin-top: 0.5rem;">Submeter relatório</button>
                </div>
                ${reports.length > 0 ? (function() {
                    var parts = [];
                    reports.forEach(function(r) {
                        var txt = r.TextoRelatorio || r.textoRelatorio || '';
                        var url = r.AnexoUrl || r.anexoUrl;
                        var base = window.APIUtils ? window.APIUtils.getSafeApiBase() : (typeof API_BASE !== 'undefined' ? API_BASE : '');
                        var href = url ? (base + url) : '';
                        var linkHtml = href ? ' <a href="' + href + '" target="_blank" rel="noopener">Anexo</a>' : '';
                        var dateStr = (r.CreatedAt || r.createdAt) ? new Date(r.CreatedAt || r.createdAt).toLocaleString('pt-PT') : '';
                        parts.push('<p style="margin: 0 0 0.5rem; font-size: 0.875rem; color: var(--text-secondary);">' + escapeHtml(txt.substring(0, 150)) + linkHtml + ' — ' + dateStr + '</p>');
                    });
                    return '<div class="form-group"><label class="form-label">Relatórios anteriores</label><div style="max-height: 120px; overflow-y: auto;">' + parts.join('') + '</div></div>';
                })() : ''}
            `;
            document.getElementById('saveActivityEstadoBtn')?.addEventListener('click', async () => {
                const sel = document.getElementById('activityEstadoSelect');
                if (!sel) return;
                try {
                    await fetchAuth(`/api/admin/calendar/activities/${activityId}`, { method: 'PATCH', body: JSON.stringify({ estado: sel.value }) });
                    showAlert('Estado atualizado.');
                    loadActivitiesList(currentActivityFilter);
                    if (calendar) calendar.refetchEvents();
                    openActivityDetailModal(activityId);
                } catch (e) {
                    showAlert(e.message || 'Erro ao atualizar estado.');
                }
            });
            document.getElementById('activityCommentBtn')?.addEventListener('click', async () => {
                const input = document.getElementById('activityCommentInput');
                if (!input || !input.value.trim()) return;
                try {
                    await fetchAuth(`/api/admin/calendar/activities/${activityId}/comments`, { method: 'POST', body: JSON.stringify({ mensagem: input.value.trim() }) });
                    input.value = '';
                    showAlert('Comentário adicionado.');
                    openActivityDetailModal(activityId);
                } catch (e) {
                    showAlert(e.message || 'Erro ao enviar comentário.');
                }
            });
            document.getElementById('activityReportBtn')?.addEventListener('click', async () => {
                const textEl = document.getElementById('activityReportText');
                const fileEl = document.getElementById('activityReportFile');
                const texto = textEl && textEl.value ? textEl.value.trim() : '';
                if (!texto && (!fileEl || !fileEl.files.length)) {
                    showAlert('Indique o texto do relatório e/ou anexe um ficheiro.');
                    return;
                }
                let anexoBase64 = '';
                let anexoFileName = '';
                if (fileEl && fileEl.files.length > 0) {
                    const file = fileEl.files[0];
                    const ext = (file.name || '').toLowerCase();
                    if (!['.pdf','.doc','.docx','.txt'].some(e => ext.endsWith(e))) {
                        showAlert('Anexo: use PDF, DOC, DOCX ou TXT.');
                        return;
                    }
                    anexoFileName = file.name;
                    anexoBase64 = await new Promise((res, rej) => {
                        const r = new FileReader();
                        r.onload = () => res(r.result);
                        r.onerror = rej;
                        r.readAsDataURL(file);
                    });
                }
                try {
                    await fetchAuth(`/api/admin/calendar/activities/${activityId}/report`, {
                        method: 'POST',
                        body: JSON.stringify({ texto: texto || null, anexoBase64: anexoBase64 || undefined, anexoFileName: anexoFileName || undefined })
                    });
                    if (textEl) textEl.value = '';
                    if (fileEl) fileEl.value = '';
                    showAlert('Relatório submetido.');
                    openActivityDetailModal(activityId);
                } catch (e) {
                    showAlert(e.message || 'Erro ao submeter relatório.');
                }
            });
            modal.classList.add('show');
        } catch (err) {
            console.error('[CALENDAR] openActivityDetailModal', err);
            showAlert(err.message || 'Erro ao carregar atividade.');
        }
    }
    function closeActivityDetailModal() {
        currentActivityDetailId = null;
        document.getElementById('activityDetailModal')?.classList.remove('show');
    }

    /**
     * Salvar evento (criar ou atualizar)
     */
    async function saveEvent(eventData) {
        try {
            const url = isEditMode 
                ? `/api/admin/calendar/events/${currentEventId}`
                : '/api/admin/calendar/events';
            
            const method = isEditMode ? 'PUT' : 'POST';

            const response = await fetchAuth(url, {
                method: method,
                body: JSON.stringify(eventData)
            });

            const data = await response.json();

            if (data.status === 'ok') {
                closeModal();
                calendar.refetchEvents();
                return true;
            } else {
                throw new Error(data.error || 'Erro ao salvar evento');
            }
        } catch (error) {
            console.error('[CALENDAR] Erro ao salvar evento:', error);
            showAlert(`Erro ao salvar evento: ${error.message}`);
            return false;
        }
    }

    /**
     * Atualizar evento após drag/resize
     */
    async function updateEvent(event) {
        try {
            const startDate = new Date(event.start);
            const endDate = event.end ? new Date(event.end) : null;

            const eventData = {
                start_date: startDate.toISOString().slice(0, 19).replace('T', ' '),
                end_date: endDate ? endDate.toISOString().slice(0, 19).replace('T', ' ') : null
            };

            await fetchAuth(`/api/admin/calendar/events/${event.id}`, {
                method: 'PUT',
                body: JSON.stringify(eventData)
            });

            calendar.refetchEvents();
        } catch (error) {
            console.error('[CALENDAR] Erro ao atualizar evento:', error);
            showAlert(`Erro ao atualizar evento: ${error.message}`);
            calendar.refetchEvents(); // Reverter mudanças
        }
    }

    /**
     * Verificar status da conexão Google
     */
    async function checkGoogleConnectionStatus() {
        try {
            const response = await fetchAuth('/api/admin/calendar/google-status');
            const data = await response.json();

            if (data.status === 'ok') {
                googleConnected = data.connected && !data.expired;
                
                const connectBtn = document.getElementById('connectGoogleBtn');
                const syncBtn = document.getElementById('syncGoogleBtn');
                const connectBtnText = document.getElementById('connectGoogleBtnText');

                const disconnectBtn = document.getElementById('disconnectGoogleBtn');
                if (googleConnected) {
                    if (connectBtn) connectBtn.style.display = 'none';
                    if (syncBtn) syncBtn.style.display = 'inline-flex';
                    if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
                    if (connectBtnText) connectBtnText.textContent = 'Conectado';
                } else {
                    if (connectBtn) connectBtn.style.display = 'inline-flex';
                    if (syncBtn) syncBtn.style.display = 'none';
                    if (disconnectBtn) disconnectBtn.style.display = 'none';
                    if (connectBtnText) connectBtnText.textContent = 'Conectar Google';
                }
            }
        } catch (error) {
            console.error('[CALENDAR] Erro ao verificar status Google:', error);
            // Em caso de erro, mostrar botão de conectar
            const connectBtn = document.getElementById('connectGoogleBtn');
            const syncBtn = document.getElementById('syncGoogleBtn');
            const disconnectBtn = document.getElementById('disconnectGoogleBtn');
            if (connectBtn) connectBtn.style.display = 'inline-flex';
            if (syncBtn) syncBtn.style.display = 'none';
            if (disconnectBtn) disconnectBtn.style.display = 'none';
        }
    }

    /**
     * Conectar conta do Google
     */
    async function connectGoogleAccount() {
        const connectBtn = document.getElementById('connectGoogleBtn');
        if (!connectBtn) return;

        const originalText = connectBtn.innerHTML;
        
        try {
            connectBtn.disabled = true;
            connectBtn.innerHTML = '<span style="display: inline-block; animation: spin 1s linear infinite;">⟳</span> Conectando...';

            const response = await fetchAuth('/api/admin/calendar/connect-google');
            const data = await response.json();

            if (data.status === 'ok' && data.authUrl) {
                // Abrir janela popup para autorização
                const width = 500;
                const height = 600;
                const left = (screen.width - width) / 2;
                const top = (screen.height - height) / 2;

                const popup = window.open(
                    data.authUrl,
                    'GoogleAuth',
                    `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no`
                );

                // Verificar se a janela foi fechada (autorização concluída)
                const checkClosed = setInterval(async () => {
                    if (popup.closed) {
                        clearInterval(checkClosed);
                        connectBtn.disabled = false;
                        connectBtn.innerHTML = originalText;
                        // Recarregar status
                        await checkGoogleConnectionStatus();
                        // Recarregar eventos
                        if (calendar) {
                            calendar.refetchEvents();
                        }
                    }
                }, 500);
            } else {
                throw new Error(data.error || 'Erro ao iniciar conexão');
            }
        } catch (error) {
            console.error('[CALENDAR] Erro ao conectar Google:', error);
            showAlert(`Erro ao conectar: ${error.message}`);
            connectBtn.disabled = false;
            connectBtn.innerHTML = originalText;
        }
    }

    /**
     * Sincronizar com Google Calendar
     */
    async function syncGoogleCalendar() {
        const syncBtn = document.getElementById('syncGoogleBtn');
        if (!syncBtn) return;
        
        const originalText = syncBtn.innerHTML;
        
        try {
            syncBtn.disabled = true;
            syncBtn.innerHTML = '<span style="display: inline-block; animation: spin 1s linear infinite;">⟳</span> Sincronizando...';
            
            const response = await fetchAuth('/api/admin/calendar/sync-google', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.status === 'ok') {
                const message = data.note || data.message || 'Sincronização concluída';
                console.log('[CALENDAR] Sincronização:', message);
                
                // Mostrar mensagem mais amigável
                if (data.note) {
                    showAlert('ℹ️ ' + data.note);
                } else {
                    showAlert('✅ ' + message);
                }
                
                // Recarregar eventos após sincronização
                if (calendar) {
                    setTimeout(() => {
                        calendar.refetchEvents();
                    }, 1000);
                }
            } else {
                throw new Error(data.error || 'Erro ao sincronizar');
            }
        } catch (error) {
            console.error('[CALENDAR] Erro ao sincronizar Google Calendar:', error);
            
            // Mensagem de erro mais amigável
            let errorMessage = error.message || 'Erro desconhecido';
            
            if (errorMessage.includes('Não autenticado')) {
                errorMessage = 'Você precisa estar autenticado para sincronizar.';
            } else if (errorMessage.includes('não está conectado com Google')) {
                errorMessage = 'Você precisa fazer login com Google OAuth primeiro.';
            } else if (errorMessage.includes('não está configurado')) {
                errorMessage = 'Google OAuth não está configurado no servidor.';
            }
            
            showAlert('⚠️ Erro ao sincronizar: ' + errorMessage);
        } finally {
            syncBtn.disabled = false;
            syncBtn.innerHTML = originalText;
        }
    }

    /**
     * Excluir evento
     */
    async function deleteEvent() {
        if (!currentEventId) return;

        showConfirm('Tem certeza que deseja excluir este evento?', 'Excluir evento', async () => {
        try {
            const response = await fetchAuth(`/api/admin/calendar/events/${currentEventId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.status === 'ok') {
                closeModal();
                calendar.refetchEvents();
            } else {
                throw new Error(data.error || 'Erro ao excluir evento');
            }
        } catch (error) {
            console.error('[CALENDAR] Erro ao excluir evento:', error);
            showAlert(`Erro ao excluir evento: ${error.message}`);
        }
        });
    }

    /**
     * Inicializar
     */
    async function init() {
        if (!checkAuth()) return;

        // Inicializar calendário
        initCalendar();

        // Event listeners
        const newEventBtn = document.getElementById('newEventBtn');
        const refreshBtn = document.getElementById('refreshCalendarBtn');
        const syncGoogleBtn = document.getElementById('syncGoogleBtn');
        const closeModalBtn = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        const eventForm = document.getElementById('eventForm');
        const modal = document.getElementById('eventModal');

        if (newEventBtn) {
            newEventBtn.addEventListener('click', () => openNewEventModal());
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (calendar) calendar.refetchEvents();
                loadActivitiesList(currentActivityFilter);
            });
        }

        // Botão de conectar Google
        const connectGoogleBtn = document.getElementById('connectGoogleBtn');
        if (connectGoogleBtn) {
            connectGoogleBtn.addEventListener('click', async () => {
                await connectGoogleAccount();
            });
        }

        if (syncGoogleBtn) {
            syncGoogleBtn.addEventListener('click', async () => {
                await syncGoogleCalendar();
            });
        }

        const disconnectGoogleBtn = document.getElementById('disconnectGoogleBtn');
        if (disconnectGoogleBtn) {
            disconnectGoogleBtn.addEventListener('click', () => {
                showConfirm('Desligar a conta Google? Terá de usar «Conectar Google» de novo para sincronizar ou trocar de conta.', 'Desligar Google', async () => {
                try {
                    const response = await fetchAuth('/api/admin/calendar/disconnect-google', { method: 'POST' });
                    const data = await response.json();
                    if (data.status === 'ok') {
                        await checkGoogleConnectionStatus();
                        if (calendar) calendar.refetchEvents();
                    } else {
                        showAlert(data.error || 'Erro ao desligar');
                    }
                } catch (err) {
                    showAlert('Erro: ' + (err.message || 'Não foi possível desligar'));
                }
                });
            });
        }

        // Guardar tokens Google manualmente
        const saveGoogleTokensBtn = document.getElementById('saveGoogleTokensBtn');
        const pasteAccessToken = document.getElementById('pasteAccessToken');
        const pasteRefreshToken = document.getElementById('pasteRefreshToken');
        const saveTokensMessage = document.getElementById('saveTokensMessage');
        if (saveGoogleTokensBtn && pasteAccessToken) {
            saveGoogleTokensBtn.addEventListener('click', async () => {
                const accessToken = pasteAccessToken.value.trim();
                if (!accessToken) {
                    if (saveTokensMessage) saveTokensMessage.textContent = 'Indique o access token.';
                    return;
                }
                saveGoogleTokensBtn.disabled = true;
                if (saveTokensMessage) saveTokensMessage.textContent = '';
                try {
                    const response = await fetchAuth('/api/admin/calendar/save-google-tokens', {
                        method: 'POST',
                        body: JSON.stringify({
                            access_token: accessToken,
                            refresh_token: (pasteRefreshToken && pasteRefreshToken.value) ? pasteRefreshToken.value.trim() : null
                        })
                    });
                    const data = await response.json();
                    if (data.status === 'ok') {
                        if (saveTokensMessage) saveTokensMessage.textContent = 'Guardado.';
                        if (pasteAccessToken) pasteAccessToken.value = '';
                        if (pasteRefreshToken) pasteRefreshToken.value = '';
                        await checkGoogleConnectionStatus();
                        if (calendar) calendar.refetchEvents();
                    } else {
                        if (saveTokensMessage) saveTokensMessage.textContent = data.error || 'Erro';
                    }
                } catch (err) {
                    if (saveTokensMessage) saveTokensMessage.textContent = err.message || 'Erro ao guardar';
                } finally {
                    saveGoogleTokensBtn.disabled = false;
                }
            });
        }

        // Verificar status da conexão Google
        await checkGoogleConnectionStatus();

        // Atividades (corporação): abas e lista
        loadActivitiesList('hoje').catch(function() {});
        document.querySelectorAll('.activities-tabs .tab-button').forEach(btn => {
            btn.addEventListener('click', () => {
                currentActivityFilter = btn.dataset.activityFilter || 'hoje';
                document.querySelectorAll('.activities-tabs .tab-button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadActivitiesList(currentActivityFilter);
            });
        });
        document.getElementById('closeActivityDetailModal')?.addEventListener('click', closeActivityDetailModal);
        document.getElementById('closeActivityDetailBtn')?.addEventListener('click', closeActivityDetailModal);
        document.getElementById('activityDetailModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'activityDetailModal') closeActivityDetailModal();
        });

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModal);
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', deleteEvent);
        }

        if (eventForm) {
            eventForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const title = document.getElementById('eventTitle').value.trim();
                const description = document.getElementById('eventDescription').value.trim();
                const type = document.getElementById('eventType').value;
                const status = document.getElementById('eventStatus').value;
                const startDate = document.getElementById('eventStartDate').value;
                const endDate = document.getElementById('eventEndDate').value;

                if (!title || !startDate) {
                    showAlert('Por favor, preencha título e data de início');
                    return;
                }

                // Converter para formato MySQL (YYYY-MM-DD HH:mm:ss)
                const startDateTime = new Date(startDate);
                const startStr = startDateTime.toISOString().slice(0, 19).replace('T', ' ');
                
                let endStr = null;
                if (endDate) {
                    const endDateTime = new Date(endDate);
                    endStr = endDateTime.toISOString().slice(0, 19).replace('T', ' ');
                }

                const eventData = {
                    title: title,
                    description: description || null,
                    type: type,
                    status: status,
                    start_date: startStr,
                    end_date: endStr
                };

                await saveEvent(eventData);
            });
        }

        // Fechar modal ao clicar fora
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                showConfirm('Tem certeza que deseja sair?', 'Sair', () => {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                });
            });
        }

        console.log('[CALENDAR] Calendário inicializado');
    }

    /**
     * Aguardar FullCalendar estar disponível
     */
    function waitForFullCalendar(maxAttempts = 20, attempt = 0) {
        return new Promise((resolve, reject) => {
            if (typeof FullCalendar !== 'undefined') {
                console.log('[CALENDAR] FullCalendar detectado!');
                resolve();
                return;
            }

            if (attempt >= maxAttempts) {
                reject(new Error('FullCalendar não carregou após ' + (maxAttempts * 200) + 'ms'));
                return;
            }

            setTimeout(() => {
                waitForFullCalendar(maxAttempts, attempt + 1).then(resolve).catch(reject);
            }, 200);
        });
    }

    /**
     * Inicializar quando tudo estiver pronto
     */
    function startInitialization() {
        const initWhenReady = async () => {
            // Aguardar DOM
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            console.log('[CALENDAR] DOM pronto, aguardando FullCalendar...');

            // Aguardar FullCalendar
            try {
                await waitForFullCalendar(30); // 30 tentativas = 6 segundos
                console.log('[CALENDAR] FullCalendar carregado, inicializando calendário...');
                await init();
            } catch (error) {
                console.error('[CALENDAR] Erro ao aguardar FullCalendar:', error);
                const calendarEl = document.getElementById('calendar');
                if (calendarEl) {
                    calendarEl.innerHTML = `
                        <div style="padding: 2rem; text-align: center; color: #fca5a5;">
                            <h3>Erro ao carregar FullCalendar</h3>
                            <p>Não foi possível carregar a biblioteca do calendário.</p>
                            <p>Possíveis causas:</p>
                            <ul style="text-align: left; display: inline-block; margin: 1rem 0;">
                                <li>Problema de conexão com a internet</li>
                                <li>Bloqueio de recursos externos pelo navegador</li>
                                <li>Problema com o servidor CDN</li>
                            </ul>
                            <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: #ff9800; color: #0f0f10; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                Recarregar Página
                            </button>
                        </div>
                    `;
                }
            }
        };

        initWhenReady();
    }

    // Iniciar
    startInitialization();
})();

