import {
    pool
} from "../database/db.js";

/**
 * Middleware que carrega o plano do utilizador da base de dados e define req.user.plano.
 * NecessÃ¡rio porque o JWT nÃ£o inclui o plano; sem isto a verificaÃ§Ã£o assume sempre "Free".
 */
export async function carregarPlanoNoRequest(req, res, next) {
    try {
        if (!req.user?.ReferenciaID) {
            return next();
        }
        const [rows] = await pool.query(
            `SELECT p.Id AS id, p.Nome AS nome
       FROM configutilizador c
       JOIN planos p ON c.PlanoAtualId = p.Id
       WHERE c.ReferenciaID = ?
       LIMIT 1`,
            [req.user.ReferenciaID]
        );
        if (rows.length > 0) {
            req.user.plano = {
                id: rows[0].id,
                nome: rows[0].nome
            };
        } else {
            req.user.plano = {
                id: 1,
                nome: "Free"
            };
        }
        next();
    } catch (err) {
        console.error(" Erro ao carregar plano no request:", err);
        req.user.plano = {
            id: 1,
            nome: "Free"
        };
        next();
    }
}

/**
 * Middleware para verificar se o usuÃ¡rio tem permissÃ£o para acessar recursos baseado no plano
 * @param {Array} planosPermitidos - Array com os nomes dos planos permitidos
 * @returns {Function} Middleware function
 * 
 * ATENÃ‡ÃƒO: Os nomes dos planos sÃ£o: 'Free', 'Basic', 'Standard', 'Premium'
 * NÃƒO MUDE ESSES NOMES SEM ATUALIZAR TODA A BASE DE DADOS
 */
export function verificarPlanoPermitido(planosPermitidos = []) {
    return (req, res, next) => {
        try {
            // Obter plano do usuÃ¡rio (vem do middleware de autenticaÃ§Ã£o)
            const userPlano = req.user?.plano?.nome || "Free";

            console.log(` Verificando plano: ${userPlano} para recursos: [${planosPermitidos.join(", ")}]`);

            // Verificar se o plano estÃ¡ na lista de permitidos
            if (!planosPermitidos.includes(userPlano)) {
                console.log(` Acesso negado para plano: ${userPlano}`);

                return res.status(403).json({
                    status: "error",
                    message: `Acesso restrito â€” apenas para planos: ${planosPermitidos.join(", ")}.`,
                    plano_atual: userPlano,
                    planos_permitidos: planosPermitidos,
                    upgrade_url: "/dashboard/subscription-plans.html",
                    timestamp: new Date().toISOString()
                });
            }

            console.log(` Acesso permitido para plano: ${userPlano}`);
            next();

        } catch (error) {
            console.error(" Erro no middleware de verificaÃ§Ã£o de plano:", error);
            res.status(500).json({
                status: "error",
                message: "Erro interno na verificaÃ§Ã£o de plano",
                error: error.message
            });
        }
    };
}

/**
 * Middleware para verificar se o usuÃ¡rio tem plano Premium
 * @returns {Function} Middleware function
 */
export function verificarPlanoPremium() {
    return verificarPlanoPermitido(["Premium"]);
}

/**
 * Middleware para verificar se o usuÃ¡rio tem plano Standard ou Premium
 * @returns {Function} Middleware function
 */
export function verificarPlanoStandard() {
    return verificarPlanoPermitido(["Standard", "Premium"]);
}

/**
 * Middleware para verificar se o usuÃ¡rio tem plano pago (Basic, Standard ou Premium)
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
            const referenciaID = req.user.ReferenciaID;
            const userPlano = req.user?.plano?.nome || "Free";

            // Definir limites por plano
            // ESSES LIMITES AQUI SÃƒO O QUE DEFINE O QUE CADA PLANO PODE FAZER
            // Se tu mudar esses nÃºmeros, pode dar mais ou menos do que o plano permite
            // E aÃ­ vai ter cliente reclamando ou aproveitando de graÃ§a
            // -1 = ilimitado, qualquer outro nÃºmero = limite mÃ¡ximo
            // NÃƒO MUDE ESSES VALORES SEM CONSULTAR A EQUIPE PRIMEIRO
            const limites = {
                Free: {
                    incidentes: 5,
                    exportacoes: 0,
                    relatorios: 0
                },
                Basic: {
                    incidentes: 100,
                    exportacoes: 10,
                    relatorios: 5
                },
                Standard: {
                    incidentes: 500,
                    exportacoes: 50,
                    relatorios: 20
                },
                Premium: {
                    incidentes: -1,
                    exportacoes: -1,
                    relatorios: -1
                } // -1 = ilimitado
            };

            const limite = limites[userPlano]?.[tipoRecurso] || 0;

            if (limite === -1) {
                // Ilimitado
                return next();
            }

            // Verificar uso atual (implementar lÃ³gica de contagem baseada no tipoRecurso)
            // Por enquanto, vamos permitir (implementar contagem real depois)
            console.log(` Verificando limite de ${tipoRecurso} para plano ${userPlano}: ${limite}`);

            next();

        } catch (error) {
            console.error(" Erro na verificaÃ§Ã£o de limite:", error);
            res.status(500).json({
                status: "error",
                message: "Erro na verificaÃ§Ã£o de limite de uso"
            });
        }
    };
}

/**
 * Middleware para obter informaÃ§Ãµes do plano do usuÃ¡rio
 * @returns {Function} Middleware function
 */
export function obterInfoPlano() {
    return (req, res, next) => {
        try {
            const userPlano = req.user?.plano?.nome || "Free";

            // Adicionar informaÃ§Ãµes do plano ao request
            req.planoInfo = {
                nome: userPlano,
                limites: {
                    Free: {
                        incidentes: 5,
                        exportacoes: 0,
                        relatorios: 0
                    },
                    Basic: {
                        incidentes: 100,
                        exportacoes: 10,
                        relatorios: 5
                    },
                    Standard: {
                        incidentes: 500,
                        exportacoes: 50,
                        relatorios: 20
                    },
                    Premium: {
                        incidentes: -1,
                        exportacoes: -1,
                        relatorios: -1
                    }
                } [userPlano],
                recursos: {
                    Free: ["visualizacao_basica"],
                    Basic: ["visualizacao_basica", "exportacao_csv", "exportacao_pdf"],
                    Standard: ["visualizacao_basica", "exportacao_csv", "exportacao_pdf"],
                    Premium: ["visualizacao_basica", "exportacao_csv", "exportacao_pdf", "relatorios_avancados", "api_personalizada"]
                } [userPlano] || []
            };

            next();

        } catch (error) {
            console.error(" Erro ao obter informaÃ§Ãµes do plano:", error);
            res.status(500).json({
                status: "error",
                message: "Erro ao obter informaÃ§Ãµes do plano"
            });
        }
    };
}
