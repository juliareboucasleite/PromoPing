import jwt from "jsonwebtoken";
import {
  hasPermission,
  hasPortalAccess,
  resolveAccessContext
} from "../services/accessControl.js";
import { touchUserSession } from "../services/userSessions.service.js";

// Essa funcao e o coracao da seguranca do sistema.
// Se voce modificar, pode dar acesso a contas de outros utilizadores.
export async function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token nao fornecido" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET nao encontrado no arquivo .env");
    return res.status(500).json({ error: "Configuracao de seguranca invalida" });
  }

  try {
    const user = jwt.verify(token, secret);

    if (user?.sid) {
      await touchUserSession(user.sid);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError" || err.message === "jwt expired") {
      return res.status(401).json({ error: "Token expirado", code: "TOKEN_EXPIRED" });
    }
    console.error("Token JWT invalido:", err.message);
    return res.status(403).json({ error: "Token invalido" });
  }
}

export async function attachAccessContext(req, res, next) {
  try {
    if (!req.user?.ReferenciaID) {
      return res.status(401).json({ status: "error", error: "Nao autenticado" });
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
    res.status(500).json({ status: "error", error: "Erro ao validar permissoes." });
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

export function requirePermission(permissionCode, errorMessage = "Permissao insuficiente.") {
  return (req, res, next) => {
    ensurePermissionContext(req, res, next, (innerReq, innerRes, innerNext) => {
      if (!hasPermission(innerReq.accessContext, permissionCode)) {
        return innerRes.status(403).json({ status: "error", error: errorMessage });
      }
      innerNext();
    });
  };
}

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
