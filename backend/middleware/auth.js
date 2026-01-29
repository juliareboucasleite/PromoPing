import jwt from "jsonwebtoken";

// ===== ATENÇÃO: NÃO MEXA NESSA PORRA AQUI =====
// Essa função é o coração da segurança do sistema, se tu fuder isso aqui
// qualquer zé ruela vai conseguir acessar conta dos outros
// Se não souber o que tá fazendo, NÃO TOQUE NESSA MERDA
export function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  // CARALHO, NÃO REMOVA ESSA VERIFICAÇÃO DO JWT_SECRET
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
