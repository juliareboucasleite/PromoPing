import jwt from "jsonwebtoken";

export function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  console.log("Verificando token...");
  console.log("Authorization header:", authHeader);
  console.log("Token extraído:", token ? "Presente" : "Ausente");

  if (!token) {
    console.log("Token não fornecido");
    return res.status(401).json({ error: "Token não fornecido" });
  }

  // Garantir que JWT_SECRET existe no .env
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET não encontrado no arquivo .env");
    return res.status(500).json({ error: "Configuração de segurança inválida" });
  }
  
  jwt.verify(token, secret, (err, user) => {
    if (err) {
      console.error("Token JWT inválido:", err.message);
      return res.status(403).json({ error: "Token inválido" });
    }
    
    console.log("Token válido para ReferenciaID:", user.ReferenciaID);
    req.user = user; // payload do JWT
    next();
  });
}
