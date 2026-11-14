
import { openDatabase } from "./db.mjs";
import { setOwner, validOwnerPassword } from "./auth.mjs";
import { runtime } from "./runtime.mjs";

const { prototype, database } = runtime();
const username = (process.argv[2] || "proprietario").trim().toLowerCase();
const password = process.env.RENOVAPAN_ADMIN_PASSWORD;
if (!/^[a-z0-9_.-]{3,64}$/.test(username) || !validOwnerPassword(password, prototype)) {
  console.error("Informe um usuário válido e RENOVAPAN_ADMIN_PASSWORD com "
    + (prototype ? "senha de 8 a 256 caracteres." : "senha forte de 14 a 256 caracteres."));
  process.exit(1);
}
const db = openDatabase(database);
try {
  setOwner(db, username, password, { prototype });
  console.log("Proprietário configurado com sucesso. Sessões anteriores foram revogadas.");
} finally {
  db.close();
}
