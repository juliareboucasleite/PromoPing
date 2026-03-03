/**
 * Sistema de Autenticação - PromoPing Admin
 * Login simples com email e senha
 */

(function() {
    'use strict';

    // Configuração da API - usar APIUtils para validação segura
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';

    // Elementos do DOM
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const errorMessage = document.getElementById('errorMessage');

    // Se não estiver na página de login, não inicializar
    if (!loginForm) {
        return;
    }

    // Mensagem de sessão expirada/inválida (redirecionado pelo viewmodel-base)
    const loginMsg = sessionStorage.getItem('PROMOPING_LOGIN_MSG');
    if (loginMsg && errorMessage) {
        errorMessage.textContent = loginMsg;
        errorMessage.classList.add('show');
        sessionStorage.removeItem('PROMOPING_LOGIN_MSG');
    }

    /**
     * Mostrar mensagem de erro
     */
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        loginForm.classList.add('loading');
        loginButton.disabled = false;
        loginButton.textContent = 'Entrar';
    }

    /**
     * Esconder mensagem de erro
     */
    function hideError() {
        errorMessage.classList.remove('show');
        loginForm.classList.remove('loading');
    }

    /**
     * Validar email
     */
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Handler de submit do formulário
     */
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Validações básicas
        if (!email) {
            showError('Por favor, informe seu email.');
            emailInput.focus();
            return;
        }

        if (!isValidEmail(email)) {
            showError('Por favor, informe um email válido.');
            emailInput.focus();
            return;
        }

        if (!password) {
            showError('Por favor, informe sua senha.');
            passwordInput.focus();
            return;
        }

        // Desabilitar botão e mostrar loading
        loginButton.disabled = true;
        loginButton.textContent = 'Entrando...';
        loginForm.classList.add('loading');

        try {
            console.log('[AUTH] Tentando fazer login...', {
                email,
                api: API_BASE
            });

            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl('/api/auth/login') : `${API_BASE}/api/auth/login`;
            const response = await fetch(safeUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Panel': 'true',
                    'x-admin-panel': 'true'
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            console.log('[AUTH] Resposta recebida:', {
                status: response.status,
                ok: response.ok
            });

            let data;
            try {
                data = await response.json();
            } catch (parseErr) {
                console.error('[AUTH] Erro ao parsear JSON:', parseErr);
                throw new Error('Erro ao comunicar com o servidor. Verifique se o servidor está rodando.');
            }

            console.log('[AUTH] Dados recebidos:', data);

            // Verificar resposta
            if (!response.ok || data.status !== 'ok' || !data.token) {
                // Verificar se foi acesso negado por não ser admin
                if (data.accessDenied) {
                    throw new Error('Acesso negado. Apenas administradores podem acessar o painel administrativo.');
                }
                // Verificar se precisa verificar email
                if (data.needsVerification) {
                    throw new Error('Email não verificado. Verifique seu email antes de fazer login.');
                }
                // Verificar se conta está expirada
                if (data.accountExpired) {
                    throw new Error('Sua conta foi desativada há mais de 20 dias e foi permanentemente excluída. Entre em contato com o suporte.');
                }
                // Usar optional chaining corretamente
                const errorMsg = (data && data.error) ? data.error : 'Email ou senha incorretos';
                throw new Error(errorMsg);
            }

            // PerfilId 1 = Admin (suporte), PerfilId 3 = Corporation
            const perfilId = data.user && (data.user.perfilId !== undefined ? data.user.perfilId : data.user.PerfilId);
            if (perfilId !== 1 && perfilId !== 3) {
                throw new Error('Acesso negado. Apenas administradores ou utilizadores corporativos podem acessar o painel.');
            }

            // Login bem-sucedido
            console.log('[AUTH] Login bem-sucedido! Usuário:', data.user, 'PerfilId:', perfilId);
            console.log('[AUTH] Token recebido:', data.token ? 'Sim' : 'Não');

            // Salvar token e refresh token (para renovação automática)
            try {
                localStorage.setItem('PROMOPING_TOKEN', data.token);
                if (data.refreshToken) {
                    localStorage.setItem('PROMOPING_REFRESH_TOKEN', data.refreshToken);
                }
                const userToStore = { ...data.user, perfilId: perfilId };
                localStorage.setItem('PROMOPING_USER', JSON.stringify(userToStore));
                localStorage.setItem('PROMOPING_API', API_BASE);
                console.log('[AUTH] Dados salvos no localStorage');
            } catch (storageErr) {
                console.error('[AUTH] Erro ao salvar no localStorage:', storageErr);
                throw new Error('Erro ao salvar dados de autenticação');
            }

            // Redirecionar: id 1 -> painel suporte (pages), id 3 -> painel corporação (pages_corporation)
            const isCorporation = perfilId === 3;
            const dashboardPath = isCorporation ? '../pages_corporation/dashboard.html' : 'dashboard.html';
            console.log('[AUTH] Redirecionando para', dashboardPath);

            // Limpar loading state
            loginForm.classList.remove('loading');
            loginButton.disabled = false;
            loginButton.textContent = 'Entrando...';

            try {
                window.location.replace(dashboardPath);
            } catch (redirectErr) {
                console.error('[AUTH] Erro no redirecionamento, tentando href:', redirectErr);
                window.location.href = dashboardPath;
            }

        } catch (err) {
            console.error('[AUTH] Erro:', err);

            let errorMessage = err.message || 'Falha ao autenticar';

            // Tratar erros de rede
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                errorMessage = `Não foi possível conectar ao servidor. Verifique se o servidor está rodando em ${API_BASE}`;
            }

            showError(errorMessage);
        }
    });

    // Focar no campo de email ao carregar
    if (emailInput) {
        emailInput.focus();
    }

    // Limpar erro ao digitar
    emailInput.addEventListener('input', hideError);
    passwordInput.addEventListener('input', hideError);

    console.log('[AUTH] Sistema de autenticação inicializado');
})();