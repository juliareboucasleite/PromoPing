/**
 * Utilitários de API para o Admin Panel
 * Previne vulnerabilidades SSRF validando URLs
 */

(function() {
    'use strict';

    /**
     * Lista de URLs permitidas (whitelist)
     * Apenas estas URLs podem ser usadas para requisições
     */
    const ALLOWED_API_BASES = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://promoping.pt',
        'https://www.promoping.pt',
        'http://promoping.pt',
        'http://www.promoping.pt'
    ];

    /**
     * Valida se uma URL base é segura e permitida
     * @param {string} apiBase - URL base da API
     * @returns {string} URL base validada e sanitizada
     * @throws {Error} Se a URL não for permitida
     */
    function validateApiBase(apiBase) {
        if (!apiBase || typeof apiBase !== 'string') {
            throw new Error('URL base da API inválida');
        }

        // Remove barras finais e espaços
        const cleaned = apiBase.trim().replace(/\/+$/, '');

        // Verifica se está na whitelist
        if (!ALLOWED_API_BASES.includes(cleaned)) {
            console.warn(`[API-UTILS] URL não permitida: ${cleaned}. Usando padrão.`);
            // Retorna o padrão seguro ao invés de lançar erro (melhor UX)
            return 'http://localhost:3000';
        }

        // Validação adicional de formato de URL
        try {
            const url = new URL(cleaned);
            
            // Bloquear protocolos perigosos
            if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error('Protocolo não permitido');
            }

            // Bloquear localhost em produção (se necessário)
            // Mas permitir em desenvolvimento
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
                // Permitir apenas em desenvolvimento (não em produção)
                // Em produção, você pode querer bloquear isso
                // Por enquanto, permitimos porque está na whitelist
            }

            return cleaned;
        } catch (error) {
            console.error(`[API-UTILS] Erro ao validar URL: ${error.message}`);
            return 'http://localhost:3000'; // Fallback seguro
        }
    }

    /**
     * Deduz a base da API a partir da URL atual quando estamos num
     * domínio reconhecido (ex.: promoping.pt). Em localhost, usa porta 3000.
     */
    function detectApiBaseFromLocation() {
        try {
            const { protocol, hostname, port } = window.location;
            if (protocol === 'file:' || !hostname) {
                return 'http://localhost:3000';
            }
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return 'http://localhost:3000';
            }
            // Em produção (promoping.pt) a API é servida no mesmo host/porta
            const portPart = port && port !== '80' && port !== '443' ? `:${port}` : '';
            return `${protocol}//${hostname}${portPart}`;
        } catch (e) {
            return 'http://localhost:3000';
        }
    }

    /**
     * Obtém a URL base da API de forma segura
     * @returns {string} URL base validada
     */
    function getSafeApiBase() {
        const stored = localStorage.getItem('PROMOPING_API');
        const defaultBase = detectApiBaseFromLocation();

        try {
            const defaultUrl = new URL(defaultBase);
            const isProductionHost = defaultUrl.hostname === 'promoping.pt' || defaultUrl.hostname === 'www.promoping.pt';

            // Em produção, a base do próprio site deve prevalecer sempre.
            if (isProductionHost) {
                return defaultBase;
            }
        } catch (_) {
            // Se falhar, continua para a lógica normal abaixo.
        }

        if (!stored) {
            return defaultBase;
        }

        try {
            return validateApiBase(stored);
        } catch (error) {
            console.error(`[API-UTILS] Erro ao validar API base: ${error.message}`);
            return defaultBase;
        }
    }

    /**
     * Valida se um endpoint é seguro (não contém caracteres perigosos)
     * @param {string} endpoint - Endpoint da API
     * @returns {string} Endpoint sanitizado
     * @throws {Error} Se o endpoint for inválido
     */
    function validateEndpoint(endpoint) {
        if (!endpoint || typeof endpoint !== 'string') {
            throw new Error('Endpoint inválido');
        }

        // Remove espaços
        const cleaned = endpoint.trim();

        // Deve começar com /
        if (!cleaned.startsWith('/')) {
            throw new Error('Endpoint deve começar com /');
        }

        // Bloquear caracteres perigosos que podem ser usados para manipular a URL
        if (/[<>\s]/.test(cleaned)) {
            throw new Error('Endpoint contém caracteres inválidos');
        }

        // Bloquear tentativas de sair do contexto da API
        if (cleaned.includes('..')) {
            throw new Error('Endpoint contém sequência inválida');
        }

        return cleaned;
    }

    /**
     * Constrói uma URL completa de forma segura
     * @param {string} endpoint - Endpoint da API
     * @returns {string} URL completa e validada
     */
    function buildSafeUrl(endpoint) {
        const apiBase = getSafeApiBase();
        const safeEndpoint = validateEndpoint(endpoint);
        return `${apiBase}${safeEndpoint}`;
    }

    /**
     * Remove prefixo no formato [Discord], [Console], etc., deixando apenas o título.
     * @param {string} str - Texto que pode conter prefixo [Algo]
     * @returns {string} Texto sem o prefixo entre parêntesis retos
     */
    function stripBracketPrefix(str) {
        if (str == null || typeof str !== 'string') return str === null || str === undefined ? '' : String(str);
        const out = str.replace(/^\s*\[[^\]]*\]\s*/, '').trim();
        return out || str;
    }

    // Exportar funções para uso global
    window.APIUtils = {
        validateApiBase,
        getSafeApiBase,
        validateEndpoint,
        buildSafeUrl,
        stripBracketPrefix
    };

})();
