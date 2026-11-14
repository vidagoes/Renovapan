
import { openDatabase } from "./db.mjs";
import { setOwner, strongPassword } from "./auth.mjs";

const username = (process.argv[2] || "proprietario").trim().toLowerCase();
const password = process.env.RENOVAPAN_ADMIN_PASSWORD;
if (!/^[a-z0-9_.-]{3,64}$/.test(username) || !strongPassword(password)) {
  console.error("Informe um usuário válido e RENOVAPAN_ADMIN_PASSWORD com senha forte de 14 a 256 caracteres.");
  process.exit(1);
}
const db = openDatabase();
try {
  setOwner(db, username, password);
  console.log("Proprietário configurado com sucesso. Sessões anteriores foram revogadas.");
} finally {
  db.close();
}
