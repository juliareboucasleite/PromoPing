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
    let twoFAStatus = { enabled: false };

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
                phoneDisplay.textContent = phone ? phone : '—';
            }

            // Populate hero
            const heroName = document.getElementById('profileHeroName');
            const heroEmail = document.getElementById('profileHeroEmail');
            const heroAvatar = document.getElementById('profileHeroAvatar');
            if (heroName) heroName.textContent = nome || 'Sem nome';
            if (heroEmail) heroEmail.textContent = email || '—';
            if (heroAvatar) {
                const initials = (nome || '?').split(' ').slice(0, 2)
                    .map(s => s[0]?.toUpperCase() || '').join('') || '?';
                heroAvatar.textContent = initials;
            }

            userHasPassword = null;

            await load2FAStatus();
        } catch (error) {
            console.error('[PERFIL] Erro ao carregar perfil:', error);
        }
    }

    async function load2FAStatus() {
        try {
            const response = await fetchAuth('/api/user/2fa/status');
            const data = await response.json();
            twoFAStatus = data.twoFA || { enabled: false };
            const statusEl = document.getElementById('twoFAStatusText');
            const addBtn = document.getElementById('add2FABtn');
            const disableBtn = document.getElementById('disable2FABtn');
            if (statusEl) statusEl.textContent = twoFAStatus.enabled ? 'Ativo' : '';
            if (addBtn) addBtn.style.display = twoFAStatus.enabled ? 'none' : 'inline-block';
            if (disableBtn) disableBtn.style.display = twoFAStatus.enabled ? 'inline-block' : 'none';
            const heroBadge = document.getElementById('profile2FABadge');
            if (heroBadge) heroBadge.style.display = twoFAStatus.enabled ? 'inline-flex' : 'none';
        } catch (e) {
            twoFAStatus = { enabled: false };
            const addBtn = document.getElementById('add2FABtn');
            const disableBtn = document.getElementById('disable2FABtn');
            if (addBtn) addBtn.style.display = 'inline-block';
            if (disableBtn) disableBtn.style.display = 'none';
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
        document.getElementById('phoneInput').value = current === '—' ? '' : current;
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
            if (el) el.textContent = telefone || '—';
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
        document.getElementById('disable2FABtn')?.addEventListener('click', openDisable2FAModal);
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
            if (el) el.addEventListener('click', function (e) { if (e.target === el) { el.classList.remove('show'); } });
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
