import express from 'express';
import { heraldService } from '../services/heraldService.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Rota para verificar se a API Herald está configurada
 * GET /api/herald/status
 */
router.get('/status', verifyToken, (req, res) => {
    try {
        const isConfigured = heraldService.isConfigured();
        res.json({
            status: 'success',
            configured: isConfigured,
            baseURL: heraldService.baseURL,
            message: isConfigured 
                ? 'API Herald configurada e pronta para uso' 
                : 'API Herald não configurada. Configure HERALD_API_KEY no .env'
        });
    } catch (error) {
        console.error('[HERALD] Erro ao verificar status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao verificar status da API Herald',
            error: error.message
        });
    }
});

/**
 * Rota para buscar lista de producers
 * GET /api/herald/producers
 * Query params opcionais: qualquer parâmetro suportado pela API Herald
 */
router.get('/producers', verifyToken, async (req, res) => {
    try {
        const producers = await heraldService.getProducers(req.query);
        res.json({
            status: 'success',
            data: producers
        });
    } catch (error) {
        console.error('[HERALD] Erro ao buscar producers:', error);
        res.status(error.message?.includes('não configurada') ? 503 : 500).json({
            status: 'error',
            message: 'Erro ao buscar producers da API Herald',
            error: error.message
        });
    }
});

/**
 * Rota para buscar um producer específico
 * GET /api/herald/producers/:id
 */
router.get('/producers/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const producer = await heraldService.getProducer(id);
        res.json({
            status: 'success',
            data: producer
        });
    } catch (error) {
        console.error(`[HERALD] Erro ao buscar producer ${req.params.id}:`, error);
        res.status(error.message?.includes('não configurada') ? 503 : 500).json({
            status: 'error',
            message: `Erro ao buscar producer ${req.params.id}`,
            error: error.message
        });
    }
});

/**
 * Rota genérica para fazer requisições customizadas à API Herald
 * POST /api/herald/request
 * Body: { endpoint: string, method?: string, body?: object, headers?: object }
 */
router.post('/request', verifyToken, async (req, res) => {
    try {
        const { endpoint, method = 'GET', body, headers } = req.body;

        if (!endpoint) {
            return res.status(400).json({
                status: 'error',
                message: 'Endpoint é obrigatório'
            });
        }

        const data = await heraldService.makeRequest(endpoint, {
            method,
            body,
            headers
        });

        res.json({
            status: 'success',
            data
        });
    } catch (error) {
        console.error('[HERALD] Erro na requisição customizada:', error);
        res.status(error.message?.includes('não configurada') ? 503 : 500).json({
            status: 'error',
            message: 'Erro ao fazer requisição à API Herald',
            error: error.message
        });
    }
});

export default router;
