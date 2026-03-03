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
     * Carregar eventos do servidor
     */
    async function loadEvents(start, end) {
        try {
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];
            
            const response = await fetchAuth(`/api/admin/calendar/events?start=${startStr}&end=${endStr}`);
            const data = await response.json();

            if (data.status === 'ok' && data.events) {
                // Formatar eventos para FullCalendar
                return data.events.map(event => ({
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
                        createdAt: event.createdAt
                    }
                }));
            }

            return [];
        } catch (error) {
            console.error('[CALENDAR] Erro ao carregar eventos:', error);
            alert(`Erro ao carregar eventos: ${error.message}`);
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
                openEventModal(info.event);
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
            alert(`Erro ao salvar evento: ${error.message}`);
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
            alert(`Erro ao atualizar evento: ${error.message}`);
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
            alert(`Erro ao conectar: ${error.message}`);
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
                    alert('ℹ️ ' + data.note);
                } else {
                    alert('✅ ' + message);
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
            
            alert('⚠️ Erro ao sincronizar: ' + errorMessage);
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

        if (!confirm('Tem certeza que deseja excluir este evento?')) {
            return;
        }

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
            alert(`Erro ao excluir evento: ${error.message}`);
        }
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
                if (calendar) {
                    calendar.refetchEvents();
                }
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
            disconnectGoogleBtn.addEventListener('click', async () => {
                if (!confirm('Desligar a conta Google? Terá de usar «Conectar Google» de novo para sincronizar ou trocar de conta.')) return;
                try {
                    const response = await fetchAuth('/api/admin/calendar/disconnect-google', { method: 'POST' });
                    const data = await response.json();
                    if (data.status === 'ok') {
                        await checkGoogleConnectionStatus();
                        if (calendar) calendar.refetchEvents();
                    } else {
                        alert(data.error || 'Erro ao desligar');
                    }
                } catch (err) {
                    alert('Erro: ' + (err.message || 'Não foi possível desligar'));
                }
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
                    alert('Por favor, preencha título e data de início');
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
                if (confirm('Tem certeza que deseja sair?')) {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                }
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

