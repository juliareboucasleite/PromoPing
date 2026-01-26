import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Serviço para integração com a API Herald
 * Gerencia autenticação e requisições para a API Herald
 */
class HeraldService {
    constructor() {
        // URL base da API Herald (sandbox ou produção)
        this.baseURL = process.env.HERALD_API_BASE_URL || 'https://sandbox.heraldapi.com';
        
        // Token de autenticação (Bearer token)
        this.apiKey = process.env.HERALD_API_KEY || '';
        
        // Configurações de retry
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 segundo
    }

    /**
     * Verifica se a API está configurada corretamente
     * @returns {boolean} True se a API key está configurada
     */
    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Faz uma requisição autenticada para a API Herald
     * @param {string} endpoint - Endpoint da API (ex: '/producers')
     * @param {Object} options - Opções da requisição (method, body, headers, etc)
     * @returns {Promise<Object>} Resposta da API parseada como JSON
     * @throws {Error} Se a requisição falhar ou a API não estiver configurada
     */
    async makeRequest(endpoint, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('API Herald não configurada. Configure HERALD_API_KEY no .env');
        }

        // Remove barra inicial do endpoint se existir
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        const url = `${this.baseURL}/${cleanEndpoint}`;

        // Headers padrão com autenticação Bearer
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Configuração da requisição
        const requestOptions = {
            method: options.method || 'GET',
            headers,
            ...options
        };

        // Adiciona body se fornecido
        if (options.body) {
            requestOptions.body = typeof options.body === 'string' 
                ? options.body 
                : JSON.stringify(options.body);
        }

        // Tenta fazer a requisição com retry
        let lastError;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(url, requestOptions);

                // Se for 429 (rate limit), aguarda e tenta novamente
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitTime = retryAfter 
                        ? parseInt(retryAfter) * 1000 
                        : this.retryDelay * attempt;
                    
                    if (attempt < this.maxRetries) {
                        console.warn(`[HeraldService] Rate limit atingido. Aguardando ${waitTime}ms antes de tentar novamente...`);
                        await this.delay(waitTime);
                        continue;
                    }
                }

                // Parse da resposta
                const contentType = response.headers.get('content-type');
                let data;

                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    const text = await response.text();
                    data = { raw: text };
                }

                // Se não for sucesso, lança erro
                if (!response.ok) {
                    throw new Error(
                        data.error || 
                        data.message || 
                        `HTTP ${response.status}: ${response.statusText}`
                    );
                }

                return data;
            } catch (error) {
                lastError = error;
                
                // Se não for erro de rede ou timeout, não tenta novamente
                if (error.message && !error.message.includes('fetch')) {
                    throw error;
                }

                // Se for a última tentativa, lança o erro
                if (attempt === this.maxRetries) {
                    throw new Error(
                        `Erro ao fazer requisição para a API Herald após ${this.maxRetries} tentativas: ${error.message}`
                    );
                }

                // Aguarda antes de tentar novamente
                await this.delay(this.retryDelay * attempt);
            }
        }

        throw lastError;
    }

    /**
     * Busca lista de producers
     * @param {Object} params - Parâmetros de query (opcional)
     * @returns {Promise<Object>} Lista de producers
     */
    async getProducers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/producers?${queryString}` : '/producers';
        return this.makeRequest(endpoint);
    }

    /**
     * Busca um producer específico por ID
     * @param {string} producerId - ID do producer
     * @returns {Promise<Object>} Dados do producer
     */
    async getProducer(producerId) {
        return this.makeRequest(`/producers/${producerId}`);
    }

    /**
     * Utilitário para delay
     * @param {number} ms - Milissegundos para aguardar
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Exporta instância singleton
export const heraldService = new HeraldService();
