import jwt from "jsonwebtoken";

// ===== ATENÇÃO: NÃO MEXA NESSA PORRA AQUI =====
// Essa função é o coração da segurança do sistema, se tu fuder isso aqui
// qualquer zé ruela vai conseguir acessar conta dos outros
// Se não souber o que tá fazendo, NÃO TOQUE NESSA MERDA
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

  // CARALHO, NÃO REMOVA ESSA VERIFICAÇÃO DO JWT_SECRET
  // Se tu tirar isso, qualquer um pode gerar token falso e foder tudo
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET não encontrado no arquivo .env");
    return res.status(500).json({ error: "Configuração de segurança inválida" });
  }
  
  // Essa parte aqui valida o token, se tu mexer e quebrar, ninguém mais faz login
  // Deixa essa merda quieta, funciona perfeitamente
  jwt.verify(token, secret, (err, user) => {
    if (err) {
      console.error("Token JWT inválido:", err.message);
      return res.status(403).json({ error: "Token inválido" });
    }
    
    console.log("Token válido para ReferenciaID:", user.ReferenciaID);
    req.user = user; // payload do JWT - não mexe nisso também
    next();
  });
}
