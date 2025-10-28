// ================== MIDDLEWARE DE VERIFICAÇÃO DE PLANOS ==================

/**
 * Middleware para verificar se o usuário tem permissão para acessar recursos baseado no plano
 * @param {Array} planosPermitidos - Array com os nomes dos planos permitidos
 * @returns {Function} Middleware function
 */
export function verificarPlanoPermitido(planosPermitidos = []) {
  return (req, res, next) => {
    try {
      // Obter plano do usuário (vem do middleware de autenticação)
      const userPlano = req.user?.plano?.nome || "Free";
      
      console.log(` Verificando plano: ${userPlano} para recursos: [${planosPermitidos.join(", ")}]`);

      // Verificar se o plano está na lista de permitidos
      if (!planosPermitidos.includes(userPlano)) {
        console.log(` Acesso negado para plano: ${userPlano}`);
        
        return res.status(403).json({
          status: "error",
          message: `Acesso restrito — apenas para planos: ${planosPermitidos.join(", ")}.`,
          plano_atual: userPlano,
          planos_permitidos: planosPermitidos,
          upgrade_url: "/planos.html",
          timestamp: new Date().toISOString()
        });
      }

      console.log(` Acesso permitido para plano: ${userPlano}`);
      next();
      
    } catch (error) {
      console.error(" Erro no middleware de verificação de plano:", error);
      res.status(500).json({
        status: "error",
        message: "Erro interno na verificação de plano",
        error: error.message
      });
    }
  };
}

/**
 * Middleware para verificar se o usuário tem plano Premium
 * @returns {Function} Middleware function
 */
export function verificarPlanoPremium() {
  return verificarPlanoPermitido(["Premium"]);
}

/**
 * Middleware para verificar se o usuário tem plano Standard ou Premium
 * @returns {Function} Middleware function
 */
export function verificarPlanoStandard() {
  return verificarPlanoPermitido(["Standard", "Premium"]);
}

/**
 * Middleware para verificar se o usuário tem plano pago (Basic, Standard ou Premium)
 * @returns {Function} Middleware function
 */
export function verificarPlanoPago() {
  return verificarPlanoPermitido(["Basic", "Standard", "Premium"]);
}

/**
 * Middleware para verificar limites de uso baseado no plano
 * @param {string} tipoRecurso - Tipo de recurso (ex: 'incidentes', 'exportacoes')
 * @returns {Function} Middleware function
 */
export function verificarLimiteUso(tipoRecurso) {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userPlano = req.user?.plano?.nome || "Free";
      
      // Definir limites por plano
      const limites = {
        Free: { incidentes: 5, exportacoes: 0, relatorios: 0 },
        Basic: { incidentes: 100, exportacoes: 10, relatorios: 5 },
        Standard: { incidentes: 500, exportacoes: 50, relatorios: 20 },
        Premium: { incidentes: -1, exportacoes: -1, relatorios: -1 } // -1 = ilimitado
      };

      const limite = limites[userPlano]?.[tipoRecurso] || 0;
      
      if (limite === -1) {
        // Ilimitado
        return next();
      }

      // Verificar uso atual (implementar lógica de contagem baseada no tipoRecurso)
      // Por enquanto, vamos permitir (implementar contagem real depois)
      console.log(` Verificando limite de ${tipoRecurso} para plano ${userPlano}: ${limite}`);
      
      next();
      
    } catch (error) {
      console.error(" Erro na verificação de limite:", error);
      res.status(500).json({
        status: "error",
        message: "Erro na verificação de limite de uso"
      });
    }
  };
}

/**
 * Middleware para obter informações do plano do usuário
 * @returns {Function} Middleware function
 */
export function obterInfoPlano() {
  return (req, res, next) => {
    try {
      const userPlano = req.user?.plano?.nome || "Free";
      
      // Adicionar informações do plano ao request
      req.planoInfo = {
        nome: userPlano,
        limites: {
          Free: { incidentes: 5, exportacoes: 0, relatorios: 0 },
          Basic: { incidentes: 100, exportacoes: 10, relatorios: 5 },
          Standard: { incidentes: 500, exportacoes: 50, relatorios: 20 },
          Premium: { incidentes: -1, exportacoes: -1, relatorios: -1 }
        }[userPlano],
        recursos: {
          Free: ["visualizacao_basica"],
          Basic: ["visualizacao_basica", "exportacao_csv", "exportacao_excel"],
          Standard: ["visualizacao_basica", "exportacao_csv", "exportacao_excel", "exportacao_pdf"],
          Premium: ["visualizacao_basica", "exportacao_csv", "exportacao_excel", "exportacao_pdf", "relatorios_avancados", "api_personalizada"]
        }[userPlano] || []
      };
      
      next();
      
    } catch (error) {
      console.error(" Erro ao obter informações do plano:", error);
      res.status(500).json({
        status: "error",
        message: "Erro ao obter informações do plano"
      });
    }
  };
}
