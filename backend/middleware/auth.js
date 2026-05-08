import jwt from "jsonwebtoken";
import {
  hasPermission,
  hasPortalAccess,
  resolveAccessContext
} from "../services/accessControl.js";

// Essa função é o coração da segurança do sistema
// Se você modificar, pode dar acesso a contas de outros usuários
// NÃO ALTERE ESSA FUNÇÃO SEM ENTENDER O IMPACTO
export function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  // ATENÇÃO: NÃO REMOVA ESSA VERIFICAÇÃO DO JWT_SECRET
  // Se você remover, pode dar acesso a contas de outros usuários
  // NÃO ALTERE ESSA PARTE SEM ENTENDER O IMPACTO
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET não encontrado no arquivo .env");
    return res.status(500).json({ error: "Configuração de segurança inválida" });
  }

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      // Token expirado: 401 para o frontend redirecionar para login
      if (err.name === "TokenExpiredError" || err.message === "jwt expired") {
        return res.status(401).json({ error: "Token expirado", code: "TOKEN_EXPIRED" });
      }
      console.error("Token JWT inválido:", err.message);
      return res.status(403).json({ error: "Token inválido" });
    }
    req.user = user;
    next();
  });
}

export async function attachAccessContext(req, res, next) {
  try {
    if (!req.user?.ReferenciaID) {
      return res.status(401).json({ status: "error", error: "Não autenticado" });
    }

    if (!req.accessContext) {
      req.accessContext = await resolveAccessContext(
        req.user.ReferenciaID,
        req.user.perfilId ?? req.user.PerfilId ?? null
      );
      req.user.access = req.accessContext;
    }

    next();
  } catch (error) {
    console.error("[AUTH] Erro ao resolver contexto de acesso:", error);
    res.status(500).json({ status: "error", error: "Erro ao validar permissões." });
  }
}

function ensurePermissionContext(req, res, next, callback) {
  attachAccessContext(req, res, () => callback(req, res, next));
}

export function requirePortalAccess(portal, errorMessage = "Acesso negado a este portal.") {
  return (req, res, next) => {
    ensurePermissionContext(req, res, next, (innerReq, innerRes, innerNext) => {
      if (!hasPortalAccess(innerReq.accessContext, portal)) {
        return innerRes.status(403).json({ status: "error", error: errorMessage });
      }
      innerNext();
    });
  };
}

export function requirePermission(permissionCode, errorMessage = "Permissão insuficiente.") {
  return (req, res, next) => {
    ensurePermissionContext(req, res, next, (innerReq, innerRes, innerNext) => {
      if (!hasPermission(innerReq.accessContext, permissionCode)) {
        return innerRes.status(403).json({ status: "error", error: errorMessage });
      }
      innerNext();
    });
  };
}

/**
 * Autenticação opcional: se houver token, valida e define req.user; senão req.user = null.
 * Usado em rotas que aceitam utilizador logado ou anónimo (ex.: suporte).
 */
export function optionalToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    req.user = null;
    return next();
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    req.user = null;
    return next();
  }

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      req.user = null;
      return next();
    }
    req.user = user;
    next();
  });
}
