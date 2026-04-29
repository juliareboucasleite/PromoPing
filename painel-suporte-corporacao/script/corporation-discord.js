(function () {
    'use strict';

    const API_BASE = window.APIUtils
        ? window.APIUtils.getSafeApiBase()
        : (localStorage.getItem('PROMOPING_API') || 'http://localhost:3000');
    const token = localStorage.getItem('PROMOPING_TOKEN');
    if (!token) {
        window.location.replace('../pages/login.html');
        return;
    }

    const state = {
        connected: false,
        guilds: [],
        selectedGuildId: null,
        channels: [],
        requestsTab: 'pending'
    };

    const $ = (id) => document.getElementById(id);

    function api(path, opts = {}) {
        return fetch(`${API_BASE}${path}`, {
            ...opts,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...(opts.headers || {})
            }
        }).then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw Object.assign(
                    new Error(data.error || `HTTP ${response.status}`),
                    { status: response.status, data }
                );
            }
            return data;
        });
    }

    function toast(message, kind = 'success') {
        const el = $('toast');
        if (!el) return;
        el.textContent = message;
        el.className = `dc-toast show ${kind}`;
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), 3000);
    }

    async function loadConnection() {
        try {
            const data = await api('/api/discord/panel/status');
            state.connected = !!data.connected;
            renderConnection(data);

            if (data.connected) {
                loadGuilds();
            } else if ($('guildList')) {
                $('guildList').innerHTML = '<div class="dc-empty">Liga a tua conta Discord para ver os servidores.</div>';
            }
        } catch (err) {
            if ($('connectionContent')) {
                $('connectionContent').textContent = `Erro ao obter estado: ${err.message}`;
            }
        }
    }

    function renderConnection(data) {
        const el = $('connectionContent');
        if (!el) return;

        if (!data.connected) {
            el.innerHTML = `
                <div class="dc-connect-row">
                    <div class="dc-avatar"></div>
                    <div style="flex:1;">
                        <div><span class="dc-status-dot off"></span><strong>Nao ligado</strong></div>
                        <div class="muted">Liga a tua conta Discord para listar servidores onde es gestor.</div>
                    </div>
                    <button id="connectBtn" class="dc-btn dc-btn-primary">Conectar Discord</button>
                </div>
            `;
            $('connectBtn').onclick = connectDiscord;
            return;
        }

        el.innerHTML = `
            <div class="dc-connect-row">
                <img class="dc-avatar" src="${data.avatar_url || ''}" alt="" onerror="this.style.background='var(--surface-3)';this.removeAttribute('src');">
                <div style="flex:1;">
                    <div><span class="dc-status-dot on"></span><strong class="dc-username">${escapeHtml(data.username || '')}</strong></div>
                    <div class="muted">Conta Discord ligada</div>
                </div>
                <button id="disconnectBtn" class="dc-btn dc-btn-danger">Desligar</button>
            </div>
        `;
        $('disconnectBtn').onclick = disconnectDiscord;
    }

    async function connectDiscord() {
        try {
            const { url } = await api('/api/discord/panel/connect');
            window.location.href = url;
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    async function disconnectDiscord() {
        if (!confirm('Desligar a tua conta Discord deste painel?')) return;
        try {
            await api('/api/discord/panel/disconnect', { method: 'POST' });
            toast('Conta desligada');
            loadConnection();
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    async function loadGuilds() {
        try {
            const data = await api('/api/discord/panel/guilds');
            state.guilds = data.guilds || [];
            renderGuilds();
        } catch (err) {
            if (err.data && err.data.code === 'DISCORD_TOKEN_EXPIRED') {
                $('guildList').innerHTML = '<div class="dc-empty">Token Discord expirou. <a href="#" id="reconnect">Reconectar</a></div>';
                $('reconnect').onclick = (e) => {
                    e.preventDefault();
                    connectDiscord();
                };
            } else {
                $('guildList').innerHTML = `<div class="dc-empty">Erro: ${escapeHtml(err.message)}</div>`;
            }
        }
    }

    function renderGuilds() {
        const list = $('guildList');
        if (!list) return;

        if (!state.guilds.length) {
            list.innerHTML = '<div class="dc-empty">Nenhum servidor onde tenhas permissao de gestao.</div>';
            return;
        }

        list.innerHTML = state.guilds.map((guild) => `
            <div class="dc-guild-item ${guild.id === state.selectedGuildId ? 'selected' : ''}" data-id="${guild.id}">
                <div class="dc-guild-icon" ${guild.icon_url ? `style="background:url('${guild.icon_url}') center/cover;"` : ''}></div>
                <span class="dc-guild-name">${escapeHtml(guild.name)}</span>
                <span class="dc-guild-flag ${guild.bot_present ? 'bot-yes' : 'bot-no'}">${guild.bot_present ? 'Bot ligado' : 'Sem bot'}</span>
            </div>
        `).join('');

        list.querySelectorAll('.dc-guild-item').forEach((el) => {
            el.onclick = () => selectGuild(el.dataset.id);
        });
    }

    async function selectGuild(guildId) {
        const guild = state.guilds.find((item) => item.id === guildId);
        if (!guild) return;

        if (!guild.bot_present) {
            toast('O bot nao esta nesse servidor. Usa "Adicionar servidor" primeiro.', 'error');
            return;
        }

        state.selectedGuildId = guildId;
        renderGuilds();

        if ($('builderCard')) $('builderCard').style.display = '';
        if ($('fChannel')) $('fChannel').innerHTML = '<option>A carregar canais...</option>';

        try {
            const data = await api(`/api/discord/panel/guilds/${guildId}/channels`);
            state.channels = data.channels || [];
            $('fChannel').innerHTML = state.channels.length
                ? state.channels.map((channel) => `<option value="${channel.id}">#${escapeHtml(channel.name)}</option>`).join('')
                : '<option value="">Nenhum canal de texto</option>';
        } catch (err) {
            $('fChannel').innerHTML = `<option value="">Erro: ${escapeHtml(err.message)}</option>`;
        }
    }

    async function addBot() {
        try {
            const { url } = await api('/api/discord/panel/bot-invite');
            window.open(url, '_blank', 'noopener');
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    function getFormPayload() {
        const colorHex = $('fColor').value || '#5865f2';
        const colorInt = parseInt(colorHex.replace('#', ''), 16);

        return {
            guild_id: state.selectedGuildId,
            channel_id: $('fChannel').value,
            title: $('fTitle').value.trim() || null,
            description: $('fDesc').value.trim() || null,
            color: colorInt,
            image_url: $('fImage').value.trim() || null,
            button_label: $('fBtnLabel').value.trim() || null,
            button_url: $('fBtnUrl').value.trim() || null,
            coupon_code: $('fCoupon').value.trim() || null
        };
    }

    function updatePreview() {
        const payload = getFormPayload();
        const colorHex = $('fColor').value || '#5865f2';

        $('fColorHex').textContent = colorHex.toUpperCase();
        $('previewEmbed').style.borderLeftColor = colorHex;
        $('previewTitle').textContent = payload.title || 'Titulo do embed';
        $('previewTitle').style.opacity = payload.title ? '1' : '0.4';

        let descHtml = payload.description ? escapeHtml(payload.description) : 'A descricao aparece aqui.';
        if (payload.coupon_code) {
            descHtml += `\n\n<strong>Codigo:</strong> <code>${escapeHtml(payload.coupon_code)}</code>`;
        }
        $('previewDesc').innerHTML = descHtml;
        $('previewDesc').style.opacity = (payload.description || payload.coupon_code) ? '1' : '0.4';

        const img = $('previewImg');
        if (payload.image_url) {
            img.src = payload.image_url;
            img.style.display = '';
        } else {
            img.style.display = 'none';
        }

        const btn = $('previewBtn');
        if (payload.button_label && payload.button_url) {
            btn.textContent = payload.button_label;
            btn.href = payload.button_url;
            btn.style.display = '';
        } else {
            btn.style.display = 'none';
        }
    }

    async function sendCoupon() {
        const payload = getFormPayload();
        if (!payload.guild_id || !payload.channel_id) {
            return toast('Selecciona servidor e canal', 'error');
        }
        if (!payload.title && !payload.description) {
            return toast('Mete pelo menos um titulo ou descricao', 'error');
        }

        $('sendBtn').disabled = true;
        try {
            await api('/api/discord/panel/send', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            toast('Cupao enviado e enfileirado para publicacao');
            resetForm();
            loadRequests();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            $('sendBtn').disabled = false;
        }
    }

    function resetForm() {
        ['fTitle', 'fDesc', 'fImage', 'fBtnLabel', 'fBtnUrl', 'fCoupon'].forEach((id) => {
            $(id).value = '';
        });
        $('fColor').value = '#5865f2';
        updatePreview();
    }

    async function loadRequests() {
        const list = $('requestsList');
        if (!list) return;

        list.innerHTML = '<div class="dc-empty">A carregar...</div>';
        try {
            const data = await api(`/api/discord/panel/requests?status=${state.requestsTab}`);
            const items = data.requests || [];
            if (!items.length) {
                list.innerHTML = '<div class="dc-empty">Sem solicitacoes.</div>';
                return;
            }

            list.innerHTML = items.map((request) => `
                <div class="dc-request-item ${request.status}">
                    <div class="dc-request-meta">
                        <strong>${escapeHtml(request.requester_name || request.requester_email || 'Suporte')}</strong> · ${new Date(request.created_at).toLocaleString('pt-PT')}
                    </div>
                    <div><strong>${escapeHtml(request.title || '(sem titulo)')}</strong></div>
                    <div class="muted" style="margin: 0.3rem 0;">${escapeHtml((request.description || '').substring(0, 200))}${(request.description || '').length > 200 ? '...' : ''}</div>
                    ${request.coupon_code ? `<div class="muted">Codigo: <code>${escapeHtml(request.coupon_code)}</code></div>` : ''}
                    ${request.status === 'pending' ? `
                        <div class="dc-request-actions">
                            <button class="dc-btn dc-btn-success" data-action="approve" data-id="${request.id}">Aprovar e enviar</button>
                            <button class="dc-btn dc-btn-danger" data-action="reject" data-id="${request.id}">Rejeitar</button>
                        </div>
                    ` : ''}
                    ${request.review_note ? `<div class="muted" style="margin-top:0.4rem;">Nota: ${escapeHtml(request.review_note)}</div>` : ''}
                </div>
            `).join('');

            list.querySelectorAll('button[data-action]').forEach((btn) => {
                btn.onclick = () => reviewRequest(btn.dataset.id, btn.dataset.action);
            });
        } catch (err) {
            list.innerHTML = `<div class="dc-empty">Erro: ${escapeHtml(err.message)}</div>`;
        }
    }

    async function reviewRequest(id, action) {
        const note = action === 'reject'
            ? prompt('Motivo da rejeicao (opcional):')
            : (prompt('Nota (opcional):') || null);

        try {
            await api(`/api/discord/panel/requests/${id}/${action}`, {
                method: 'POST',
                body: JSON.stringify({ note })
            });
            toast(action === 'approve' ? 'Aprovado e enfileirado' : 'Rejeitado');
            loadRequests();
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function init() {
        ['fTitle', 'fDesc', 'fColor', 'fImage', 'fBtnLabel', 'fBtnUrl', 'fCoupon'].forEach((id) => {
            $(id).addEventListener('input', updatePreview);
        });

        $('addBotBtn').onclick = addBot;
        $('sendBtn').onclick = sendCoupon;
        $('resetBtn').onclick = resetForm;

        document.querySelectorAll('.dc-tab').forEach((tab) => {
            tab.onclick = () => {
                document.querySelectorAll('.dc-tab').forEach((item) => item.classList.remove('active'));
                tab.classList.add('active');
                state.requestsTab = tab.dataset.tab;
                loadRequests();
            };
        });

        const params = new URLSearchParams(window.location.search);
        if (params.get('linked') === '1') toast('Conta Discord ligada com sucesso');
        if (params.get('bot_added') === '1') toast('Bot adicionado ao servidor');
        if (params.get('error')) toast(`Erro OAuth: ${params.get('error')}`, 'error');

        loadConnection();
        loadRequests();
        updatePreview();

        setInterval(() => {
            if (state.connected) loadRequests();
        }, 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
