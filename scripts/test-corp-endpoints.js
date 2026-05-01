import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const token = jwt.sign(
  { ReferenciaID: "REF-964479070", email: "leeksxy@gmail.com" },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

const endpoints = [
  "/api/corporation/bugs",
  "/api/corporation/sugestoes",
  "/api/corporation/incidents",
];

for (const ep of endpoints) {
  const res = await fetch(`http://localhost:3000${ep}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  const list = json.bugs || json.sugestoes || json.incidents || [];
  console.log(`\n=== ${ep} (status ${res.status}) ===`);
  console.log("total:", json.total, "first row keys:", list[0] ? Object.keys(list[0]) : "[empty]");
  if (list[0]) {
    console.log("Sample.Titulo:", list[0].Titulo);
    console.log("Sample.DataCriacao:", list[0].DataCriacao);
  }
}
