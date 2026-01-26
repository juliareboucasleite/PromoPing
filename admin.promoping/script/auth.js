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
        console.log('[AUTH] Não está na página de login, ignorando inicialização');
        return;
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

            // Verificar se o usuário retornado é admin (PerfilId = 1)
            if (data.user && data.user.perfilId !== 1) {
                throw new Error('Acesso negado. Apenas administradores podem acessar o painel administrativo.');
            }

            // Login bem-sucedido
            console.log('[AUTH] Login bem-sucedido! Usuário admin:', data.user);
            console.log('[AUTH] Token recebido:', data.token ? 'Sim' : 'Não');
            console.log('[AUTH] Dados do usuário:', data.user);

            // Salvar token
            try {
                localStorage.setItem('PROMOPING_TOKEN', data.token);
                localStorage.setItem('PROMOPING_USER', JSON.stringify(data.user));
                localStorage.setItem('PROMOPING_API', API_BASE);
                console.log('[AUTH] Dados salvos no localStorage');
            } catch (storageErr) {
                console.error('[AUTH] Erro ao salvar no localStorage:', storageErr);
                throw new Error('Erro ao salvar dados de autenticação');
            }

            // Redirecionar para dashboard
            console.log('[AUTH] Redirecionando para dashboard...');

            // Limpar loading state
            loginForm.classList.remove('loading');
            loginButton.disabled = false;
            loginButton.textContent = 'Entrando...';

            // Forçar redirecionamento
            try {
                window.location.replace('dashboard.html');
            } catch (redirectErr) {
                console.error('[AUTH] Erro no redirecionamento, tentando href:', redirectErr);
                window.location.href = 'dashboard.html';
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