import jwt from "jsonwebtoken";

export function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  const secret = process.env.JWT_SECRET || "promoping_secret_key_2025_very_secure_12345";
  
  jwt.verify(token, secret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido" });
    }
    req.user = user; // payload do JWT
    next();
  });
}
