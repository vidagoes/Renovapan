
import { openDatabase } from "./db.mjs";
import { newTotpSecret, setOwner } from "./auth.mjs";

const username = (process.argv[2] || "proprietario").trim().toLowerCase();
const password = process.env.RENOVAPAN_ADMIN_PASSWORD;
if (!/^[a-z0-9_.-]{3,64}$/.test(username) || !password || password.length < 14 || password.length > 256) {
  console.error("Informe um usuário válido e RENOVAPAN_ADMIN_PASSWORD com 14 a 256 caracteres.");
  process.exit(1);
}
const db = openDatabase();
try {
  const secret = process.argv.includes("--totp") ? newTotpSecret() : null;
  setOwner(db, username, password, secret);
  console.log("Proprietário configurado. Sessões anteriores foram revogadas.");
  if (secret) console.log("Chave TOTP para cadastrar no autenticador (6 dígitos, 30 segundos): " + secret);
} finally {
  db.close();
}
