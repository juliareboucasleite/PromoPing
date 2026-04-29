(function () {
    'use strict';

    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : (localStorage.getItem('PROMOPING_API') || 'http://localhost:3000');
    const token = localStorage.getItem('PROMOPING_TOKEN');
    if (!token) { window.location.replace('../pages/login.html'); return; }

    const state = {
        connected: false,
        guilds: [],
        selectedGuildId: null,
        channels: [],
        requestsTab: 'pending',
    };

    const $ = id => document.getElementById(id);

    function api(path, opts = {}) {
        return fetch(`${API_BASE}${path}`, {
            ...opts,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...(opts.headers || {}),
            },
        }).then(async r => {
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw Object.assign(new Error(data.error || `HTTP ${r.status}`), { status: r.status, data });
            return data;
        });
    }

    function toast(msg, kind = 'success') {
        const el = $('toast');
        el.textContent = msg;
        el.className = `dc-toast show ${kind}`;
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), 3000);
    }

    // ----- Connection card -----
    async function loadConnection() {
        try {
            const data = await api('/api/discord/panel/status');
            state.connected = !!data.connected;
            renderConnection(data);
            if (data.connected) loadGuilds();
            else $('guildList').innerHTML = '<div class="dc-empty">Liga a tua conta Discord para ver os servidores.</div>';
        } catch (err) {
            $('connectionContent').textContent = 'Erro ao obter estado: ' + err.message;
        }
    }

    function renderConnection(data) {
        const el = $('connectionContent');
        if (!data.connected) {
            el.innerHTML = `
                <div class="dc-connect-row">
                    <div class="dc-avatar"></div>
                    <div style="flex:1;">
                        <div><span class="dc-status-dot off"></span><strong>Não ligado</strong></div>
                        <div class="muted">Liga a tua conta Discord para listar servidores onde és gestor.</div>
                    </div>
                    <button id="connectBtn" class="dc-btn dc-btn-primary">Conectar Discord</button>
                </div>
            `;
            $('connectBtn').onclick = connectDiscord;
        } else {
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
        } catch (err) { toast(err.message, 'error'); }
    }

    // ----- Guilds -----
    async function loadGuilds() {
        try {
            const data = await api('/api/discord/panel/guilds');
            state.guilds = data.guilds || [];
            renderGuilds();
        } catch (err) {
            if (err.data && err.data.code === 'DISCORD_TOKEN_EXPIRED') {
                $('guildList').innerHTML = '<div class="dc-empty">Token Discord expirou. <a href="#" id="reconnect">Reconectar</a></div>';
                $('reconnect').onclick = e => { e.preventDefault(); connectDiscord(); };
            } else {
                $('guildList').innerHTML = `<div class="dc-empty">Erro: ${escapeHtml(err.message)}</div>`;
            }
        }
    }

    function renderGuilds() {
        const list = $('guildList');
        if (!state.guilds.length) {
            list.innerHTML = '<div class="dc-empty">Nenhum servidor onde tenhas permissão de gestão.</div>';
            return;
        }
        list.innerHTML = state.guilds.map(g => `
            <div class="dc-guild-item ${g.id === state.selectedGuildId ? 'selected' : ''}" data-id="${g.id}">
                <div class="dc-guild-icon" ${g.icon_url ? `style="background:url('${g.icon_url}') center/cover;"` : ''}></div>
                <span class="dc-guild-name">${escapeHtml(g.name)}</span>
                <span class="dc-guild-flag ${g.bot_present ? 'bot-yes' : 'bot-no'}">${g.bot_present ? 'Bot ligado' : 'Sem bot'}</span>
            </div>
        `).join('');
        list.querySelectorAll('.dc-guild-item').forEach(el => {
            el.onclick = () => selectGuild(el.dataset.id);
        });
    }

    async function selectGuild(guildId) {
        const g = state.guilds.find(x => x.id === guildId);
        if (!g) return;
        if (!g.bot_present) {
            toast('O bot não está nesse servidor — clica "Adicionar servidor"', 'error');
            return;
        }
        state.selectedGuildId = guildId;
        renderGuilds();
        $('builderCard').style.display = '';
        $('fChannel').innerHTML = '<option>A carregar canais...</option>';
        try {
            const data = await api(`/api/discord/panel/guilds/${guildId}/channels`);
            state.channels = data.channels || [];
            $('fChannel').innerHTML = state.channels.length
                ? state.channels.map(c => `<option value="${c.id}">#${escapeHtml(c.name)}</option>`).join('')
                : '<option value="">Nenhum canal de texto</option>';
        } catch (err) {
            $('fChannel').innerHTML = `<option value="">Erro: ${escapeHtml(err.message)}</option>`;
        }
    }

    async function addBot() {
        try {
            const { url } = await api('/api/discord/panel/bot-invite');
            window.open(url, '_blank', 'noopener');
        } catch (err) { toast(err.message, 'error'); }
    }

    // ----- Builder + preview -----
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
            coupon_code: $('fCoupon').value.trim() || null,
        };
    }

    function updatePreview() {
        const p = getFormPayload();
        const colorHex = $('fColor').value || '#5865f2';
        $('fColorHex').textContent = colorHex.toUpperCase();
        $('previewEmbed').style.borderLeftColor = colorHex;
        $('previewTitle').textContent = p.title || 'Título do embed';
        $('previewTitle').style.opacity = p.title ? '1' : '0.4';

        let descHtml = p.description ? escapeHtml(p.description) : 'A descrição aparece aqui.';
        if (p.coupon_code) descHtml += `\n\n<strong>Código:</strong> <code>${escapeHtml(p.coupon_code)}</code>`;
        $('previewDesc').innerHTML = descHtml;
        $('previewDesc').style.opacity = (p.description || p.coupon_code) ? '1' : '0.4';

        const img = $('previewImg');
        if (p.image_url) { img.src = p.image_url; img.style.display = ''; }
        else img.style.display = 'none';

        const btn = $('previewBtn');
        if (p.button_label && p.button_url) {
            btn.textContent = p.button_label;
            btn.href = p.button_url;
            btn.style.display = '';
        } else btn.style.display = 'none';
    }

    async function sendCoupon() {
        const p = getFormPayload();
        if (!p.guild_id || !p.channel_id) return toast('Selecciona servidor e canal', 'error');
        if (!p.title && !p.description) return toast('Mete pelo menos um título ou descrição', 'error');
        $('sendBtn').disabled = true;
        try {
            await api('/api/discord/panel/request', { method: 'POST', body: JSON.stringify(p) });
            toast('Pedido enviado para aprovação da Corporação');
            resetForm();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            $('sendBtn').disabled = false;
        }
    }

    function resetForm() {
        ['fTitle', 'fDesc', 'fImage', 'fBtnLabel', 'fBtnUrl', 'fCoupon'].forEach(id => $(id).value = '');
        $('fColor').value = '#5865f2';
        updatePreview();
    }

    // ----- Requests inbox -----
    async function loadRequests() {
        const list = $('requestsList');
        list.innerHTML = '<div class="dc-empty">A carregar...</div>';
        try {
            const data = await api(`/api/discord/panel/requests?status=${state.requestsTab}`);
            const items = data.requests || [];
            if (!items.length) { list.innerHTML = '<div class="dc-empty">Sem solicitações.</div>'; return; }
            list.innerHTML = items.map(r => `
                <div class="dc-request-item ${r.status}">
                    <div class="dc-request-meta">
                        <strong>${escapeHtml(r.requester_name || r.requester_email || 'Suporte')}</strong> · ${new Date(r.created_at).toLocaleString('pt-PT')}
                    </div>
                    <div><strong>${escapeHtml(r.title || '(sem título)')}</strong></div>
                    <div class="muted" style="margin: 0.3rem 0;">${escapeHtml((r.description || '').substring(0, 200))}${(r.description || '').length > 200 ? '...' : ''}</div>
                    ${r.coupon_code ? `<div class="muted">Código: <code>${escapeHtml(r.coupon_code)}</code></div>` : ''}
                    ${r.status === 'pending' ? `
                        <div class="dc-request-actions">
                            <button class="dc-btn dc-btn-success" data-action="approve" data-id="${r.id}">Aprovar e enviar</button>
                            <button class="dc-btn dc-btn-danger" data-action="reject" data-id="${r.id}">Rejeitar</button>
                        </div>` : ''}
                    ${r.review_note ? `<div class="muted" style="margin-top:0.4rem;">Nota: ${escapeHtml(r.review_note)}</div>` : ''}
                </div>
            `).join('');
            list.querySelectorAll('button[data-action]').forEach(btn => {
                btn.onclick = () => reviewRequest(btn.dataset.id, btn.dataset.action);
            });
        } catch (err) {
            list.innerHTML = `<div class="dc-empty">Erro: ${escapeHtml(err.message)}</div>`;
        }
    }

    async function reviewRequest(id, action) {
        const note = action === 'reject' ? prompt('Motivo da rejeição (opcional):') : (prompt('Nota (opcional):') || null);
        try {
            await api(`/api/discord/panel/requests/${id}/${action}`, {
                method: 'POST',
                body: JSON.stringify({ note }),
            });
            toast(action === 'approve' ? 'Aprovado e enfileirado' : 'Rejeitado');
            loadRequests();
        } catch (err) { toast(err.message, 'error'); }
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function init() {
        ['fTitle', 'fDesc', 'fColor', 'fImage', 'fBtnLabel', 'fBtnUrl', 'fCoupon'].forEach(id => {
            $(id).addEventListener('input', updatePreview);
        });
        $('addBotBtn').onclick = addBot;
        $('sendBtn').onclick = sendCoupon;
        $('resetBtn').onclick = resetForm;
        document.querySelectorAll('.dc-tab').forEach(t => {
            t.onclick = () => {
                document.querySelectorAll('.dc-tab').forEach(x => x.classList.remove('active'));
                t.classList.add('active');
                state.requestsTab = t.dataset.tab;
                loadRequests();
            };
        });

        const params = new URLSearchParams(window.location.search);
        if (params.get('linked') === '1') toast('Conta Discord ligada com sucesso');
        if (params.get('bot_added') === '1') toast('Bot adicionado ao servidor');
        if (params.get('error')) toast('Erro OAuth: ' + params.get('error'), 'error');

        loadConnection();
        loadRequests();
        updatePreview();
        setInterval(() => {
            if (state.connected) loadRequests();
        }, 30000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
