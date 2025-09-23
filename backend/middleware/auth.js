// backend/middleware/auth.js
import jwt from "jsonwebtoken";

// Middleware para verificar o token JWT
export function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // formato: "Bearer token"

  if (!token) {
    return res.status(401).json({ error: "Acesso negado. Token não fornecido." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "segredo123");
    req.user = decoded; // adiciona os dados do utilizador no request
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido ou expirado." });
  }
}
