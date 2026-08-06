/**
 * Perfil - PromoPing Admin
 */

(function() {
    'use strict';

    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = localStorage.getItem('PROMOPING_TOKEN');

    function checkAuth() {
        if (!TOKEN) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    async function fetchAuth(url, options = {}) {
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
            throw new Error(`Resposta inválida do servidor (${response.status})`);
        }
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
        }
        return response;
    }

    let userHasPassword = null;
    let twoFAStatus = { enabled: false, pending: false, method: null };

    async function loadProfile() {
        try {
            const response = await fetchAuth('/api/user/me');
            const data = await response.json();
            const user = data.user || {};

            const nameInput = document.getElementById('profileName');
            const emailInput = document.getElementById('profileEmail');
            const phoneDisplay = document.getElementById('profilePhoneDisplay');
            const nome = user.Nome || user.nome || '';
            const email = user.Email || user.email || '';
            if (nameInput) nameInput.value = nome;
            if (emailInput) emailInput.value = email;
            if (phoneDisplay) {
                const phone = user.Telefone || user.telefone || user.phone;
                if (phone) {
                    phoneDisplay.textContent = phone;
                    phoneDisplay.classList.remove('is-placeholder');
                } else {
                    phoneDisplay.textContent = 'Nenhum número configurado.';
                    phoneDisplay.classList.add('is-placeholder');
                }
            }

            const pageGreeting = document.getElementById('profilePageGreeting');
            if (pageGreeting) {
                pageGreeting.textContent = nome
                    ? `Olá, ${nome}`
                    : (email ? `Olá, ${email}` : 'Olá');
            }

            userHasPassword = null;

            await load2FAStatus();
        } catch (error) {
            console.error('[PERFIL] Erro ao carregar perfil:', error);
        }
    }

    function update2FAUI() {
        const statusEl = document.getElementById('twoFAStatusText');
        const addBtn = document.getElementById('add2FABtn');
        const disableBtn = document.getElementById('disable2FABtn');
        const cancelSetupBtn = document.getElementById('cancel2FASetupBtn');
        const heroBadge = document.getElementById('profile2FABadge');

        if (statusEl) {
            statusEl.classList.remove('is-active', 'is-pending');
            if (twoFAStatus.enabled) {
                const methodLabel = twoFAStatus.method === 'email' ? 'código por e-mail' : 'app autenticadora';
                statusEl.textContent = `A autenticação de duas etapas está ativa (${methodLabel}).`;
                statusEl.classList.add('is-active');
            } else if (twoFAStatus.pending) {
                statusEl.textContent = 'Configuração iniciada mas ainda não concluída. Pode continuar ou cancelar.';
                statusEl.classList.add('is-pending');
            } else {
                statusEl.textContent = '';
            }
        }

        if (addBtn) {
            addBtn.textContent = twoFAStatus.pending ? 'Continuar configuração' : 'Ativar 2FA';
            addBtn.style.display = twoFAStatus.enabled ? 'none' : 'inline-flex';
        }
        if (cancelSetupBtn) {
            cancelSetupBtn.style.display = twoFAStatus.pending ? 'inline-flex' : 'none';
        }
        if (disableBtn) {
            disableBtn.style.display = twoFAStatus.enabled ? 'inline-flex' : 'none';
        }
        if (heroBadge) {
            heroBadge.style.display = twoFAStatus.enabled ? 'inline-flex' : 'none';
        }
    }

    async function load2FAStatus() {
        try {
            const response = await fetchAuth('/api/user/2fa/status');
            const data = await response.json();
            twoFAStatus = {
                enabled: !!(data.twoFA && data.twoFA.enabled),
                pending: !!(data.twoFA && data.twoFA.pending),
                method: (data.twoFA && data.twoFA.method) || null
            };
            update2FAUI();
        } catch (e) {
            twoFAStatus = { enabled: false, pending: false, method: null };
            update2FAUI();
        }
    }

    async function saveProfile() {
        const nameInput = document.getElementById('profileName');
        const emailInput = document.getElementById('profileEmail');
        if (!nameInput || !emailInput) return;
        const nome = nameInput.value.trim();
        const email = emailInput.value.trim();
        if (!nome) {
            showAlert('Por favor, preencha o nome');
            return;
        }
        try {
            await fetchAuth('/api/user/profile', {
                method: 'PUT',
                body: JSON.stringify({ nome, email })
            });
            showAlert('Perfil guardado com sucesso.');
        } catch (error) {
            console.error('[PERFIL] Erro ao salvar perfil:', error);
            showAlert('Erro ao guardar perfil: ' + (error.message || 'Tente novamente.'));
        }
    }

    function openChangePasswordModal() {
        userHasPassword = null;
        document.getElementById('changePasswordModalTitle').textContent = 'Alterar senha';
        document.getElementById('changePasswordCurrentWrap').style.display = 'block';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        document.getElementById('changePasswordModal').classList.add('show');
    }

    function closeChangePasswordModal() {
        document.getElementById('changePasswordModal').classList.remove('show');
    }

    async function submitChangePassword(e) {
        e.preventDefault();
        const current = document.getElementById('currentPassword').value;
        const newP = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmPassword').value;
        if (newP.length < 6) {
            showAlert('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (newP !== confirm) {
            showAlert('A confirmação da senha não coincide.');
            return;
        }
        try {
            const body = userHasPassword === false
                ? { password: newP }
                : { currentPassword: current, newPassword: newP };
            const endpoint = userHasPassword === false ? '/api/user/set-password' : '/api/user/change-password';
            await fetchAuth(endpoint, {
                method: 'POST',
                body: JSON.stringify(body)
            });
            showAlert('Senha guardada com sucesso.');
            closeChangePasswordModal();
        } catch (err) {
            if (err.message && err.message.includes('senha cadastrada')) {
                userHasPassword = false;
                document.getElementById('changePasswordModalTitle').textContent = 'Configurar senha';
                document.getElementById('changePasswordCurrentWrap').style.display = 'none';
                document.getElementById('currentPassword').value = '';
                return;
            }
            showAlert(err.message || 'Erro ao alterar senha.');
        }
    }

    function openPhoneModal() {
        const phoneDisplay = document.getElementById('profilePhoneDisplay');
        const current = phoneDisplay ? phoneDisplay.textContent : '';
        const empty = !current || current === '—' || current === 'Nenhum número configurado.';
        document.getElementById('phoneInput').value = empty ? '' : current;
        document.getElementById('phoneModal').classList.add('show');
    }

    function closePhoneModal() {
        document.getElementById('phoneModal').classList.remove('show');
    }

    async function submitPhone(e) {
        e.preventDefault();
        const telefone = document.getElementById('phoneInput').value.trim();
        try {
            await fetchAuth('/api/user/profile', {
                method: 'PUT',
                body: JSON.stringify({ telefone: telefone || null })
            });
            const el = document.getElementById('profilePhoneDisplay');
            if (el) {
                if (telefone) {
                    el.textContent = telefone;
                    el.classList.remove('is-placeholder');
                } else {
                    el.textContent = 'Nenhum número configurado.';
                    el.classList.add('is-placeholder');
                }
            }
            showAlert('Telefone guardado.');
            closePhoneModal();
        } catch (err) {
            showAlert(err.message || 'Erro ao guardar telefone.');
        }
    }

    
    function connectGoogle() {
        const path = window.location.pathname || '/painel-suporte-corporacao/pages/perfil.html';
        const base = (window.APIUtils ? window.APIUtils.buildSafeUrl('/api/auth/google') : `${API_BASE}/api/auth/google`);
        const url = base + '?returnTo=' + encodeURIComponent(path);
        window.location.href = url;
    }

    let twoFASetupData = null;

    function open2FAModal() {
        twoFASetupData = null;
        document.getElementById('twoFAModalTitle').textContent = 'Autenticação de duas etapas';
        document.getElementById('twoFASetupStep1').style.display = 'block';
        document.getElementById('twoFASetupStep2').style.display = 'none';
        document.getElementById('twoFAQRWrap').innerHTML = '';
        document.getElementById('twoFAQRWrap').style.display = 'none';
        document.getElementById('twoFAEmailSent').style.display = 'none';
        document.getElementById('twoFABackupCodes').textContent = '';
        document.getElementById('twoFACodeInput').value = '';
        document.getElementById('twoFAModal').classList.add('show');
    }

    function close2FAModal() {
        document.getElementById('twoFAModal').classList.remove('show');
    }

    async function start2FASetup(method) {
        try {
            const response = await fetchAuth('/api/user/2fa/setup', {
                method: 'POST',
                body: JSON.stringify({ method })
            });
            const data = await response.json();
            twoFASetupData = data;
            document.getElementById('twoFASetupStep1').style.display = 'none';
            document.getElementById('twoFASetupStep2').style.display = 'block';
            const qrWrap = document.getElementById('twoFAQRWrap');
            const emailSent = document.getElementById('twoFAEmailSent');
            const backupEl = document.getElementById('twoFABackupCodes');
            if (method === 'totp' && data.otpauthUrl) {
                qrWrap.style.display = 'block';
                qrWrap.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(data.otpauthUrl) + '" alt="QR Code" style="max-width: 200px;">';
                backupEl.textContent = 'Códigos de backup (guarde em segurança): ' + (data.backupCodes ? data.backupCodes.join(', ') : '');
            } else {
                qrWrap.style.display = 'none';
                emailSent.style.display = 'block';
                backupEl.textContent = 'Códigos de backup: ' + (data.backupCodes ? data.backupCodes.join(', ') : '');
            }
        } catch (err) {
            showAlert(err.message || 'Erro ao iniciar 2FA.');
        }
    }

    async function verify2FASetup() {
        const code = document.getElementById('twoFACodeInput').value.trim();
        if (!code) {
            showAlert('Introduza o código de verificação.');
            return;
        }
        try {
            await fetchAuth('/api/user/2fa/verify-setup', {
                method: 'POST',
                body: JSON.stringify({ code })
            });
            showAlert('2FA ativado com sucesso.');
            close2FAModal();
            load2FAStatus();
        } catch (err) {
            showAlert(err.message || 'Código inválido.');
        }
    }

    function openDisable2FAModal() {
        document.getElementById('disable2FACode').value = '';
        const sendEmailWrap = document.getElementById('disable2FASendEmailWrap');
        if (sendEmailWrap) {
            sendEmailWrap.style.display = twoFAStatus.method === 'email' ? 'block' : 'none';
        }
        document.getElementById('disable2FAModal').classList.add('show');
    }

    function closeDisable2FAModal() {
        document.getElementById('disable2FAModal').classList.remove('show');
    }

    async function submitDisable2FA(e) {
        e.preventDefault();
        const code = document.getElementById('disable2FACode').value.trim();
        if (!code) {
            showAlert('Introduza o código atual.');
            return;
        }
        try {
            await fetchAuth('/api/user/2fa/disable', {
                method: 'POST',
                body: JSON.stringify({ code })
            });
            showAlert('2FA desativado.');
            closeDisable2FAModal();
            load2FAStatus();
        } catch (err) {
            showAlert(err.message || 'Código inválido.');
        }
    }

    async function sendDisable2FAEmailCode() {
        try {
            await fetchAuth('/api/user/2fa/send-email-code', { method: 'POST' });
            showAlert('Código enviado para o seu e-mail.');
        } catch (err) {
            showAlert(err.message || 'Erro ao enviar código.');
        }
    }

    async function cancel2FASetup() {
        showConfirm(
            'Cancelar a configuração de 2FA em curso? Não precisa de introduzir nenhum código.',
            'Cancelar configuração',
            async () => {
                try {
                    await fetchAuth('/api/user/2fa/cancel-setup', { method: 'POST' });
                    close2FAModal();
                    showAlert('Configuração de 2FA cancelada.');
                    load2FAStatus();
                } catch (err) {
                    showAlert(err.message || 'Erro ao cancelar configuração.');
                }
            }
        );
    }

    function init() {
        if (!checkAuth()) return;

        const profileForm = document.getElementById('profileForm');
        const cancelBtn = document.getElementById('cancelBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        profileForm && profileForm.addEventListener('submit', (e) => { e.preventDefault(); saveProfile(); });
        cancelBtn && cancelBtn.addEventListener('click', () => loadProfile());
        logoutBtn && logoutBtn.addEventListener('click', () => {
            showConfirm('Tem certeza que deseja sair?', 'Sair', () => {
                localStorage.removeItem('PROMOPING_TOKEN');
                localStorage.removeItem('PROMOPING_USER');
                window.location.href = 'login.html';
            });
        });

        // Alterar senha
        document.getElementById('changePasswordBtn')?.addEventListener('click', openChangePasswordModal);
        document.getElementById('closeChangePasswordModal')?.addEventListener('click', closeChangePasswordModal);
        document.getElementById('cancelChangePasswordBtn')?.addEventListener('click', closeChangePasswordModal);
        document.getElementById('changePasswordForm')?.addEventListener('submit', submitChangePassword);

        // Telefone
        document.getElementById('addPhoneBtn')?.addEventListener('click', openPhoneModal);
        document.getElementById('closePhoneModal')?.addEventListener('click', closePhoneModal);
        document.getElementById('cancelPhoneBtn')?.addEventListener('click', closePhoneModal);
        document.getElementById('phoneForm')?.addEventListener('submit', submitPhone);

        // Google
        document.getElementById('connectGoogleBtn')?.addEventListener('click', connectGoogle);

        // E-mail de backup e Chaves: em breve
        document.getElementById('addBackupEmailBtn')?.addEventListener('click', () => showAlert('Disponível em breve.', 'Informação'));
        document.getElementById('addAccessKeyBtn')?.addEventListener('click', () => showAlert('Disponível em breve.', 'Informação'));

        // 2FA
        document.getElementById('add2FABtn')?.addEventListener('click', open2FAModal);
        document.getElementById('cancel2FASetupBtn')?.addEventListener('click', cancel2FASetup);
        document.getElementById('disable2FABtn')?.addEventListener('click', openDisable2FAModal);
        document.getElementById('disable2FASendEmailBtn')?.addEventListener('click', sendDisable2FAEmailCode);
        document.getElementById('twoFAMethodTotp')?.addEventListener('click', () => start2FASetup('totp'));
        document.getElementById('twoFAMethodEmail')?.addEventListener('click', () => start2FASetup('email'));
        document.getElementById('twoFAVerifyBtn')?.addEventListener('click', verify2FASetup);
        document.getElementById('twoFACancelSetupBtn')?.addEventListener('click', close2FAModal);
        document.getElementById('close2FAModal')?.addEventListener('click', close2FAModal);
        document.getElementById('disable2FAForm')?.addEventListener('submit', submitDisable2FA);
        document.getElementById('closeDisable2FAModal')?.addEventListener('click', closeDisable2FAModal);
        document.getElementById('cancelDisable2FABtn')?.addEventListener('click', closeDisable2FAModal);

        [ 'changePasswordModal', 'phoneModal', 'twoFAModal', 'disable2FAModal' ].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('show');
                el.addEventListener('click', function (e) { if (e.target === el) { el.classList.remove('show'); } });
            }
        });

        loadProfile();
        console.log('Página de perfil inicializada');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
