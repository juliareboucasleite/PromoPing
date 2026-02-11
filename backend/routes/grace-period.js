import express from 'express';
import { GracePeriodManager } from '../services/gracePeriodManager.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/grace-period/check
 * Verifica e atualiza períodos de graça expirados
 */
router.get('/check', verifyToken, async (req, res) => {
  try {
    console.log(' [API] Verificação manual de períodos de graça solicitada');
    
    const result = await GracePeriodManager.checkAndUpdateExpiredGracePeriods();
    
    res.json({
      status: 'ok',
      message: `${result.updated} usuários atualizados para Free`,
      updated: result.updated,
      users: result.users
    });
    
  } catch (error) {
    console.error(' [API] Erro ao verificar períodos de graça:', error);
    res.status(500).json({
      status: 'erro',
      message: 'Erro ao verificar períodos de graça'
    });
  }
});

/**
 * GET /api/grace-period/status/:referenciaID
 * Verifica o status do período de graça de um usuário específico
 */
router.get('/status/:referenciaID', verifyToken, async (req, res) => {
  try {
    const { referenciaID } = req.params;
    
    console.log(` [API] Verificando período de graça do usuário ${referenciaID}`);
    
    const gracePeriod = await GracePeriodManager.checkUserGracePeriod(referenciaID);
    
    if (gracePeriod) {
      res.json({
        status: 'ok',
        hasGracePeriod: true,
        gracePeriod: gracePeriod
      });
    } else {
      res.json({
        status: 'ok',
        hasGracePeriod: false,
        message: 'Usuário não possui período de graça ativo'
      });
    }
    
  } catch (error) {
    console.error(' [API] Erro ao verificar período de graça do usuário:', error);
    res.status(500).json({
      status: 'erro',
      message: 'Erro ao verificar período de graça do usuário'
    });
  }
});

export default router;
